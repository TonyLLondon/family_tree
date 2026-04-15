#!/usr/bin/env python3
"""
Compare direct-ancestor relationship edges in family-tree.json to people/*.md YAML.

Scope (same idea as ancestor-tracker.md, rooted at Archer Lewis by default):
  - Everyone on a direct parent chain from the root (including the root).
  - Their spouses (other partner in each spouse union).
  - Their full siblings (other childIds on the same birth union).

For each scoped person with a standard treeId (I<number>) and a resolvable Markdown file,
compares YAML to JSON (JSON is source of truth):

  - **Parents** and **spouses** (with a personPage in JSON): full set match.
  - **Children** and **siblings**: by default only edges to people on the **blood line**
    (the root plus everyone reachable by repeatedly taking birth parents from the root).
    That matches “ancestor chart” links without requiring every cousin in frontmatter.
  - Optional ``--strict-kin`` requires every JSON child and sibling to appear in YAML.

Also flags personPage / treeId / filename mismatches when JSON carries personPage.

  python3 scripts/validate_ancestor_md_vs_json.py
  python3 scripts/validate_ancestor_md_vs_json.py --root I1
  python3 scripts/validate_ancestor_md_vs_json.py --strict-kin
  python3 scripts/validate_ancestor_md_vs_json.py --path path/to/family-tree.json
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

import yaml

REPO = Path(__file__).resolve().parents[1]
PEOPLE_DIR = REPO / "people"
SKIP_MD = frozenset({"ancestor-coverage-list.md", "person-pages-extension-plan.md"})
TREE_ID_RE = re.compile(r"^I\d+$")


def normalize_slug(item: object) -> str | None:
    if item is None:
        return None
    if isinstance(item, bool):
        return None
    if isinstance(item, int):
        s = str(item)
    elif isinstance(item, str):
        s = item.strip()
    else:
        return None
    if not s:
        return None
    s = s.replace("\\", "/")
    if s.startswith("people/"):
        s = s[7:]
    if s.lower().endswith(".md"):
        s = s[:-3]
    return s.strip() or None


def load_frontmatter(path: Path) -> dict | None:
    text = path.read_text(encoding="utf-8", errors="replace")
    if not text.startswith("---"):
        return None
    end = text.find("\n---\n", 3)
    if end == -1:
        return None
    try:
        fm = yaml.safe_load(text[3:end])
    except yaml.YAMLError:
        return None
    return fm if isinstance(fm, dict) else None


def md_parent_slugs(fm: dict) -> set[str]:
    out: set[str] = set()
    for key in ("father", "mother"):
        sl = normalize_slug(fm.get(key))
        if sl:
            out.add(sl)
    parents = fm.get("parents")
    if isinstance(parents, list):
        for p in parents:
            sl = normalize_slug(p)
            if sl:
                out.add(sl)
    elif parents is not None:
        sl = normalize_slug(parents)
        if sl:
            out.add(sl)
    return out


def md_slug_list(fm: dict, key: str) -> set[str]:
    raw = fm.get(key)
    if raw is None:
        return set()
    if isinstance(raw, list):
        return {s for s in (normalize_slug(x) for x in raw) if s}
    sl = normalize_slug(raw)
    return {sl} if sl else set()


def build_slug_to_tree_id(people_dir: Path) -> dict[str, str]:
    slug_to_tid: dict[str, str] = {}
    for path in sorted(people_dir.glob("*.md")):
        if path.name in SKIP_MD:
            continue
        fm = load_frontmatter(path)
        if not fm:
            continue
        tid = fm.get("treeId")
        if not isinstance(tid, str) or not TREE_ID_RE.match(tid.strip()):
            continue
        tid = tid.strip()
        stem = path.stem
        if stem in slug_to_tid and slug_to_tid[stem] != tid:
            print(
                f"WARN slug {stem!r} maps to both {slug_to_tid[stem]!r} and {tid!r}",
                file=sys.stderr,
            )
        slug_to_tid[stem] = tid
    return slug_to_tid


def slugs_to_ids(slugs: set[str], slug_to_tid: dict[str, str], ctx: str) -> tuple[set[str], list[str]]:
    ids: set[str] = set()
    unknown: list[str] = []
    for sl in slugs:
        tid = slug_to_tid.get(sl)
        if tid:
            ids.add(tid)
        else:
            unknown.append(f"{ctx}: unknown slug {sl!r}")
    return ids, unknown


def direct_ancestor_ids(
    root: str,
    people: dict,
    unions: dict,
) -> set[str]:
    """BFS upward along birth unions (includes root)."""
    seen: set[str] = set()
    stack = [root]
    while stack:
        pid = stack.pop()
        if pid in seen or pid not in people:
            continue
        seen.add(pid)
        bu = people[pid].get("birthUnionId")
        if not bu or not isinstance(bu, str) or bu not in unions:
            continue
        for par in unions[bu].get("partnerIds") or []:
            if par not in seen:
                stack.append(par)
    return seen


def expand_scope(
    ancestor_ids: set[str],
    people: dict,
    unions: dict,
) -> set[str]:
    scope = set(ancestor_ids)
    for pid in list(ancestor_ids):
        if pid not in people:
            continue
        rec = people[pid]
        for uid in rec.get("spouseUnionIds") or []:
            u = unions.get(uid)
            if not u:
                continue
            for q in u.get("partnerIds") or []:
                if q != pid:
                    scope.add(q)
        bu = rec.get("birthUnionId")
        if bu and bu in unions:
            for sid in unions[bu].get("childIds") or []:
                if sid != pid:
                    scope.add(sid)
    return scope


def json_parents(pid: str, people: dict, unions: dict) -> set[str]:
    if pid not in people:
        return set()
    bu = people[pid].get("birthUnionId")
    if not bu or bu not in unions:
        return set()
    return set(unions[bu].get("partnerIds") or [])


def json_children(pid: str, unions: dict) -> set[str]:
    out: set[str] = set()
    for uid, u in unions.items():
        if pid in (u.get("partnerIds") or []):
            out.update(u.get("childIds") or [])
    return out


def json_spouses(pid: str, people: dict, unions: dict) -> set[str]:
    out: set[str] = set()
    for uid in people.get(pid, {}).get("spouseUnionIds") or []:
        u = unions.get(uid)
        if not u:
            continue
        for q in u.get("partnerIds") or []:
            if q != pid:
                out.add(q)
    return out


def json_siblings(pid: str, people: dict, unions: dict) -> set[str]:
    bu = people.get(pid, {}).get("birthUnionId")
    if not bu or bu not in unions:
        return set()
    kids = set(unions[bu].get("childIds") or [])
    kids.discard(pid)
    return kids


def person_page_path(repo: Path, person_page: str | None) -> Path | None:
    if not person_page or not isinstance(person_page, str):
        return None
    p = (repo / person_page.strip()).resolve()
    try:
        p.relative_to(repo.resolve())
    except ValueError:
        return None
    return p if p.is_file() else None


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--path", type=Path, default=REPO / "family-tree.json", help="family-tree.json")
    ap.add_argument("--root", default="I7", help="Tree person id for pedigree root (default I7 Archer)")
    ap.add_argument("--people-dir", type=Path, default=PEOPLE_DIR, help="people/*.md directory")
    ap.add_argument(
        "--strict-kin",
        action="store_true",
        help="Require YAML children/siblings to match all JSON children/siblings (not only blood-line links)",
    )
    ap.add_argument(
        "--fail-on-unknown-slug",
        action="store_true",
        help="Exit non-zero when YAML references a slug with no people/*.md treeId (default: warn only)",
    )
    ap.add_argument(
        "--max-unknown-print",
        type=int,
        default=40,
        help="Cap lines printed for unknown YAML slugs (default 40)",
    )
    args = ap.parse_args()
    json_path: Path = args.path.resolve()
    repo = json_path.parent
    people_dir: Path = args.people_dir.resolve()

    if not json_path.is_file():
        print(f"Missing: {json_path}", file=sys.stderr)
        return 1
    if not people_dir.is_dir():
        print(f"Missing people dir: {people_dir}", file=sys.stderr)
        return 1

    data = json.loads(json_path.read_text(encoding="utf-8"))
    if data.get("schemaVersion") not in (1, 2):
        print("Expected schemaVersion 1 or 2", file=sys.stderr)
        return 1
    people: dict = data["people"]
    unions: dict = data["unions"]

    root = args.root.strip()
    if root not in people:
        print(f"Root {root!r} not in people", file=sys.stderr)
        return 1

    slug_to_tid = build_slug_to_tree_id(people_dir)
    tid_to_slug: dict[str, str] = {}
    for tid, rec in people.items():
        pp = rec.get("personPage")
        if isinstance(pp, str) and pp.strip():
            rel = pp.strip()
            if rel.lower().endswith(".md"):
                tid_to_slug[tid] = Path(rel).stem

    blood_ids = direct_ancestor_ids(root, people, unions)
    scope = expand_scope(blood_ids, people, unions)

    issues = 0
    page_issues = 0
    missing_page = 0
    unknown_slug_msgs: list[str] = []

    def tid_label(tid: str) -> str:
        d = people.get(tid, {})
        name = d.get("displayName", tid)
        return f"{tid} ({name})"

    print(
        f"Root {root}: {len(blood_ids)} on blood line (incl. root); "
        f"scope with spouses+siblings of those: {len(scope)} people"
        + ("; strict-kin: all JSON children/siblings required in YAML\n" if args.strict_kin else "\n")
    )

    for pid in sorted(scope, key=lambda x: (int(x[1:]) if x.startswith("I") and x[1:].isdigit() else 0, x)):
        rec = people.get(pid)
        if not rec:
            continue
        if not TREE_ID_RE.match(pid):
            continue

        pp = rec.get("personPage")
        md_path = person_page_path(repo, pp) if isinstance(pp, str) else None
        if not md_path:
            # Fall back: any people/*.md with this treeId
            candidates = [p for p in people_dir.glob("*.md") if p.name not in SKIP_MD]
            for p in candidates:
                fm0 = load_frontmatter(p)
                if fm0 and str(fm0.get("treeId", "")).strip() == pid:
                    md_path = p
                    break

        if not md_path:
            print(f"[{pid}] {rec.get('displayName', '')}: no personPage / no markdown with treeId — skipped")
            missing_page += 1
            continue

        fm = load_frontmatter(md_path)
        if not fm:
            print(f"[{pid}] {md_path}: unreadable frontmatter")
            issues += 1
            continue

        fm_tid = fm.get("treeId")
        fm_tid_s = str(fm_tid).strip() if fm_tid is not None else ""
        if fm_tid_s != pid:
            print(
                f"[{pid}] personPage {pp!r} → {md_path.name}: frontmatter treeId is {fm_tid!r}, expected {pid!r}"
            )
            page_issues += 1

        if isinstance(pp, str) and pp.strip():
            expected_stem = Path(pp.strip()).stem
            if md_path.stem != expected_stem:
                print(
                    f"[{pid}] resolved file {md_path.name!r} differs from personPage stem {expected_stem!r}"
                )
                page_issues += 1

        jp = json_parents(pid, people, unions)
        jc = json_children(pid, unions)
        js = json_spouses(pid, people, unions)
        jsi = json_siblings(pid, people, unions)

        def spouse_ids_with_page(ids: set[str]) -> set[str]:
            out: set[str] = set()
            for sid in ids:
                sp = people.get(sid, {})
                pp = sp.get("personPage")
                if isinstance(pp, str) and pp.strip():
                    out.add(sid)
            return out

        js_page = spouse_ids_with_page(js)

        md_p_slugs = md_parent_slugs(fm)
        md_c_slugs = md_slug_list(fm, "children")
        md_s_slugs = md_slug_list(fm, "spouses")
        md_si_slugs = md_slug_list(fm, "siblings")

        md_p, unk_p = slugs_to_ids(md_p_slugs, slug_to_tid, "parents")
        md_c, unk_c = slugs_to_ids(md_c_slugs, slug_to_tid, "children")
        md_s, unk_s = slugs_to_ids(md_s_slugs, slug_to_tid, "spouses")
        md_si, unk_si = slugs_to_ids(md_si_slugs, slug_to_tid, "siblings")
        unknown_slug_msgs.extend(unk_p + unk_c + unk_s + unk_si)

        def restrict_to_tree(ids: set[str]) -> set[str]:
            return {x for x in ids if x in people}

        jc_t = restrict_to_tree(jc)
        js_t = restrict_to_tree(js_page)
        jsi_t = restrict_to_tree(jsi)
        jp_t = restrict_to_tree(jp)

        if args.strict_kin:
            jc_need = jc_t
            jsi_need = jsi_t
        else:
            jc_need = jc_t & blood_ids
            jsi_need = jsi_t & blood_ids

        rel_mismatches: list[str] = []

        def diff(label: str, json_set: set[str], md_set: set[str], *, optional_extra_md: bool = False) -> None:
            missing = json_set - md_set
            extra = md_set - json_set if not optional_extra_md else set()
            if missing or extra:
                parts = []
                if missing:
                    parts.append(f"JSON has not in MD: {{{', '.join(tid_label(x) for x in sorted(missing, key=str))}}}")
                if extra:
                    parts.append(f"MD has not in JSON: {{{', '.join(tid_label(x) for x in sorted(extra, key=str))}}}")
                rel_mismatches.append(f"  {label}: " + "; ".join(parts))

        diff("parents", jp_t, md_p)
        diff("children", jc_need, md_c, optional_extra_md=not args.strict_kin)
        diff("spouses", js_t, md_s)
        diff("siblings", jsi_need, md_si, optional_extra_md=not args.strict_kin)

        if rel_mismatches:
            print(f"\n[{pid}] {tid_label(pid)} — {md_path.relative_to(repo)}")
            for line in rel_mismatches:
                print(line)
            issues += 1

    uniq_unknown = sorted(set(unknown_slug_msgs))
    if uniq_unknown:
        cap = max(0, args.max_unknown_print)
        for msg in uniq_unknown[:cap]:
            print(f"UNKNOWN {msg}")
        if len(uniq_unknown) > cap:
            print(f"... and {len(uniq_unknown) - cap} more unknown slug reference(s)")

    if page_issues:
        print(f"\n{page_issues} personPage/treeId alignment issue(s)")

    if missing_page:
        print(f"{missing_page} scoped person(s) with no markdown / personPage")

    print(
        f"\nDone: {issues} person(s) with relationship mismatch(es), "
        f"{page_issues} page/id alignment issue(s), "
        f"{missing_page} missing page(s), "
        f"{len(uniq_unknown)} unknown YAML slug reference(s)."
    )
    bad = issues or page_issues or (args.fail_on_unknown_slug and len(uniq_unknown) > 0)
    return 1 if bad else 0


if __name__ == "__main__":
    raise SystemExit(main())
