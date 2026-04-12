#!/usr/bin/env python3
"""
Extract PDF text with PyMuPDF reading order (sort=True), then join soft line breaks.

Use for two-column or messy stream order where plain get_text() fragments words.
Default post-process: join [a-z]\\n[a-z] (PDF line wrap) into a space; repeat until stable.

  .venv/bin/python scripts/extract_pdf_sorted_transcription.py \\
    --slug burgess-persian-letters-full-volume

Requires: pymupdf (fitz)
"""

from __future__ import annotations

import argparse
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parents[1]
CORPUS_ROOT = REPO_ROOT / "sources" / "corpus"

# Left token must not look like a complete word when merging "word1\n word2" -> "word1word2".
_JOIN_STOP_LEFT = frozenset(
    """
 the and are but not you all had her was one our out day get has him his how man new now
    see two who boy did its let say she too use any may will can that with have this from they
    been were said each which their time would there could about other after first never these
    think where being those under while might every great shall still whole often among women
    ready against into than them then some more very what when your as is it we he be at or if
    of to no an so on by do me my up us go into only also than such both few most other his
    our your its in upon nor yet too """.split()
)

_JOIN_ALLOW_2 = frozenset({"un", "re"})  # unexpected, regarding, …

# Right-hand fragment should look like a word tail (not e.g. "documents" after "human").
_W2_SUFFIX_OK = tuple(
    """
    ing tion ation ition ution sion ence ance ment ness ious eous edly ally ures ings ions ities
    icals als oons ites unes etes ges les kes ves ous ish ary ive ible
    """.split()
)


def _right_fragment_looks_continued(w2: str) -> bool:
    lw = w2.lower()
    if any(lw.endswith(s) for s in _W2_SUFFIX_OK):
        return True
    return len(lw) >= 5 and lw.endswith("ed")


def _utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _find_pdf_from_slug(slug: str) -> Path | None:
    bundle = CORPUS_ROOT / slug
    data = yaml.safe_load((bundle / "source.yaml").read_text(encoding="utf-8")) or {}
    files = data.get("files", {})
    ref = files.get("media_reference")
    if not ref:
        return None
    p = REPO_ROOT / ref
    return p if p.is_file() else None


def _join_wrapped_lines(text: str, max_rounds: int = 12) -> str:
    """Merge PDF line-wrap breaks: hyphen-newline or tight lowercase-newline-lowercase."""
    t = text
    for _ in range(max_rounds):
        n = re.sub(r"([a-z])-\n([a-z])", r"\1\2", t)
        n = re.sub(r"([a-z])\n([a-z])", r"\1 \2", n)
        if n == t:
            break
        t = n
    return t


def _join_space_wraps(text: str, max_rounds: int = 10) -> str:
    """Merge 'for\\n tunes' / 'un\\n expected' style wraps (newline + spaces between fragments)."""
    pat = re.compile(r"\b([a-z]+)\n +([a-z]+)\b")

    def repl(m: re.Match[str]) -> str:
        w1, w2 = m.group(1), m.group(2)
        if w1 in _JOIN_STOP_LEFT:
            return m.group(0)
        if len(w1) == 2 and w1 not in _JOIN_ALLOW_2:
            return m.group(0)
        if len(w1) < 2 or len(w2) < 3:
            return m.group(0)
        if len(w1) > 7 or len(w2) > 14:
            return m.group(0)
        if len(w1) + len(w2) > 21:
            return m.group(0)
        if not _right_fragment_looks_continued(w2):
            return m.group(0)
        return w1 + w2

    t = text
    for _ in range(max_rounds):
        n = pat.sub(repl, t)
        if n == t:
            break
        t = n
    return t


def _burgess_scrambled_intro(text: str) -> str:
    """Repair NYPL text layer where '\\ MONG' is out of order vs 'the papers…'."""
    return re.sub(
        r"(?m)the papers, letters, etc\.,\* presented to the Library by Mrs\. Thomas\s+\\\s+MONG\s*\n\s+of Scarsdale, New York, are two series of letters from £\\\.\s+Foljambe Burgess",
        "Among the papers, letters, etc.,* presented to the Library by Mrs. Thomas A. Foljambe Burgess of Scarsdale, New York, are two series of letters from",
        text,
        count=1,
    )


# Remaining line-wrap splits where w2 failed the generic suffix test.
_BURGESS_WRAP_FIXES: tuple[tuple[str, str], ...] = (
    (r"com\n +panion\b", "companion"),
    (r"com\n +pletely\b", "completely"),
    (r"\bcom +pletely\b", "completely"),
)


def _burgess_wrap_fixes(text: str) -> str:
    for pat, repl in _BURGESS_WRAP_FIXES:
        text = re.sub(pat, repl, text)
    return text


def _postprocess_page(text: str, *, slug: str) -> str:
    t = _join_wrapped_lines(text.strip())
    t = _join_space_wraps(t)
    if slug == "burgess-persian-letters-full-volume":
        t = _burgess_scrambled_intro(t)
        t = _burgess_wrap_fixes(t)
    return t


def extract_body(pdf_path: Path, *, slug: str = "") -> tuple[str, int]:
    import fitz

    doc = fitz.open(pdf_path)
    n = doc.page_count
    parts: list[str] = []
    for i in range(n):
        raw = doc[i].get_text(sort=True)
        body = _postprocess_page(raw, slug=slug)
        parts.append(f"<!-- page {i + 1} of {n} -->\n\n{body}")
    doc.close()
    return "\n\n".join(parts), n


BURGESS_MARKDOWN_INTRO = """# The Burgess Persian Letters

Edited by Benjamin Schwartz. Published in the *Bulletin of the New York Public Library*, 1940–1942.

Family correspondence (1827–1855) of Charles and Edward Burgess, sons of the English banker, economist, and editor Henry Burgess. Includes an appendix: interview with Anna Burgess (née Saginian), Leicester, March 1880.
"""


def build_markdown(
    *,
    pdf_rel: str,
    page_count: int,
    body: str,
    slug: str,
) -> str:
    header = "\n".join(
        [
            "---",
            f"source_file: {pdf_rel}",
            "extraction_method: pymupdf get_text(sort=True) + line-wrap join",
            f"generated: {_utc_now()}",
            f"pages: {page_count}",
            "---",
            "",
        ]
    )
    if slug == "burgess-persian-letters-full-volume":
        return header + BURGESS_MARKDOWN_INTRO + "\n\n" + body + "\n"
    return header + "\n" + body + "\n"


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--slug", required=True, help="Corpus bundle id under sources/corpus/")
    p.add_argument(
        "--output",
        type=Path,
        help="Markdown path (default: <bundle>/transcription.md)",
    )
    args = p.parse_args()

    slug = args.slug.strip()
    pdf_path = _find_pdf_from_slug(slug)
    if not pdf_path:
        print(f"No PDF (files.media_reference) for slug {slug!r}", file=sys.stderr)
        return 1

    bundle = CORPUS_ROOT / slug
    out = args.output or (bundle / "transcription.md")
    out = out.resolve()

    try:
        pdf_rel = str(pdf_path.resolve().relative_to(REPO_ROOT))
    except ValueError:
        pdf_rel = str(pdf_path)

    body, page_count = extract_body(pdf_path, slug=slug)
    md = build_markdown(
        pdf_rel=pdf_rel, page_count=page_count, body=body, slug=slug
    )
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(md, encoding="utf-8")
    print(f"Wrote {out.relative_to(REPO_ROOT)} ({len(md):,} chars, {page_count} pages)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
