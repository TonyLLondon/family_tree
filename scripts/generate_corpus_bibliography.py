#!/usr/bin/env python3
"""
Regenerate sources/corpus-bibliography.md — one inbound link per corpus slug.

Run from repo root: .venv/bin/python scripts/generate_corpus_bibliography.py
"""
from __future__ import annotations

from collections import defaultdict
from pathlib import Path

import yaml

REPO = Path(__file__).resolve().parents[1]
CORPUS = REPO / "sources" / "corpus"
OUT = REPO / "sources" / "corpus-bibliography.md"


def category(slug: str, title: str) -> str:
    s = f"{slug} {title}".lower()
    if any(
        x in s
        for x in (
            "zadar",
            "dazd",
            # Hyphen-bounded "nin" (place); bare "nin" matches "Christenings" in parish PDF titles.
            "-nin-",
            "opcina-nin",
            "plemenica-nina",
            "addobbati",
            "dalmat",
            "retrozadar",
            "slobodna",
            "polito",
            "celic",
            "venetian",
            "zara",
            "split",
            "spalato",
            "hazu",
            "granic",
            "arhinet",
            "difesa",
            "zerauschek",
            "viella",
            "dalbello",
            "historywalks",
            "societa-dalmata",
        )
    ):
        return "Zara / Dalmatia / DAZD"
    if any(
        x in s
        for x in (
            "burgess",
            "nypl",
            "cormick",
            "saginian",
            "persia",
            "iran",
            "qajar",
            "tehran",
            "navasargian",
            "bottin",
            "iranica",
            "ambassade-france-iran",
            "solayman",
            "firearms",
            "levantine",
            "onnerfors",
            "wright-burial",
            "connectionsbmc",
            "william-cormick",
            "wikipedia-william",
            "obrien-roche",
            "london-gazette",
        )
    ):
        return "Persia / Iran / Anglo-Persian trunk"
    if any(
        x in s
        for x in (
            "ireland",
            "limerick",
            "roche",
            "enright",
            "catherine-enright",
            "louisa-spencer",
            "census-for-whites",
            "ireland-census",
            "spencer",
            "myheritage",
            "sloan",
            "archer",
            "chart",
            "vera-obolensky",
            "princess-obolensky",
            "obolensky",
        )
    ):
        return "Ireland / Lewis charts / Obolensky"
    if any(
        x in s
        for x in (
            "erbe",
            "revalsche",
            "digar",
            "tallinn",
            "estonian",
            "thurgau",
            "hvtg",
            "petition-swiss",
            "stump-family",
            "stump",
            "beytoote",
            "wikidata-eugen-erbe",
            "landesen",
            "thomas-erbe",
            "bbld-erbe",
            "eadb-erbe",
            "deutsche-biographie-hermann",
            "austria-wiki-eugen",
            "raee-fotis",
        )
    ):
        return "Stump / Erbe / Baltic–Swiss"
    if any(
        x in s
        for x in (
            "mission",
            "baha",
            "báb",
            "babi",
            "christian-mission",
            "woman-and-her",
            "solas-bahai",
            "lessona",
            "history-of-the-mission",
            "history-of-the-missions",
            "implications-of-american-missionary",
            "baha-i-talks",
            "cormick-man-who-met-bab",
            "gabriele-yonan",
            "david-yaghoubian",
            "lior-sternfeld",
            "jeffrey-eden",
            "arash-khazeni",
        )
    ):
        return "Missions / Bahá'í / Iranian modernity (books)"
    if any(
        x in s
        for x in (
            "medical-times",
            "ncbi",
            "maltaramc",
            "fibis",
            "obyrne",
            "army-list",
            "half-pay",
            "silver-star",
            "adrian-osullivan",
            "great-britain-naval",
            "handbook-mesopotamia",
            "gerald",
            "madras",
            "owen-beasley",
            "major-david-lewis",
        )
    ):
        return "Military / India / colonial courts"
    return "Other"


def main() -> None:
    rows: list[tuple[str, str]] = []
    for p in sorted(CORPUS.iterdir()):
        if not p.is_dir() or p.name.startswith("."):
            continue
        yp = p / "source.yaml"
        if not yp.is_file():
            continue
        try:
            data = yaml.safe_load(yp.read_text(encoding="utf-8")) or {}
        except Exception:
            data = {}
        title = data.get("title") or p.name
        if not isinstance(title, str):
            title = p.name
        rows.append((p.name, title))

    buckets: defaultdict[str, list[tuple[str, str]]] = defaultdict(list)
    for slug, title in rows:
        buckets[category(slug, title)].append((slug, title))

    order = [
        "Persia / Iran / Anglo-Persian trunk",
        "Zara / Dalmatia / DAZD",
        "Ireland / Lewis charts / Obolensky",
        "Stump / Erbe / Baltic–Swiss",
        "Missions / Bahá'í / Iranian modernity (books)",
        "Military / India / colonial courts",
        "Other",
    ]

    lines = [
        "# Corpus bibliography",
        "",
        "Every ingested bundle under [`sources/corpus/`](corpus/) is listed here so each slug has at least one inbound vault link. **Inventory + ingest notes:** [corpus/README.md](corpus/README.md). **Coverage gaps (cards vs bundles):** run `scripts/source_coverage_report.py`.",
        "",
        "**Regenerate this file:** `.venv/bin/python scripts/generate_corpus_bibliography.py`",
        "",
    ]
    for bucket in order:
        if bucket not in buckets:
            continue
        lines.append(f"## {bucket}")
        lines.append("")
        for slug, title in sorted(buckets[bucket], key=lambda x: x[0].lower()):
            safe = title.replace("\n", " ").strip()
            lines.append(f"- [{safe}](corpus/{slug}/) — `{slug}`")
        lines.append("")

    OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Wrote {OUT.relative_to(REPO)} ({len(rows)} bundles)")


if __name__ == "__main__":
    main()
