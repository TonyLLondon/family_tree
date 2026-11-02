#!/usr/bin/env python3
"""Grep _ocr_index for terms; print page hits with preview. Wrapper for batch use."""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--bundle", type=Path, required=True)
    ap.add_argument(
        "--terms",
        default=(
            "برجیس,برجيس,Burgess,Edward,مترجم,اجازه,مرخصی,مرخص,England,انگلیس,"
            "وفات,درگذشت,مرگ,تسلیت,ماتم"
        ),
    )
    ap.add_argument("--out", type=Path, help="Append hits to this markdown log")
    args = ap.parse_args()

    bundle = args.bundle if args.bundle.is_absolute() else REPO / args.bundle
    index_dir = bundle / "_ocr_index"
    terms = [t.strip() for t in args.terms.split(",") if t.strip()]
    patterns = [(t, re.compile(re.escape(t), re.IGNORECASE)) for t in terms]

    lines_out: list[str] = []
    count = len(list(index_dir.glob("p*.txt"))) if index_dir.is_dir() else 0
    header = f"## OCR grep — {bundle.name} — {count} indexed pages\n"
    lines_out.append(header)

    hits = 0
    for path in sorted(index_dir.glob("p*.txt")) if index_dir.is_dir() else []:
        m = re.match(r"p(\d+)\.txt$", path.name)
        if not m:
            continue
        page = int(m.group(1))
        text = path.read_text(encoding="utf-8", errors="replace")
        matched = [t for t, pat in patterns if pat.search(text)]
        if not matched:
            continue
        hits += 1
        snip = re.sub(r"\s+", " ", text).strip()[:200]
        line = f"- **p.{page:03d}** [{', '.join(matched)}]: {snip}…"
        lines_out.append(line)
        print(line)

    lines_out.append(f"\n_Total hits: {hits}_\n")
    if args.out:
        out_path = args.out if args.out.is_absolute() else REPO / args.out
        out_path.parent.mkdir(parents=True, exist_ok=True)
        with out_path.open("a", encoding="utf-8") as f:
            f.write("\n".join(lines_out) + "\n")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
