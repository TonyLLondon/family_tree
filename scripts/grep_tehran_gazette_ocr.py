#!/usr/bin/env python3
"""Scan gitignored `_ocr_index/` for focus terms (page-finder QA).

Usage:
  .venv/bin/python3 scripts/grep_tehran_gazette_ocr.py \\
    --bundle sources/corpus/tehran-gazette-vol01-issues-001-130 \\
    --terms Burgess,برجیس,مترجم,سردبیر,مباشر,Edward,ناشر,ویراستار,صاحب
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--bundle", type=Path, required=True)
    ap.add_argument("--terms", default="Burgess,برجیس,مترجم,Edward,مباشر,سردبیر")
    ap.add_argument("--regex", action="store_true")
    ap.add_argument(
        "--out",
        type=Path,
        help="Append a markdown section to this file (use --replace-section with --section)",
    )
    ap.add_argument(
        "--section",
        default="",
        help="Markdown ## heading for --out (default: bundle folder name)",
    )
    ap.add_argument(
        "--replace-section",
        action="store_true",
        help="Replace existing ## section with same title in --out",
    )
    args = ap.parse_args()

    index_dir = args.bundle / "_ocr_index"
    if not index_dir.is_dir():
        print(f"No _ocr_index at {index_dir}", file=sys.stderr)
        return 1

    terms = [t.strip() for t in args.terms.split(",") if t.strip()]
    patterns = [
        (t, re.compile(t if args.regex else re.escape(t), re.IGNORECASE)) for t in terms
    ]

    hits: list[tuple[int, list[str], str]] = []
    for path in sorted(index_dir.glob("p*.txt")):
        m = re.match(r"p(\d+)\.txt$", path.name)
        if not m:
            continue
        page = int(m.group(1))
        text = path.read_text(encoding="utf-8", errors="replace")
        matched = [t for t, pat in patterns if pat.search(text)]
        if matched:
            snippet = re.sub(r"\s+", " ", text)[:120]
            hits.append((page, matched, snippet))

    n_indexed = len(list(index_dir.glob("p*.txt")))
    print(f"Indexed pages: {n_indexed}")
    print(f"Hits: {len(hits)}")
    for page, matched, snippet in hits:
        print(f"  p.{page:03d}  [{','.join(matched)}]  {snippet}…")

    if args.out:
        section = args.section.strip() or args.bundle.name
        heading = f"## OCR grep — {section}"
        body_lines = [
            "",
            heading,
            "",
            f"_Indexed pages: {n_indexed}. Terms: `{args.terms}`._",
            "",
        ]
        if not hits:
            body_lines.append("_No hits._")
        else:
            for page, matched, snippet in hits:
                body_lines.append(
                    f"- **p.{page:03d}** [{', '.join(matched)}]: {snippet}…"
                )
            body_lines.append("")
            body_lines.append(f"_Total hits: {len(hits)}_")
        body_lines.append("")

        out_path = args.out
        out_path.parent.mkdir(parents=True, exist_ok=True)
        if args.replace_section and out_path.is_file():
            existing = out_path.read_text(encoding="utf-8")
            parts = re.split(r"(?=^## OCR grep — )", existing, flags=re.MULTILINE)
            kept = [parts[0].rstrip()] if parts else []
            for part in parts[1:]:
                if not part.startswith(f"## OCR grep — {section}"):
                    kept.append(part.rstrip())
            text = "\n\n".join(p for p in kept if p) + "\n\n" + "\n".join(body_lines)
        elif out_path.is_file() and not args.replace_section:
            text = out_path.read_text(encoding="utf-8").rstrip() + "\n\n" + "\n".join(body_lines)
        else:
            text = "\n".join(body_lines)
        out_path.write_text(text if text.endswith("\n") else text + "\n", encoding="utf-8")
        print(f"Wrote {out_path}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
