#!/usr/bin/env python3
"""
Validate repository root family-tree.json (schema + referential sanity).

  python3 scripts/validate_family_tree_json.py
  python3 scripts/validate_family_tree_json.py --path path/to/tree.json
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    p = argparse.ArgumentParser()
    p.add_argument("--path", type=Path, default=root / "family-tree.json")
    args = p.parse_args()
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
    return 1 if errs else 0


if __name__ == "__main__":
    raise SystemExit(main())
