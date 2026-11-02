#!/usr/bin/env python3
"""Grep Marker lithograph markdown under a Tehran Gazette corpus slug."""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
DEFAULT_SLUG = "tehran-gazette-nlir1373-vol02"
MARKER_DIRS = ("transcription.marker", "transcription.marker-lithograph")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("terms", nargs="+", help="Substring terms (Persian or Latin)")
    ap.add_argument("--slug", default=DEFAULT_SLUG)
    ap.add_argument(
        "--dir",
        default="",
        help="Subdir under corpus bundle (default: first existing of transcription.marker, …lithograph)",
    )
    args = ap.parse_args()

    bundle = REPO / "sources/corpus" / args.slug
    if args.dir:
        root = bundle / args.dir
    else:
        root = next((bundle / d for d in MARKER_DIRS if (bundle / d).is_dir()), bundle / MARKER_DIRS[0])
    if not root.is_dir():
        print(f"No directory: {root.relative_to(REPO)}", file=sys.stderr)
        return 1

    terms = args.terms
    for path in sorted(root.glob("*.md")):
        text = path.read_text(encoding="utf-8", errors="replace")
        rel = path.relative_to(REPO)
        parts = re.split(r"<!-- pdf-page: (\d+) -->", text)
        page = "?"
        for i in range(0, len(parts)):
            if i % 2 == 1:
                page = parts[i]
                continue
            block = parts[i]
            for term in terms:
                if term not in block:
                    continue
                idx = block.find(term)
                snippet = block[max(0, idx - 40) : idx + len(term) + 60].replace("\n", " ")
                print(f"{rel}  pdf~{page}  [{term}]  …{snippet}…")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
