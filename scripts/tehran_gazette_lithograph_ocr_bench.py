#!/usr/bin/env python3
"""Benchmark Surya OCR settings on one lithograph gazette page (page-finder QA)."""

from __future__ import annotations

import argparse
import re
import sys
import tempfile
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO / "projects" / "ingest_source" / "runner"))

from extract_source import (  # noqa: E402
    _apply_surya_entries,
    _build_ocr_index,
    _ocr_index_chunk_with_retry,
    _resolve_surya_bin,
    _surya_supports_disable_math,
)

# Phrases we expect on PDF p.25 (issue 9, Karim Khan / Julfa Armenians).
SCORE_TERMS = [
    "کریم",
    "کرین",
    "داود",
    "جلفا",
    "صفهان",
    "ارمن",
    "امورات",
    "قشون",
    "فوج",
    "نوکری",
    "مالیات",
]


def _score(text: str) -> tuple[int, list[str]]:
    hits: list[str] = []
    for t in SCORE_TERMS:
        if t in text:
            hits.append(t)
    return len(hits), hits


def _run_surya_one(
    *,
    pdf_path: Path,
    bundle: Path,
    page: int,
    dpi: int,
    prefer_pages_png: bool,
) -> str:
    surya_bin = _resolve_surya_bin()
    disable = _surya_supports_disable_math(surya_bin)
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        index_dir = tmp_path / "out"
        index_dir.mkdir()
        entries = _ocr_index_chunk_with_retry(
            surya_bin,
            pdf_path=pdf_path,
            bundle=bundle,
            chunk=[page],
            highres_dpi=dpi,
            disable_math=disable,
            prefer_pages_png=prefer_pages_png,
            index_dir=index_dir,
            tmp_path=tmp_path,
        )
        if not entries:
            return ""
        p = index_dir / f"p{page:03d}.txt"
        return p.read_text(encoding="utf-8", errors="replace") if p.is_file() else ""


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--slug", default="tehran-gazette-vol01-issues-001-130")
    ap.add_argument("--page", type=int, default=25)
    ap.add_argument(
        "--out-dir",
        type=Path,
        default=REPO / "research/tehran-gazette-p025-ocr-bench",
    )
    args = ap.parse_args()

    bundle = REPO / "sources/corpus" / args.slug
    pdf = REPO / "media/docs/internet-archive/tehran-gazette/tehran-gazette-nlir1373-vol01-issues-001-130.pdf"
    if not pdf.is_file():
        print(f"PDF missing: {pdf}", file=sys.stderr)
        return 1

    args.out_dir.mkdir(parents=True, exist_ok=True)
    baseline = bundle / "_ocr_index" / f"p{args.page:03d}.txt"
    if baseline.is_file():
        (args.out_dir / "00-fleet-baseline-200dpi-pdf.txt").write_text(
            baseline.read_text(encoding="utf-8", errors="replace"), encoding="utf-8"
        )

    configs: list[tuple[str, int, bool]] = [
        ("surya-300dpi-pdf-raster", 300, False),
        ("surya-400dpi-pdf-raster", 400, False),
        ("surya-300dpi-pages-png", 300, True),
    ]

    rows: list[tuple[str, int, list[str]]] = []
    if baseline.is_file():
        sc, ht = _score(baseline.read_text(encoding="utf-8", errors="replace"))
        rows.append(("00-fleet-baseline-200dpi-pdf", sc, ht))

    for name, dpi, prefer in configs:
        print(f"Running {name} (dpi={dpi}, prefer_png={prefer})…", flush=True)
        text = _run_surya_one(
            pdf_path=pdf,
            bundle=bundle,
            page=args.page,
            dpi=dpi,
            prefer_pages_png=prefer,
        )
        out = args.out_dir / f"{name}.txt"
        out.write_text(text + "\n", encoding="utf-8")
        sc, ht = _score(text)
        rows.append((name, sc, ht))
        print(f"  score {sc}/11  hits={ht}", flush=True)

    best = max(rows, key=lambda r: r[1])
    summary = ["# Lithograph OCR bench — PDF p.25", "", "| Config | Score | Hits |", "|--------|------:|------|"]
    for name, sc, ht in rows:
        summary.append(f"| {name} | {sc} | {', '.join(ht) or '—'} |")
    summary.append("")
    summary.append(f"**Best (keyword score):** `{best[0]}` ({best[1]}/11)")
    summary.append("")
    summary.append("Scores count substring presence only; read `.txt` files for quality.")
    (args.out_dir / "README.md").write_text("\n".join(summary) + "\n", encoding="utf-8")
    print(f"\nWrote {args.out_dir}/")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
