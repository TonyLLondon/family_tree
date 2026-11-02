#!/usr/bin/env python3
"""Generate resumable Marker page-band jobs for NLIR 1373 four-volume PDFs."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import yaml

REPO = Path(__file__).resolve().parents[1]
MEDIA = REPO / "media/docs/internet-archive/tehran-gazette"
JOBS = REPO / "projects/ingest_source/jobs"
FLEET = JOBS / "tehran-gazette-nlir1373-marker-fleet.yaml"
STEP_PAGES = 25

# Edward Burgess (d. ~Jun 1855): issue 131+ lives in vol. 2 — run that PDF first.
FLEET_ORDER = [
    "tehran-gazette-nlir1373-vol02.pdf",
    "tehran-gazette-nlir1373-vol03.pdf",
    "tehran-gazette-nlir1373-vol01.pdf",
    "tehran-gazette-nlir1373-vol04.pdf",
]

SLUG_BY_PDF: dict[str, str] = {
    f"tehran-gazette-nlir1373-vol0{i}.pdf": f"tehran-gazette-nlir1373-vol0{i}"
    for i in range(1, 5)
}


def pdf_pages(path: Path) -> int:
    out = subprocess.check_output(["pdfinfo", str(path)], text=True)
    for line in out.splitlines():
        if line.startswith("Pages:"):
            return int(line.split(":", 1)[1].strip())
    raise SystemExit(f"No page count: {path}")


def slug_for(pdf: Path) -> str:
    if pdf.name in SLUG_BY_PDF:
        return SLUG_BY_PDF[pdf.name]
    raise SystemExit(f"Unknown canonical PDF: {pdf.name}")


def page_bands(total: int, chunk: int) -> list[tuple[int, int]]:
    bands: list[tuple[int, int]] = []
    start = 1
    while start <= total:
        end = min(start + chunk - 1, total)
        bands.append((start, end))
        start = end + 1
    return bands


def main() -> int:
    fleet_jobs: list[dict] = []
    for name in FLEET_ORDER:
        pdf = MEDIA / name
        if not pdf.is_file():
            raise SystemExit(f"Missing canonical PDF: {pdf}")
        pages = pdf_pages(pdf)
        slug = slug_for(pdf)
        job_id = f"{slug}-marker"
        steps: list[dict] = []
        for lo, hi in page_bands(pages, STEP_PAGES):
            sid = f"marker-p{lo:03d}-p{hi:03d}"
            out = f"transcription.marker/p{lo:03d}-{hi:03d}.fa.md"
            steps.append(
                {
                    "id": sid,
                    "kind": "marker-pages",
                    "pages": f"{lo}-{hi}",
                    "output": out,
                }
            )
        job = {
            "id": job_id,
            "slug": slug,
            "page_count": pages,
            "log_dir": "projects/ingest_source/history/jobs",
            "description": (
                f"Marker force-OCR {name} ({pages} pp, {len(steps)}×{STEP_PAGES}-page bands "
                f"→ transcription.marker/)."
            ),
            "on_complete_fleet": FLEET.relative_to(REPO).as_posix(),
            "steps": steps,
        }
        path = JOBS / f"{job_id}.yaml"
        path.write_text(yaml.dump(job, allow_unicode=True, sort_keys=False), encoding="utf-8")
        fleet_jobs.append(
            {
                "job_file": path.relative_to(REPO).as_posix(),
                "slug": slug,
                "pages": pages,
            }
        )
        print(f"  {path.name} ({pages} pg, {len(steps)} steps)")

    fleet = {
        "id": "tehran-gazette-nlir1373-marker-fleet",
        "description": (
            "NLIR 1373 Asmane 4-vol (3243 pp) — Marker bands 25 pp/step. "
            "Order: vol2→vol3→vol1→vol4 (Edward 131+). Supersedes marker-full on 9-bundle set."
        ),
        "total_pages": sum(j["pages"] for j in fleet_jobs),
        "parallel_recommended": 1,
        "jobs": fleet_jobs,
    }
    FLEET.write_text(yaml.dump(fleet, allow_unicode=True, sort_keys=False), encoding="utf-8")

    old = JOBS / "tehran-gazette-marker-full-fleet.yaml"
    if old.is_file():
        data = yaml.safe_load(old.read_text(encoding="utf-8")) or {}
        desc = str(data.get("description") or "")
        if "SUPERSEDED" not in desc:
            data["description"] = (
                "SUPERSEDED 2026-10-08 — use tehran-gazette-nlir1373-marker-fleet.yaml "
                "(4-vol Asmane). Was: 9-bundle marker-full 3448 pp."
            )
            old.write_text(yaml.dump(data, allow_unicode=True, sort_keys=False), encoding="utf-8")
            print(f"\nMarked superseded: {old.name}")

    print(f"\nFleet: {FLEET.relative_to(REPO)} ({fleet['total_pages']} pages)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
