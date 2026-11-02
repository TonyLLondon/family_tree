#!/usr/bin/env python3
"""Generate resumable batch_runner Surya _ocr_index jobs (optional; Marker is primary).

Targets canonical NLIR 1373 four-volume PDFs only. Not used while lithograph Surya is paused.
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

import yaml

REPO = Path(__file__).resolve().parents[1]
MEDIA = REPO / "media/docs/internet-archive/tehran-gazette"
JOBS = REPO / "projects/ingest_source/jobs"
FLEET = JOBS / "tehran-gazette-full-ocr-fleet.yaml"
FLEET_REL = FLEET.relative_to(REPO).as_posix()
BATCH = 20
OCR_DPI = 300

CANONICAL = [f"tehran-gazette-nlir1373-vol0{i}.pdf" for i in range(1, 5)]

SLUG_BY_PDF: dict[str, str] = {name: name.replace(".pdf", "").replace("tehran-gazette-nlir1373-", "tehran-gazette-nlir1373-") for name in CANONICAL}
for i in range(1, 5):
    SLUG_BY_PDF[f"tehran-gazette-nlir1373-vol0{i}.pdf"] = f"tehran-gazette-nlir1373-vol0{i}"


def pdf_pages(path: Path) -> int:
    out = subprocess.check_output(["pdfinfo", str(path)], text=True)
    for line in out.splitlines():
        if line.startswith("Pages:"):
            return int(line.split(":", 1)[1].strip())
    raise SystemExit(f"Could not read page count: {path}")


def slug_for(pdf: Path) -> str:
    return SLUG_BY_PDF.get(pdf.name) or pdf.stem


def job_id_for(slug: str) -> str:
    return f"{slug}-ocr-index"


def steps_for(page_count: int) -> list[dict]:
    steps: list[dict] = []
    lo = 1
    while lo <= page_count:
        hi = min(lo + BATCH - 1, page_count)
        steps.append({"id": f"ocr-{lo:03d}-{hi:03d}", "kind": "ocr-index", "pages": f"{lo}-{hi}"})
        lo = hi + 1
    return steps


def reset_fleet_runner_state(job_ids: list[str]) -> None:
    hist = REPO / "projects/ingest_source/history/jobs"
    for jid in job_ids:
        for suffix in (".state.json", ".pid"):
            p = hist / f"{jid}{suffix}"
            if p.is_file():
                p.unlink()
                print(f"  reset: removed {p.relative_to(REPO)}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--uniform-reindex", action="store_true")
    args = ap.parse_args()

    pdfs = [MEDIA / n for n in CANONICAL]
    for p in pdfs:
        if not p.is_file():
            raise SystemExit(f"Missing: {p}")

    fleet_jobs: list[dict] = []
    total_pages = 0
    job_ids: list[str] = []

    for pdf in pdfs:
        pages = pdf_pages(pdf)
        slug = slug_for(pdf)
        job_id = job_id_for(slug)
        job_ids.append(job_id)
        total_pages += pages
        rel_media = pdf.relative_to(REPO).as_posix()
        job: dict = {
            "id": job_id,
            "slug": slug,
            "media_reference": rel_media,
            "page_count": pages,
            "batch_size": BATCH,
            "ocr_highres_dpi": OCR_DPI,
            "log_dir": "projects/ingest_source/history/jobs",
            "on_complete_fleet": FLEET_REL,
            "ocr_no_prefer_pages_png": True,
            "steps": steps_for(pages),
            "description": f"Surya _ocr_index @ {OCR_DPI} DPI — {pdf.name} ({pages} pp). Secondary to Marker.",
        }
        if args.uniform_reindex:
            job["ocr_index_force"] = True
        job_path = JOBS / f"{job_id}.yaml"
        job_path.write_text(yaml.dump(job, allow_unicode=True, sort_keys=False), encoding="utf-8")
        fleet_jobs.append(
            {
                "job_file": job_path.relative_to(REPO).as_posix(),
                "pdf": rel_media,
                "slug": slug,
                "pages": pages,
            }
        )
        print(f"  {job_path.name}: {pages} pages")

    if args.uniform_reindex:
        reset_fleet_runner_state(job_ids)

    fleet = {
        "id": "tehran-gazette-full-ocr-fleet",
        "description": f"PAUSED — optional Surya page-finder on 4-vol set ({total_pages} pp). Marker fleet is primary.",
        "total_pages": total_pages,
        "batch_size": BATCH,
        "parallel_recommended": 1,
        "jobs": fleet_jobs,
    }
    FLEET.write_text(yaml.dump(fleet, allow_unicode=True, sort_keys=False), encoding="utf-8")
    print(f"\nFleet: {FLEET.relative_to(REPO)} ({total_pages} pages)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
