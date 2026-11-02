#!/usr/bin/env python3
"""Create corpus skeletons for each NLIR Tehran Gazette PDF (triage --file)."""

from __future__ import annotations

import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
MEDIA = REPO / "media/docs/internet-archive/tehran-gazette"
RUNNER = REPO / "projects/ingest_source/runner"
sys.path.insert(0, str(RUNNER))
from extract_source import _ensure_skeleton_bundle  # noqa: E402

SLUG_BY_PDF: dict[str, str] = {
    **{f"tehran-gazette-nlir1373-vol0{i}.pdf": f"tehran-gazette-nlir1373-vol0{i}" for i in range(1, 5)},
}


def slug_for(pdf: Path) -> str:
    if pdf.name in SLUG_BY_PDF:
        return SLUG_BY_PDF[pdf.name]
    raise SystemExit(f"Not a canonical NLIR PDF (use vol01–04 at media root): {pdf.name}")


def main() -> int:
    pdfs = sorted(MEDIA.glob("tehran-gazette-nlir1373-vol*.pdf"))
    for pdf in pdfs:
        slug = slug_for(pdf)
        bundle = REPO / "sources/corpus" / slug / "source.yaml"
        if bundle.is_file():
            print(f"OK  {slug}")
            continue
        print(f"NEW {slug} ← {pdf.name}")
        _ensure_skeleton_bundle(slug, pdf.resolve())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
