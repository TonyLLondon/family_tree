#!/usr/bin/env python3
"""Marker OCR for a PDF page range → corpus markdown (Persian lithograph pilot / hits)."""

from __future__ import annotations

import argparse
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
CORPUS = REPO / "sources/corpus"
sys.path.insert(0, str(REPO / "scripts"))

from marker_reextract import _build_converter, _extract, _find_pdf  # noqa: E402


def _utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _inject_pdf_page_markers(md_text: str, pdf_pages: list[int]) -> str:
    """Replace Marker subset indices {0},{1},… with absolute PDF page markers."""
    import re

    def repl(match: re.Match[str]) -> str:
        idx = int(match.group(1))
        if 0 <= idx < len(pdf_pages):
            n = pdf_pages[idx]
            return f"\n\n<!-- pdf-page: {n} -->\n\n## PDF page {n}\n\n"
        return match.group(0)

    return re.sub(r"\{(\d+)\}------------------------------------------------", repl, md_text)


def _parse_pages(spec: str) -> list[int]:
    out: set[int] = set()
    for chunk in spec.split(","):
        chunk = chunk.strip()
        if not chunk:
            continue
        if "-" in chunk:
            a, b = chunk.split("-", 1)
            lo, hi = int(a), int(b)
            if lo > hi:
                lo, hi = hi, lo
            out.update(range(lo, hi + 1))
        else:
            out.add(int(chunk))
    return sorted(out)


def _subset_pdf(pdf: Path, pages: list[int], dest: Path) -> None:
    import fitz

    src = fitz.open(pdf)
    out = fitz.open()
    try:
        for n in pages:
            if 1 <= n <= src.page_count:
                out.insert_pdf(src, from_page=n - 1, to_page=n - 1)
        out.save(str(dest))
    finally:
        src.close()
        out.close()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--slug", required=True)
    ap.add_argument("--pages", required=True, help='e.g. "17-26"')
    ap.add_argument(
        "--output",
        default="",
        help="Path under sources/corpus/<slug>/ (default: transcription.marker-lithograph/pNNN-MMM.fa.md)",
    )
    ap.add_argument(
        "--no-force-ocr",
        action="store_true",
        help="Use marker text layer when present (default: force OCR).",
    )
    args = ap.parse_args()

    force = not args.no_force_ocr
    pdf = _find_pdf(args.slug)
    if not pdf:
        print(f"No PDF for slug {args.slug}", file=sys.stderr)
        return 1

    pages = _parse_pages(args.pages)
    if not pages:
        print("No pages in --pages", file=sys.stderr)
        return 1

    bundle = CORPUS / args.slug
    bundle.mkdir(parents=True, exist_ok=True)
    if args.output.strip():
        out_rel = args.output.strip()
    else:
        tag = f"p{pages[0]:03d}-{pages[-1]:03d}"
        out_rel = f"transcription.marker-lithograph/{tag}.fa.md"
    out_path = bundle / out_rel
    out_path.parent.mkdir(parents=True, exist_ok=True)

    print(f"Loading marker models (force_ocr={force})…", flush=True)
    converter = _build_converter(force_ocr=force)

    with tempfile.TemporaryDirectory() as tmp:
        subset = Path(tmp) / "subset.pdf"
        _subset_pdf(pdf, pages, subset)
        print(f"  subset {len(pages)} page(s) → {subset.name}", flush=True)
        md_text = _extract(converter, subset)
        md_text = _inject_pdf_page_markers(md_text, pages)

    try:
        rel_pdf = pdf.resolve().relative_to(REPO)
    except ValueError:
        rel_pdf = pdf

    header = (
        "---\n"
        f"generated: {_utc_now()}\n"
        "generator: marker-pdf\n"
        "language: fa\n"
        f'source_file: "{rel_pdf.as_posix()}"\n'
        f"source_pages: \"{args.pages}\"\n"
        "page_markers: true\n"
        "verified: false\n"
        "---\n\n"
    )
    out_path.write_text(header + md_text, encoding="utf-8")
    print(f"Wrote {out_path.relative_to(REPO)} ({len(md_text.split())} words)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
