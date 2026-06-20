#!/usr/bin/env python3
"""Download IA PDFs and extract page PNGs for Zerauschek ingest batch."""

from __future__ import annotations

import hashlib
import subprocess
import sys
from pathlib import Path

try:
    import fitz  # pymupdf
except ImportError:
    print("pymupdf required", file=sys.stderr)
    sys.exit(1)

REPO = Path(__file__).resolve().parents[1]
MEDIA = REPO / "media/docs/internet-archive/zerauschek"

# printed_page from IA OCR → 0-based index heuristic: use search on text layer
JOBS = [
    {
        "ia_id": "19310130_024",
        "pdf_name": "gazzetta-ufficiale-1931-01-30-bellini-zerauschek.pdf",
        "png_name": "gazzetta-ufficiale-1931-01-30-bellini-zerauschek-page.png",
        "search": "Bellini-Zerauschek",
        "fallback_page": 19,
    },
    {
        "ia_id": "19321214_287_SO_287",
        "pdf_name": "gazzetta-ufficiale-1932-12-14-peristeridis.pdf",
        "png_name": "gazzetta-ufficiale-1932-12-14-peristeridis-page.png",
        "search": "Peristeridis",
        "fallback_page": 95,
    },
    {
        "ia_id": "19331031_253",
        "pdf_name": "gazzetta-ufficiale-1933-10-31-manifattura-zaratina.pdf",
        "png_name": "gazzetta-ufficiale-1933-10-31-manifattura-zaratina-page.png",
        "search": "Manifattura Zaratina",
        "fallback_page": 63,
    },
    {
        "ia_id": "Guida_TS-1927",
        "pdf_name": "guida-trieste-1927-zerauschek-commissario-excerpt.pdf",
        "png_name": "guida-trieste-1927-zerauschek-commissario-page.png",
        "search": "Zerauschek A.",
        "fallback_page": 1626,
        "page_range": (1624, 1629),
    },
    {
        "ia_id": "Piccolo_1978-02-14",
        "pdf_name": "piccolo-1978-02-14.pdf",
        "png_name": "piccolo-1978-02-14-riccardo-zerauschek-obituary.png",
        "search": "Riccardo Zerauschek",
        "fallback_page": 13,
    },
    {
        "ia_id": "Piccolo_1923-10-26",
        "pdf_name": "piccolo-1923-10-26.pdf",
        "png_name": "piccolo-1923-10-26-page-6.png",
        "search": "ZERAUSCHEK",
        "fallback_page": 5,
    },
    {
        "ia_id": "Piccolo_1923-10-28",
        "pdf_name": "piccolo-1923-10-28.pdf",
        "png_name": "piccolo-1923-10-28-page-8.png",
        "search": "ZERAUSCHEK",
        "fallback_page": 7,
    },
    {
        "ia_id": "Piccolo_1914-01-01",
        "pdf_name": "piccolo-1914-01-01.pdf",
        "png_name": "piccolo-1914-01-01-zerauschek-luxardo-page.png",
        "search": "Zerauschek",
        "fallback_page": 9,
    },
]


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def download(ia_id: str, dest: Path) -> None:
    if dest.exists() and dest.stat().st_size > 1000:
        print(f"  skip download (exists): {dest.name}")
        return
    url = f"https://archive.org/download/{ia_id}/{ia_id}.pdf"
    print(f"  curl {url}")
    subprocess.run(
        ["curl", "-fsSL", "-o", str(dest), url],
        check=True,
        timeout=600,
    )


def find_page(doc: fitz.Document, needle: str, fallback: int) -> int:
    needle_lower = needle.lower()
    for i in range(doc.page_count):
        text = doc.load_page(i).get_text("text").lower()
        if needle_lower in text:
            return i
    return min(fallback, doc.page_count - 1)


def extract_pages(
    pdf: Path,
    png: Path,
    search: str,
    fallback: int,
    page_range: tuple[int, int] | None = None,
) -> int:
    doc = fitz.open(pdf)
    if page_range:
        start, end = page_range
        start = min(start, doc.page_count - 1)
        end = min(end, doc.page_count - 1)
        out = fitz.open()
        for i in range(start, end + 1):
            out.insert_pdf(doc, from_page=i, to_page=i)
        out.save(png.with_suffix(".pdf"))
        out.close()
        page_idx = find_page(doc, search, fallback)
        page = doc.load_page(page_idx)
    else:
        page_idx = find_page(doc, search, fallback)
        page = doc.load_page(page_idx)
    pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
    pix.save(str(png))
    doc.close()
    return page_idx + 1


def main() -> None:
    MEDIA.mkdir(parents=True, exist_ok=True)
    for job in JOBS:
        print(f"\n=== {job['ia_id']} ===")
        pdf = MEDIA / job["pdf_name"]
        png = MEDIA / job["png_name"]
        try:
            download(job["ia_id"], pdf)
            printed = extract_pages(
                pdf,
                png,
                job["search"],
                job["fallback_page"],
                job.get("page_range"),
            )
            print(f"  page (1-based): {printed}")
            print(f"  sha256: {sha256_file(pdf)[:16]}…")
            print(f"  png: {png.name}")
        except Exception as e:
            print(f"  FAILED: {e}", file=sys.stderr)


if __name__ == "__main__":
    main()
