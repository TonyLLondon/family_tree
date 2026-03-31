#!/usr/bin/env python3
"""
Sync optional person fields into family-tree.json from people/*.md frontmatter.

family-tree.json is the sole structured master. This script applies vault
frontmatter (people/*.md with treeId) on top of whatever is already in the JSON,
preserving hand-edited fields.

Order per person:
  1. Keep existing optional keys already in JSON (hand edits preserved).
  2. Apply people/*.md frontmatter for matching treeId — any key present in YAML overwrites.

  .venv/bin/python scripts/sync_family_tree_json.py
  .venv/bin/python scripts/sync_family_tree_json.py --dry-run

YAML → JSON (when set in frontmatter):
  born, died, birth_place, death_place, sex, also_known_as, nationality, burial, role, era,
  born_alt → birthDateAlt, display_name → displayName (optional override)

See AGENTS.md and meta.coverage in family-tree.json after run.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

import yaml

REPO = Path(__file__).resolve().parents[1]
DEFAULT_JSON = REPO / "family-tree.json"
PEOPLE_DIR = REPO / "people"

SKIP_MD = frozenset({"ancestor-coverage-list.md", "person-pages-extension-plan.md"})

SYNC_KEYS = frozenset(
    {
        "sex",
        "birthDate",
        "deathDate",
        "birthPlace",
        "deathPlace",
        "birthDateAlt",
        "alsoKnownAs",
        "nationality",
        "burialPlace",
        "role",
        "era",
        "displayNameOverride",
        "personPage",
    }
)


def clean_md_vital(val) -> str | None:
    if val is None:
        return None
    if isinstance(val, bool):
        return None
    if isinstance(val, int):
        return str(val)
    s = str(val).strip()
    if not s or s.lower() == "unknown":
        return None
    if " (" in s:
        s = s.split(" (", 1)[0].strip()
    return s or None


def _also_known_as_list(fm: dict) -> list[str] | None:
    v = fm.get("also_known_as")
    if v is None:
        return None
    if isinstance(v, str):
        s = v.strip()
        return [s] if s else None
    if isinstance(v, list):
        out = [str(x).strip() for x in v if str(x).strip()]
        return out or None
    return None


def vault_record_from_file(path: Path) -> tuple[str, dict] | None:
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
    if not isinstance(fm, dict):
        return None
    tid = fm.get("treeId")
    if not tid or not isinstance(tid, str):
        return None
    tid = tid.strip()
    if not re.match(r"^I\d+$", tid):
        return None

    rec: dict = {}
    b = clean_md_vital(fm.get("born"))
    d = clean_md_vital(fm.get("died"))
    bp = clean_md_vital(fm.get("birth_place"))
    dp = clean_md_vital(fm.get("death_place"))
    sx = fm.get("sex")
    if isinstance(sx, str) and sx.strip():
        rec["sex"] = sx.strip()[:1].upper()

    if b:
        rec["birthDate"] = b
    if d:
        rec["deathDate"] = d
    if bp:
        rec["birthPlace"] = bp
    if dp:
        rec["deathPlace"] = dp

    aka = _also_known_as_list(fm)
    if aka:
        rec["alsoKnownAs"] = aka

    for yaml_key, json_key in (
        ("nationality", "nationality"),
        ("role", "role"),
        ("era", "era"),
    ):
        v = clean_md_vital(fm.get(yaml_key))
        if v:
            rec[json_key] = v

    bur = clean_md_vital(fm.get("burial")) or clean_md_vital(fm.get("burial_place"))
    if bur:
        rec["burialPlace"] = bur

    alt_b = clean_md_vital(fm.get("born_alt"))
    if alt_b:
        rec["birthDateAlt"] = alt_b

    disp_raw = fm.get("display_name")
    if isinstance(disp_raw, str):
        disp = disp_raw.strip()
        if disp and disp.lower() != "unknown":
            rec["displayNameOverride"] = disp

    rec["personPage"] = f"people/{path.name}"
    return tid, rec


def load_vault_by_tree_id() -> dict[str, dict]:
    out: dict[str, dict] = {}
    for p in sorted(PEOPLE_DIR.glob("*.md")):
        if p.name in SKIP_MD:
            continue
        got = vault_record_from_file(p)
        if got:
            tid, rec = got
            out[tid] = rec
    return out


def is_empty(v) -> bool:
    return v is None or v == "" or v == []


def merge_person(existing: dict, vault: dict) -> dict:
    """Merge: existing JSON fields preserved, then vault overwrites."""
    out: dict = {}
    for k in SYNC_KEYS:
        if k in existing and not is_empty(existing[k]):
            out[k] = existing[k]

    for k, v in vault.items():
        if not is_empty(v):
            out[k] = v

    return out


def main() -> int:
    ap = argparse.ArgumentParser(description="Sync family-tree.json from vault (people/*.md frontmatter)")
    ap.add_argument("--json", type=Path, default=DEFAULT_JSON)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    data = json.loads(args.json.read_text(encoding="utf-8"))
    ver = data.get("schemaVersion")
    if ver not in (1, 2):
        print(f"Unsupported schemaVersion {ver!r} (expected 1 or 2)", file=sys.stderr)
        return 1

    vault_by_id = load_vault_by_tree_id()

    n_vault = 0
    people = data.get("people", {})
    for pid, rec in people.items():
        v = vault_by_id.get(pid, {})
        if v:
            n_vault += 1
        merged = merge_person(rec, v)

        for k in list(rec.keys()):
            if k in SYNC_KEYS:
                del rec[k]
        for k, val in merged.items():
            if k == "displayNameOverride":
                continue
            if not is_empty(val):
                rec[k] = val
        ovr = merged.get("displayNameOverride")
        if ovr:
            rec["displayName"] = ovr

    data["schemaVersion"] = 2
    meta = data.setdefault("meta", {})
    cov = meta.setdefault("coverage", {})
    cov["perPersonFields"] = [
        "id",
        "displayName — overridden when people/*.md sets display_name",
        "birthUnionId",
        "spouseUnionIds",
        "personPage — repo-relative people/*.md when treeId set",
        "sex, birthDate, deathDate, birthPlace, deathPlace (optional)",
        "birthDateAlt — alternate birth from research",
        "alsoKnownAs[], nationality, role, era, burialPlace (optional)",
    ]
    cov.pop("omittedFromGedcom", None)
    cov["intent"] = (
        "family-tree.json is the sole structured master. "
        "people/*.md frontmatter (treeId) updates optional fields via sync. "
        "Narrative and citations stay in Markdown and sources/."
    )
    meta["note"] = (
        "Sole authoritative structured tree for this repository and web app. "
        "Sync: .venv/bin/python scripts/sync_family_tree_json.py"
    )

    if args.dry_run:
        print(f"Dry-run: {len(vault_by_id)} treeIds in vault; would update JSON")
        return 0

    args.json.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {args.json.name}: vault treeIds={len(vault_by_id)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
