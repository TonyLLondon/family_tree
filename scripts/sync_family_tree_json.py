#!/usr/bin/env python3
"""
Sync optional person fields into family-tree.json with **JSON + vault as master** and
GEDCOM only **backfilling gaps**.

Order per person:
  1. Keep existing optional keys already in JSON (hand edits preserved).
  2. Apply people/*.md frontmatter for matching treeId — any key present in YAML overwrites.
  3. If --gedcom-fill (default): fill only keys still empty from GEDCOM (never overwrites).

  .venv/bin/python scripts/sync_family_tree_json.py
  .venv/bin/python scripts/sync_family_tree_json.py --no-gedcom-fill
  .venv/bin/python scripts/sync_family_tree_json.py --dry-run

YAML → JSON (when set in frontmatter):
  born, died, birth_place, death_place, sex, also_known_as, nationality, burial, role, era,
  born_alt → birthDateAlt, display_name → displayName (optional override of GEDCOM name)
  ignore_gedcom_death: true — drop death* fields and do not gap-fill death from GEDCOM (narrative “unknown”).
  ignore_gedcom_birth: true — do not gap-fill birth date/place from GEDCOM.

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
DEFAULT_GED = REPO / "archive" / "gedcom" / "Upload for MyHeritage 200929.ged"
DEFAULT_JSON = REPO / "family-tree.json"
PEOPLE_DIR = REPO / "people"

SKIP_MD = frozenset({"ancestor-coverage-list.md", "person-pages-extension-plan.md"})

# Synced optional keys (removed then re-applied each run). Never strip core id/displayName/union ids.
SYNC_KEYS = frozenset(
    {
        "sex",
        "birthDate",
        "deathDate",
        "birthPlace",
        "deathPlace",
        "birthDateGedcom",
        "deathDateGedcom",
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

_MONTHS = {
    "JAN": 1,
    "FEB": 2,
    "MAR": 3,
    "APR": 4,
    "MAY": 5,
    "JUN": 6,
    "JUL": 7,
    "AUG": 8,
    "SEP": 9,
    "OCT": 10,
    "NOV": 11,
    "DEC": 12,
}


def normalize_gedcom_date(s: str) -> str:
    s = (s or "").strip()
    if not s:
        return ""
    upper = s.upper()
    for qual in ("ABT", "BEF", "AFT", "CAL", "EST"):
        prefix = qual + " "
        if upper.startswith(prefix):
            rest = normalize_gedcom_date(s[len(prefix) :].strip())
            return f"{qual} {rest}".strip() if rest else s
    if upper.startswith("BET ") and " AND " in upper:
        return s
    parts = s.split()
    if (
        len(parts) == 3
        and parts[0].isdigit()
        and parts[1].upper() in _MONTHS
        and parts[2].isdigit()
        and len(parts[2]) == 4
    ):
        d, m, y = int(parts[0]), _MONTHS[parts[1].upper()], int(parts[2])
        return f"{y:04d}-{m:02d}-{d:02d}"
    if len(parts) == 1 and parts[0].isdigit() and len(parts[0]) == 4:
        return parts[0]
    return s


def extract_indi_vitals(block_lines: list[str]) -> dict:
    sex = None
    births: list[dict] = []
    deaths: list[dict] = []
    i = 0
    n = len(block_lines)
    while i < n:
        line = block_lines[i]
        if not line or line[0] not in "0123456789":
            i += 1
            continue
        lvl_end = line.find(" ")
        if lvl_end < 1:
            i += 1
            continue
        try:
            lvl = int(line[:lvl_end])
        except ValueError:
            i += 1
            continue
        rest = line[lvl_end + 1 :]
        if lvl == 1 and rest.startswith("SEX "):
            sex = rest[4:].strip()[:1] or None
            i += 1
            continue
        if lvl == 1 and rest in ("BIRT", "DEAT"):
            tag = rest
            rec = {"date_raw": None, "place": None, "prim": False}
            i += 1
            while i < n:
                L = block_lines[i]
                if not L or L[0] not in "0123456789":
                    i += 1
                    continue
                le = L.find(" ")
                if le < 1:
                    i += 1
                    continue
                try:
                    l2 = int(L[:le])
                except ValueError:
                    i += 1
                    continue
                if l2 <= 1:
                    break
                r = L[le + 1 :]
                if r.startswith("DATE "):
                    rec["date_raw"] = r[5:].strip()
                elif r.startswith("PLAC "):
                    rec["place"] = r[5:].strip()
                elif r.startswith("_PRIM "):
                    rec["prim"] = "Y" in r
                i += 1
            if tag == "BIRT":
                births.append(rec)
            else:
                deaths.append(rec)
            continue
        i += 1

    def pick(events: list[dict]) -> dict | None:
        if not events:
            return None
        for e in events:
            if e.get("prim"):
                return e
        return events[0]

    b, d = pick(births), pick(deaths)
    out: dict = {}
    if sex:
        out["sex"] = sex
    if b and b.get("date_raw"):
        out["birthDate"] = normalize_gedcom_date(b["date_raw"])
        out["birthDateGedcom"] = b["date_raw"]
    if b and b.get("place"):
        out["birthPlace"] = b["place"]
    if d and d.get("date_raw"):
        out["deathDate"] = normalize_gedcom_date(d["date_raw"])
        out["deathDateGedcom"] = d["date_raw"]
    if d and d.get("place"):
        out["deathPlace"] = d["place"]
    return out


def parse_gedcom(path: Path) -> dict[str, dict]:
    lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    vitals: dict[str, dict] = {}
    i = 0
    while i < len(lines):
        line = lines[i]
        m = re.match(r"^0 @(I\d+)@ INDI\s*$", line)
        if not m:
            i += 1
            continue
        pid = m.group(1)
        i += 1
        block: list[str] = []
        while i < len(lines):
            L = lines[i]
            if re.match(r"^0 @", L):
                break
            block.append(L)
            i += 1
        vitals[pid] = extract_indi_vitals(block)
    return vitals


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

    if fm.get("ignore_gedcom_death") is True:
        rec["_ignoreGedcomDeath"] = True
    if fm.get("ignore_gedcom_birth") is True:
        rec["_ignoreGedcomBirth"] = True

    disp_raw = fm.get("display_name")
    if isinstance(disp_raw, str):
        disp = disp_raw.strip()
        if disp and disp.lower() != "unknown":
            # Do not use clean_md_vital: parentheticals (e.g. b. 1800) are intentional disambiguators.
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


def merge_person_vitals(
    existing: dict,
    vault: dict,
    ged: dict,
    *,
    gedcom_fill: bool,
    ignore_gedcom_death: bool = False,
    ignore_gedcom_birth: bool = False,
) -> dict:
    """existing = current person record in JSON."""
    out: dict = {}
    for k in SYNC_KEYS:
        if k in existing and not is_empty(existing[k]):
            out[k] = existing[k]

    for k, v in vault.items():
        if not is_empty(v):
            out[k] = v

    if vault.get("birthDate"):
        out.pop("birthDateGedcom", None)
    if vault.get("deathDate"):
        out.pop("deathDateGedcom", None)

    if ignore_gedcom_death:
        out.pop("deathDate", None)
        out.pop("deathDateGedcom", None)
        out.pop("deathPlace", None)

    if not gedcom_fill:
        return out

    gap_keys = [
        ("sex", "sex", None),
        ("birthDate", "birthDate", "birthDateGedcom"),
        ("birthPlace", "birthPlace", None),
        ("deathDate", "deathDate", "deathDateGedcom"),
        ("deathPlace", "deathPlace", None),
    ]
    for ged_k, out_k, raw_k in gap_keys:
        if ged_k == "birthDate" and ignore_gedcom_birth:
            continue
        if ged_k == "birthPlace" and ignore_gedcom_birth:
            continue
        if ged_k == "deathDate" and ignore_gedcom_death:
            continue
        if ged_k == "deathPlace" and ignore_gedcom_death:
            continue
        if is_empty(out.get(out_k)) and ged.get(ged_k):
            out[out_k] = ged[ged_k]
            if raw_k and ged.get(raw_k):
                out[raw_k] = ged[raw_k]

    return out


def main() -> int:
    ap = argparse.ArgumentParser(description="Sync family-tree.json from vault + optional GEDCOM gap-fill")
    ap.add_argument("--gedcom", type=Path, default=DEFAULT_GED)
    ap.add_argument("--json", type=Path, default=DEFAULT_JSON)
    ap.add_argument("--no-gedcom-fill", action="store_true", help="Vault + existing JSON only; no GEDCOM")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    data = json.loads(args.json.read_text(encoding="utf-8"))
    ver = data.get("schemaVersion")
    if ver not in (1, 2):
        print(f"Unsupported schemaVersion {ver!r} (expected 1 or 2)", file=sys.stderr)
        return 1

    ged = parse_gedcom(args.gedcom.resolve()) if not args.no_gedcom_fill else {}
    vault_by_id = load_vault_by_tree_id()

    n_vault = 0
    people = data.get("people", {})
    for pid, rec in people.items():
        v = dict(vault_by_id.get(pid, {}))
        ignore_death = bool(v.pop("_ignoreGedcomDeath", False))
        ignore_birth = bool(v.pop("_ignoreGedcomBirth", False))
        g = ged.get(pid, {})
        if v:
            n_vault += 1
        merged = merge_person_vitals(
            rec,
            v,
            g,
            gedcom_fill=not args.no_gedcom_fill,
            ignore_gedcom_death=ignore_death,
            ignore_gedcom_birth=ignore_birth,
        )

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
        "displayName — from GEDCOM; overridden when people/*.md sets display_name",
        "birthUnionId",
        "spouseUnionIds",
        "personPage — repo-relative people/*.md when treeId set",
        "sex, birthDate, deathDate, birthPlace, deathPlace (optional)",
        "birthDateAlt — alternate birth from research (e.g. GEDCOM vs passport)",
        "birthDateGedcom, deathDateGedcom — raw GEDCOM DATE when date was gap-filled from .ged",
        "alsoKnownAs[], nationality, role, era, burialPlace (optional)",
    ]
    cov["omittedFromGedcom"] = [
        "RESI, OCCU, EVEN, NOTE, SOUR (not merged)",
        "OBJE (photos), _UID, _FSFTID, vendor-specific tags",
        "Secondary names beyond the first NAME line",
        "Full GEDCOM text and citation detail",
    ]
    cov["intent"] = (
        "family-tree.json is the structured master: people/*.md (treeId) updates it; "
        "GEDCOM only fills missing vitals when present. Narrative and citations stay in Markdown and sources/."
    )
    meta["note"] = (
        "Sole authoritative structured tree for this repository and web app. "
        "Sync: .venv/bin/python scripts/sync_family_tree_json.py (vault master; GEDCOM gap-fill default)."
    )

    if args.dry_run:
        mode = "vault+gedcom-fill" if not args.no_gedcom_fill else "vault-only"
        print(f"Dry-run ({mode}): {len(vault_by_id)} treeIds in vault; would update JSON")
        return 0

    args.json.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(
        f"Wrote {args.json.name}: vault treeIds={len(vault_by_id)}; "
        f"gedcom gap-fill={'on' if not args.no_gedcom_fill else 'off'}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
