#!/usr/bin/env python3
"""
Validate repository root family-tree.json (schema + referential sanity).

  .venv/bin/python scripts/validate_family_tree_json.py
  .venv/bin/python scripts/validate_family_tree_json.py --path path/to/tree.json

Also reports (stdout):
  - JSON individuals outside the direct *blood* line from Archer & Sloan (I7, I6)
  - people/*.md with treeId outside that line (“vault pages for collateral”)
  - Direct-line individuals with no personPage (optional backlog)

Requires PyYAML for vault scanning (same venv as sync_family_tree_json.py).
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

try:
    import yaml
except ImportError:
    yaml = None  # type: ignore

SKIP_MD = frozenset({"ancestor-coverage-list.md", "person-pages-extension-plan.md"})
TREE_ID_RE = re.compile(r"^I\d+$")


def blood_direct_line_ids(
    people: dict, unions: dict, root_ids: list[str]
) -> set[str]:
    """All individuals reachable by walking birthUnionId → parents from each root."""
    out: set[str] = set(root_ids)
    stack = [r for r in root_ids if r in people]
    while stack:
        pid = stack.pop()
        rec = people.get(pid)
        if not rec:
            continue
        bu = rec.get("birthUnionId")
        if not bu:
            continue
        u = unions.get(bu)
        if not u:
            continue
        for par in u.get("partnerIds") or []:
            if par in people and par not in out:
                out.add(par)
                stack.append(par)
    return out


def vault_tree_ids(repo: Path) -> list[tuple[str, str]]:
    """Return (relative_path, treeId) for each people/*.md with valid treeId."""
    if yaml is None:
        return []
    rows: list[tuple[str, str]] = []
    people_dir = repo / "people"
    if not people_dir.is_dir():
        return rows
    for f in sorted(people_dir.glob("*.md")):
        if f.name in SKIP_MD:
            continue
        text = f.read_text(encoding="utf-8", errors="replace")
        if not text.startswith("---"):
            continue
        end = text.find("\n---\n", 3)
        if end == -1:
            continue
        try:
            fm = yaml.safe_load(text[3:end])
        except yaml.YAMLError:
            continue
        if not isinstance(fm, dict):
            continue
        tid = fm.get("treeId")
        if not tid or not isinstance(tid, str):
            continue
        tid = tid.strip().strip('"').strip("'")
        if not TREE_ID_RE.match(tid):
            continue
        rows.append((str(f.relative_to(repo)), tid))
    return rows


def _print_limited(title: str, lines: list[str], max_show: int) -> None:
    print(f"\n--- {title} ---")
    if not lines:
        print("(none)")
        return
    if len(lines) <= max_show:
        for ln in lines:
            print(ln)
        return
    for ln in lines[:max_show]:
        print(ln)
    print(f"... and {len(lines) - max_show} more (use --direct-list-limit 0 for all)")


def main() -> int:
    repo = Path(__file__).resolve().parents[1]
    ap = argparse.ArgumentParser(description="Validate family-tree.json")
    ap.add_argument("--path", type=Path, default=repo / "family-tree.json")
    ap.add_argument(
        "--no-direct-line-report",
        action="store_true",
        help="Skip Archer/Sloan direct-line vs collateral report",
    )
    ap.add_argument(
        "--direct-roots",
        default="I7,I6",
        help="Comma-separated person ids for direct blood line (default: I7,I6 Archer & Sloan)",
    )
    ap.add_argument(
        "--direct-list-limit",
        type=int,
        default=80,
        help="Max lines per list (0 = no limit)",
    )
    args = ap.parse_args()
    path: Path = args.path.resolve()
    if not path.is_file():
        print(f"Missing: {path}", file=sys.stderr)
        return 1

    data = json.loads(path.read_text(encoding="utf-8"))
    sv = data.get("schemaVersion")
    if sv not in (1, 2):
        print(f"Expected schemaVersion 1 or 2, got {sv!r}", file=sys.stderr)
        return 1
    for key in ("people", "unions", "graph"):
        if key not in data:
            print(f"Missing top-level key: {key}", file=sys.stderr)
            return 1

    people = data["people"]
    unions = data["unions"]
    g = data["graph"]
    nodes = {n["id"]: n for n in g.get("nodes", [])}
    errs = 0

    allowed_vital = frozenset({
        "birthDate",
        "deathDate",
        "birthPlace",
        "deathPlace",
        "birthDateGedcom",
        "deathDateGedcom",
        "birthDateAlt",
        "sex",
        "alsoKnownAs",
        "nationality",
        "burialPlace",
        "role",
        "era",
        "personPage",
    })
    for pid, rec in people.items():
        if rec.get("id") != pid:
            print(f"people[{pid}].id mismatch", file=sys.stderr)
            errs += 1
        if sv == 2:
            for k in rec:
                if k in ("id", "displayName", "birthUnionId", "spouseUnionIds"):
                    continue
                if k not in allowed_vital:
                    print(f"people[{pid}] unknown field {k!r} (schema 2)", file=sys.stderr)
                    errs += 1
            sx = rec.get("sex")
            if sx is not None and (not isinstance(sx, str) or len(sx) != 1):
                print(f"people[{pid}] sex must be null or one-letter string", file=sys.stderr)
                errs += 1
            aka = rec.get("alsoKnownAs")
            if aka is not None:
                if not isinstance(aka, list) or not all(isinstance(x, str) for x in aka):
                    print(f"people[{pid}] alsoKnownAs must be a list of strings", file=sys.stderr)
                    errs += 1
            for sk in ("nationality", "burialPlace", "role", "era", "birthDateAlt", "personPage"):
                v = rec.get(sk)
                if v is not None and not isinstance(v, str):
                    print(f"people[{pid}] {sk} must be string or null", file=sys.stderr)
                    errs += 1
        bu = rec.get("birthUnionId")
        if bu is not None and bu not in unions:
            print(f"people[{pid}] birthUnionId {bu!r} missing from unions", file=sys.stderr)
            errs += 1
        for uid in rec.get("spouseUnionIds") or []:
            if uid not in unions:
                print(f"people[{pid}] spouseUnionIds references missing {uid!r}", file=sys.stderr)
                errs += 1
        pp = rec.get("personPage")
        if pp and isinstance(pp, str) and pp.strip():
            rel = path.parent / pp.replace("\\", "/")
            if not rel.is_file():
                print(
                    f"people[{pid}] personPage path not found: {pp!r}",
                    file=sys.stderr,
                )
                errs += 1

    for uid, u in unions.items():
        if u.get("id") != uid:
            print(f"unions[{uid}].id mismatch", file=sys.stderr)
            errs += 1
        for par in u.get("partnerIds") or []:
            if par not in people:
                print(f"unions[{uid}] unknown partner {par!r}", file=sys.stderr)
                errs += 1
        for ch in u.get("childIds") or []:
            if ch not in people:
                print(f"unions[{uid}] unknown child {ch!r}", file=sys.stderr)
                errs += 1

    for e in g.get("edges", []):
        a, b = e.get("from"), e.get("to")
        if a not in nodes or b not in nodes:
            print(f"edge {e!r} references unknown node", file=sys.stderr)
            errs += 1

    n_p, n_u = len(people), len(unions)
    print(f"OK {path.name}: {n_p} people, {n_u} unions, {len(g.get('edges', []))} edges")

    if not args.no_direct_line_report:
        roots = [r.strip() for r in args.direct_roots.split(",") if r.strip()]
        missing_roots = [r for r in roots if r not in people]
        if missing_roots:
            print(
                f"\n--- Direct line ---\nWARNING: --direct-roots not in JSON: {missing_roots}",
                file=sys.stderr,
            )
        direct = blood_direct_line_ids(people, unions, roots)
        outside_json = sorted(set(people) - direct)
        lim = args.direct_list_limit
        max_show = lim if lim > 0 else 10**9

        json_lines = []
        for pid in outside_json:
            dn = people[pid].get("displayName", "")
            json_lines.append(f"  {pid}\t{dn}")

        md_outside: list[tuple[str, str]] = []
        md_orphan: list[tuple[str, str]] = []
        if yaml is None:
            print(
                "\n--- Direct line report skipped: install PyYAML (use project .venv) ---",
                file=sys.stderr,
            )
        else:
            for rel, tid in vault_tree_ids(repo):
                if tid not in people:
                    md_orphan.append((rel, tid))
                elif tid not in direct:
                    md_outside.append((rel, tid))

        md_out_lines = []
        for rel, tid in sorted(md_outside, key=lambda x: (x[1], x[0])):
            dn = people.get(tid, {}).get("displayName", "?")
            md_out_lines.append(f"  {rel}\t{tid}\t{dn}")

        md_orphan_lines = [
            f"  {rel}\t{tid} (no JSON person)"
            for rel, tid in sorted(md_orphan, key=lambda x: (x[1], x[0]))
        ]

        no_page = []
        for pid in sorted(direct):
            if not people[pid].get("personPage"):
                dn = people[pid].get("displayName", "")
                no_page.append(f"  {pid}\t{dn}")

        print("\n--- Direct blood line (Archer I7 & Sloan I6 ancestors + selves) ---")
        print(
            "Scope: strict blood ancestry via birthUnionId → parents only "
            "(same as ahnentafel walk; not spouses unless they are a parent in a birth union)."
        )
        print(
            "Note: duplicate individuals in JSON (e.g. Fensom I202 vs I294) can leave "
            "real ancestors listed as ‘outside’ until unions are merged."
        )
        print(f"In closure: {len(direct)} individuals (roots {', '.join(roots)})")
        print(
            f"NOT in direct blood line (JSON / import collateral): {len(outside_json)} individuals"
        )
        _print_limited(
            "JSON individuals outside direct line (id + displayName)",
            json_lines,
            max_show,
        )
        _print_limited(
            "people/*.md treeId outside direct line (collateral vault pages)",
            md_out_lines,
            max_show,
        )
        if md_orphan_lines:
            _print_limited(
                "people/*.md treeId not in JSON at all",
                md_orphan_lines,
                max_show,
            )
        _print_limited(
            "Direct-line individuals with no personPage in JSON",
            no_page,
            max_show,
        )

    return 1 if errs else 0


if __name__ == "__main__":
    raise SystemExit(main())
