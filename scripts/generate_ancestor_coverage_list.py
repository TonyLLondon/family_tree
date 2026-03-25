#!/usr/bin/env python3
"""
Build people/ancestor-coverage-list.md: strict ancestors of @I1@ in
archive/gedcom/Upload for MyHeritage 200929.ged (father/mother chain only).

  python scripts/generate_ancestor_coverage_list.py
"""

from __future__ import annotations

import re
from collections import deque
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
GED = REPO / "archive" / "gedcom" / "Upload for MyHeritage 200929.ged"
OUT = REPO / "people" / "ancestor-coverage-list.md"
START = "@I1@"

# GEDCOM @...@ -> existing people/*.md stem (vault canonical filenames)
MANUAL_STEM: dict[str, str] = {
    "@I326@": "daoud-khan-saginian",  # export: David Khan Saginian
    "@I80@": "anna-saginian",
    "@I79@": "edward-burgess",
    "@I78@": "fanny-burgess",  # Frances Burgess
    "@I77@": "julien-bottin",
    "@I76@": "henriette-bottin",
    "@I16@": "etienne-stump",
    "@I14@": "antonio-zerauschek",  # junior line (Fulvia’s father in tree)
    "@I25@": "antonio-zerauschek-senior",  # distinct — also named Antonio Zerauschek
    "@I1@": "anthony-robert-lewis",
    "@I2@": "ivor-anthony-samuel-lewis",
    "@I3@": "catherine-stump",
    "@I8@": "david-john-lewis",
    "@I173@": "david-john-lewis-1857",  # Samuel’s father; namesake of @I8@ grandson
    "@I9@": "fulvia-ottilia-antonia-zerauschek",
    "@I10@": "maureen-catherine-finbarr-white",
    "@I11@": "robert-marc-murard-stump",
    "@I12@": "gerald-sebastian-white",
    "@I13@": "mary-oshea",
    "@I81@": "henry-burgess",
    "@I82@": "frances-ridsdale",
    "@I103@": "archibald-percy-coolbear",
    "@I118@": "cornelius-oshea",
    "@I119@": "catherine-enright",
    "@I136@": "catherine-mary-roche",
    "@I137@": "william-roche",
    "@I138@": "charles-bottin",
    "@I139@": "josephine-baudouin",
    "@I140@": "marc-francois-stump",
    "@I142@": "hans-jacob-stump-1800",
    "@I151@": "hans-jacob-stump-1674",
    "@I135@": "william-obyrne-white",
    "@I15@": "ester-addobbati",
    "@I360@": "eliza-knight",
    "@I141@": "olga-caroline-erbe",
    "@I17@": "samuel-lewis",
    "@I28@": "elizabeth-lilian-cushen",
    "@I20@": "pietro-pio-addobbati",
    "@I21@": "ottilia-anna-vincenza-boara",
    "@I175@": "david-cushen",
    "@I176@": "mary-morgan",
}


def parse_gedcom(lines: list[str]) -> tuple[dict, dict]:
    indis: dict[str, dict] = {}
    fams: dict[str, dict] = {}
    cur_id = None
    cur_type = None
    for line in lines:
        if line.startswith("0 "):
            m = re.match(r"^0 (@[^@]+@) (\w+)", line)
            if m:
                cur_id, cur_type = m.group(1), m.group(2)
                if cur_type == "INDI":
                    indis[cur_id] = {"name": "", "famc": None}
                elif cur_type == "FAM":
                    fams[cur_id] = {"husb": None, "wife": None, "chil": []}
            else:
                cur_id, cur_type = None, None
            continue
        if cur_id is None:
            continue
        if cur_type == "INDI" and cur_id in indis:
            if line.startswith("1 NAME "):
                indis[cur_id]["name"] = line[7:].strip()
            elif line.startswith("1 FAMC "):
                m = re.search(r"(@[^@]+@)", line)
                if m:
                    indis[cur_id]["famc"] = m.group(1)
        elif cur_type == "FAM" and cur_id in fams:
            if line.startswith("1 HUSB "):
                m = re.search(r"(@[^@]+@)", line)
                if m:
                    fams[cur_id]["husb"] = m.group(1)
            elif line.startswith("1 WIFE "):
                m = re.search(r"(@[^@]+@)", line)
                if m:
                    fams[cur_id]["wife"] = m.group(1)
            elif line.startswith("1 CHIL "):
                m = re.search(r"(@[^@]+@)", line)
                if m:
                    fams[cur_id]["chil"].append(m.group(1))
    return indis, fams


def parse_name(raw: str) -> tuple[str, str]:
    raw = raw.strip()
    if not raw:
        return "", ""
    parts = raw.split("/")
    if len(parts) >= 3:
        return parts[0].strip(), parts[1].strip()
    return raw, ""


def base_slug(given: str, surn: str) -> str:
    s = f"{given} {surn}".lower()
    s = s.replace("'", "").replace("’", "")
    s = re.sub(r"[,.\[\]()]", " ", s)
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s or "unknown"


def assign_stems(indis: dict, ancestors: set[str]) -> dict[str, str]:
    """Map each INDI to target people/*.md stem; disambiguate duplicate base slugs."""
    slug_counts: dict[str, int] = {}
    stems: dict[str, str] = {}
    for iid in sorted(ancestors, key=lambda x: indis[x]["name"]):
        if iid in MANUAL_STEM:
            stems[iid] = MANUAL_STEM[iid]
            continue
        given, surn = parse_name(indis[iid]["name"])
        base = base_slug(given, surn)
        slug_counts[base] = slug_counts.get(base, 0) + 1
        n = slug_counts[base]
        stem = base if n == 1 else f"{base}-{n}"
        stems[iid] = stem
    return stems


def bfs_generations(indis: dict, fams: dict) -> tuple[dict[str, int], set[str]]:
    gen: dict[str, int] = {}
    dq = deque([(START, 0)])
    while dq:
        iid, g = dq.popleft()
        if iid not in indis or iid in gen:
            continue
        gen[iid] = g
        famc = indis[iid].get("famc")
        if not famc or famc not in fams:
            continue
        f = fams[famc]
        for p in (f["husb"], f["wife"]):
            if p and p in indis:
                dq.append((p, g + 1))
    return gen, set(gen)


def main() -> int:
    lines = GED.read_text(encoding="utf-8", errors="replace").splitlines()
    indis, fams = parse_gedcom(lines)
    gen, ancestors = bfs_generations(indis, fams)
    stems = assign_stems(indis, ancestors)
    skip = {"ancestor-coverage-list"}
    existing = {
        p.stem for p in (REPO / "people").glob("*.md") if p.stem not in skip
    }

    by_gen: dict[int, list[str]] = {}
    for iid, g in gen.items():
        by_gen.setdefault(g, []).append(iid)

    o: list[str] = []
    o.append("# Ancestor coverage list (strict parent chain)\n\n")
    o.append(
        "**Anchor:** Anthony Robert (Tony) Lewis — GEDCOM "
        "`archive/gedcom/Upload for MyHeritage 200929.ged`, individual **`@I1@`**.\n\n"
    )
    o.append(
        "**Rule:** Only people who appear as **father or mother** walking up from the anchor "
        "(each person’s `FAMC` → family → `HUSB` / `WIFE`). "
        "No siblings, no spouses except as they are themselves ancestors, "
        "and no parallel lines that are not on the path to `@I1@`.\n\n"
    )
    o.append(
        "**Not on this list (collateral Persia line):** "
        "[Tamar Saginian](tamar-saginian.md) and [Dr. William Cormick](william-cormick.md) "
        "— Anna’s sister line; keep separate narrative pages.\n\n"
    )
    o.append(f"**Total distinct ancestors in this export:** {len(ancestors)}\n\n")
    o.append(
        "**`people/` target** = manual map or generated slug; "
        "**Has page?** = file exists today under `people/`.\n\n"
        "---\n"
    )

    maxg = max(gen.values())
    for g in range(0, maxg + 1):
        o.append(f"\n## Generation {g}\n\n")
        o.append("| GEDCOM | Name (export) | Target `people/` file | Has page? |\n")
        o.append("|--------|---------------|----------------------|----------|\n")
        for iid in sorted(by_gen[g], key=lambda x: indis[x]["name"]):
            raw = indis[iid]["name"].replace("|", "\\|")
            stem = stems[iid]
            has = "yes" if stem in existing else "**no**"
            o.append(f"| `{iid}` | {raw} | `people/{stem}.md` | {has} |\n")

    n_have = sum(1 for iid in ancestors if stems[iid] in existing)
    o.append("\n---\n\n## Coverage snapshot\n\n")
    o.append(f"- Person files that exist today: **{n_have}** / **{len(ancestors)}**\n")
    o.append(f"- Missing articles: **{len(ancestors) - n_have}**\n")

    o.append("\n---\n\n## Regenerate\n\n")
    o.append("```bash\npython scripts/generate_ancestor_coverage_list.py\n```\n")

    OUT.write_text("".join(o), encoding="utf-8")
    print(f"Wrote {OUT.relative_to(REPO)} ({len(ancestors)} individuals, gen 0..{maxg})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
