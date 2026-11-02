#!/usr/bin/env python3
"""Grep `_ocr_index/` across every slug in the NLIR fleet manifest."""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

import yaml

REPO = Path(__file__).resolve().parents[1]
FLEET = REPO / "projects/ingest_source/jobs/tehran-gazette-full-ocr-fleet.yaml"
GREP = REPO / "scripts/grep_tehran_gazette_ocr.py"
PY = REPO / ".venv/bin/python3"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--fleet", type=Path, default=FLEET)
    ap.add_argument("--terms", default="برجیس,برجيس,Burgess,Edward,مترجم,اجازه,مرخص,وفات")
    ap.add_argument("--out", type=Path, default=REPO / "research/tehran-gazette-ocr-grep-log.md")
    args = ap.parse_args()

    fleet = yaml.safe_load(args.fleet.read_text(encoding="utf-8")) or {}
    jobs = fleet.get("jobs") or []
    total_pages = int(fleet.get("total_pages") or 0)
    py = str(PY if PY.is_file() else sys.executable)

    print(f"Fleet: {fleet.get('id')} — {total_pages} pages target, {len(jobs)} PDFs\n")
    for row in jobs:
        slug = row["slug"]
        bundle = REPO / "sources/corpus" / slug
        print(f"=== {slug} ({row.get('pages')} pg) ===")
        subprocess.run(
            [py, str(GREP), "--bundle", str(bundle.relative_to(REPO)), "--terms", args.terms, "--out", str(args.out)],
            cwd=str(REPO),
            check=False,
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
