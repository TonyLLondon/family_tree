#!/usr/bin/env python3
"""Generate resumable Marker jobs for NLIR lithograph bands (PDF page ranges)."""

from __future__ import annotations

import argparse
from pathlib import Path

import yaml

REPO = Path(__file__).resolve().parents[1]
JOBS = REPO / "projects/ingest_source/jobs"
FLEET_PATH = JOBS / "tehran-gazette-lithograph-marker-fleet.yaml"
SLUG = "tehran-gazette-vol01-issues-001-130"
JOB_ID = "tehran-gazette-vol01-lithograph-marker"
BUNDLE = REPO / "sources/corpus" / SLUG
LITHO_DIR = BUNDLE / "transcription.marker-lithograph"
PILOT_SRC = BUNDLE / "transcription.marker-pilot.fa.md"
PILOT_DST = LITHO_DIR / "p017-026.fa.md"


def steps_for(lo: int, hi: int, *, chunk: int) -> list[dict]:
    steps: list[dict] = []
    start = lo
    while start <= hi:
        end = min(start + chunk - 1, hi)
        pages = f"{start}-{end}"
        out = f"transcription.marker-lithograph/p{start:03d}-{end:03d}.fa.md"
        steps.append(
            {
                "id": f"marker-p{start:03d}-p{end:03d}",
                "kind": "marker-pages",
                "pages": pages,
                "output": out,
            }
        )
        start = end + 1
    return steps


def migrate_pilot() -> None:
    LITHO_DIR.mkdir(parents=True, exist_ok=True)
    if PILOT_DST.is_file():
        return
    if not PILOT_SRC.is_file():
        return
    text = PILOT_SRC.read_text(encoding="utf-8")
    if "<!-- pdf-page:" not in text:
        # Re-tag subset markers if pilot predates pdf-page injection.
        import re

        body = text.split("---\n", 2)
        if len(body) >= 3:
            fm, rest = body[1], body[2]
            pages = list(range(17, 27))
            idx = 0

            def repl(m: re.Match[str]) -> str:
                nonlocal idx
                if idx < len(pages):
                    n = pages[idx]
                    idx += 1
                    return f"\n\n<!-- pdf-page: {n} -->\n\n## PDF page {n}\n\n"
                return m.group(0)

            rest = re.sub(r"\{(\d+)\}------------------------------------------------", repl, rest)
            text = f"---\n{fm}---\n{rest}"
    PILOT_DST.write_text(text, encoding="utf-8")
    print(f"  migrated pilot → {PILOT_DST.relative_to(REPO)}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--lo", type=int, default=17, help="First PDF page (inclusive)")
    ap.add_argument("--hi", type=int, default=200, help="Last PDF page (inclusive)")
    ap.add_argument("--chunk", type=int, default=10, help="Pages per Marker step")
    ap.add_argument(
        "--skip-complete",
        type=int,
        default=26,
        help="Do not emit steps ending at or below this page (pilot already done through 26)",
    )
    args = ap.parse_args()

    migrate_pilot()

    lo = max(args.lo, args.skip_complete + 1)
    hi = args.hi
    steps = steps_for(lo, hi, chunk=args.chunk)
    litho_pages = hi - args.lo + 1

    job = {
        "id": JOB_ID,
        "slug": SLUG,
        "log_dir": "projects/ingest_source/history/jobs",
        "description": (
            f"Marker force-OCR lithograph band PDF p.{args.lo}–{args.hi} "
            f"({args.chunk}-page steps → transcription.marker-lithograph/)."
        ),
        "on_complete_fleet": FLEET_PATH.relative_to(REPO).as_posix(),
        "steps": steps,
    }
    job_path = JOBS / f"{JOB_ID}.yaml"
    job_path.write_text(yaml.dump(job, allow_unicode=True, sort_keys=False), encoding="utf-8")
    print(f"  {job_path.relative_to(REPO)}: {len(steps)} steps (pages {lo}-{hi})")

    fleet = {
        "id": "tehran-gazette-lithograph-marker-fleet",
        "description": (
            "Primary Tehran Gazette text pipeline: Marker on lithograph PDF bands "
            "(Surya _ocr_index deprioritised)."
        ),
        "parallel_recommended": 1,
        "total_pages": litho_pages,
        "jobs": [
            {
                "job_file": job_path.relative_to(REPO).as_posix(),
                "slug": SLUG,
                "pages": litho_pages,
                "band": f"p.{args.lo}-{args.hi}",
            }
        ],
    }
    FLEET_PATH.write_text(yaml.dump(fleet, allow_unicode=True, sort_keys=False), encoding="utf-8")
    print(f"  fleet: {FLEET_PATH.relative_to(REPO)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
