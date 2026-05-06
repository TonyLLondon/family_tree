#!/usr/bin/env python3
"""Tiered source extractor for `sources/corpus/<slug>/` bundles.

Owned by `projects/ingest_source/`. See [../AGENTS.md](../AGENTS.md) for the playbook.

Core principle
--------------
Mechanical work belongs to the pipeline. Cognitive work belongs to the agent.
Pipeline rasterises PDFs to PNG, greps text layers, runs cheap OCR as a
*page-finder index* (never as a transcription source), and organises files.
Agent looks at the high-DPI PNGs to do the actual work.

Subcommands
-----------
  triage   — probe + auto-route + execute. Supports --file (skeleton bundle
             creation), --tier (auto/a/b/c), --focus (selective for big docs),
             --pages (explicit page-list render), --thumbnails (low-DPI scan
             sheet for image-only big docs), --ocr-index (Surya page-finder
             index for image-only big docs).
  probe    — write `<bundle>/probe.json` only (no outputs).
  pending  — list bundles waiting for a vision pass, ranked by cite-pressure.
  status   — show `extractions[]` and locked files for one bundle.

Usage
-----
  # New bundle from a media file:
  triage --slug X --file media/.../X.pdf

  # Selective extraction from a big text-layer doc:
  triage --slug X --tier c --focus "Burgess,Tabriz" --context 1

  # Image-only big book — discovery phase (any/all):
  triage --slug X --tier c --thumbnails               # contact sheet for agent
  triage --slug X --tier c --ocr-index                # Surya page-finder index (gitignored)
  triage --slug X --tier c --pages "1-12,760-768"     # render TOC pages high-DPI for agent
  triage --slug X --tier c --focus "Burgess"          # grep ocr-index, render hits

  # Image-only big book — extract phase (after agent picked pages):
  triage --slug X --tier c --pages "234,405-407" --dpi 300

Tiers
-----
A   Text-layer rich, single non-RTL script (Latin, Cyrillic, Greek):
    pymupdf get_text(sort=True) + line-wrap join → `transcription.md`
    (or `transcription.<lang>.md` when --lang is passed).

B   Image-only, multi-script, RTL, or handwriting (whole document):
    render every page to `<bundle>/pages-png/pNNN.png` at --dpi (default 200)
    and write `<bundle>/pages-png/manifest.json` describing per-page scripts
    and the target output files an agent (vision LLM) should write next.

C   Selective extraction from a big document (whether text-layer or not).
    Variant chosen by what's available:
      • text-layer present → grep that for --focus terms
      • image-only         → grep cached Surya OCR index for --focus terms
      • or explicit page list via --pages
    Then renders the chosen pages (± --context) to `pages-png/` (committed —
    these are what the website shows next to the transcribed snippet) and
    writes `snippets/manifest.json` with per-hit image refs and expected
    agent outputs (`transcription.snippets.md`, `translation.en.md`,
    `reference.md`).

Idempotency / safety
--------------------
Existing `transcription*.md` / `translation*.md` / `reference.md` whose frontmatter
contains `transcriber: human` OR `agent_locked: true` are NEVER overwritten unless
`--force` is passed. Each `triage` appends an entry to `source.yaml.extractions:`.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import yaml

# projects/ingest_source/runner/extract_source.py  →  parents[3] = repo root
REPO_ROOT = Path(__file__).resolve().parents[3]
CORPUS_ROOT = REPO_ROOT / "sources" / "corpus"
SOURCES_ROOT = REPO_ROOT / "sources"
PEOPLE_ROOT = REPO_ROOT / "people"
STORIES_ROOT = REPO_ROOT / "stories"
TOPICS_ROOT = REPO_ROOT / "topics"

PROBE_FILENAME = "probe.json"
PAGES_DIRNAME = "pages-png"
THUMBNAILS_DIRNAME = "thumbnails"
OCR_INDEX_DIRNAME = "_ocr_index"
SNIPPETS_DIRNAME = "snippets"
MANIFEST_FILENAME = "manifest.json"
SNIPPETS_TX_FILENAME = "transcription.snippets.md"
SCHEMA_VERSION = 1
DEFAULT_THUMBNAIL_DPI = 100


# ---------------------------------------------------------------------------
# Script detection
# ---------------------------------------------------------------------------
#
# Tally code points per page into broad script buckets. Block-based
# classification is cheaper than unicodedata.name() and good enough for
# routing decisions ("is this RTL?", "is this multi-script?").

# (script_name, is_rtl, list of (lo, hi) inclusive ranges)
_SCRIPT_RANGES: tuple[tuple[str, bool, tuple[tuple[int, int], ...]], ...] = (
    (
        "Latin",
        False,
        (
            (0x0041, 0x005A),
            (0x0061, 0x007A),
            (0x00C0, 0x024F),
            (0x1E00, 0x1EFF),
        ),
    ),
    (
        "Arabic",
        True,
        (
            (0x0600, 0x06FF),
            (0x0750, 0x077F),
            (0x08A0, 0x08FF),
            (0xFB50, 0xFDFF),
            (0xFE70, 0xFEFF),
        ),
    ),
    ("Hebrew", True, ((0x0590, 0x05FF),)),
    ("Cyrillic", False, ((0x0400, 0x04FF), (0x0500, 0x052F))),
    ("Greek", False, ((0x0370, 0x03FF), (0x1F00, 0x1FFF))),
    ("Devanagari", False, ((0x0900, 0x097F),)),
    (
        "CJK",
        False,
        (
            (0x3400, 0x4DBF),
            (0x4E00, 0x9FFF),
            (0x3040, 0x30FF),
            (0xAC00, 0xD7AF),
        ),
    ),
)

_RTL_SCRIPTS = frozenset(name for name, rtl, _ in _SCRIPT_RANGES if rtl)


def _script_for(cp: int) -> str | None:
    for name, _rtl, ranges in _SCRIPT_RANGES:
        for lo, hi in ranges:
            if lo <= cp <= hi:
                return name
    return None


def _script_tally(text: str) -> dict[str, int]:
    tally: Counter[str] = Counter()
    for ch in text:
        cat = unicodedata.category(ch)
        if cat[0] in {"Z", "C", "P", "N"}:
            continue
        s = _script_for(ord(ch))
        if s:
            tally[s] += 1
    return dict(tally)


def _dominant_scripts(tally: dict[str, int], min_share: float = 0.05) -> list[str]:
    total = sum(tally.values())
    if total == 0:
        return []
    return sorted(
        (name for name, n in tally.items() if (n / total) >= min_share),
        key=lambda n: -tally[n],
    )


# ---------------------------------------------------------------------------
# Bundle helpers
# ---------------------------------------------------------------------------


def _utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _bundle_dir(slug: str) -> Path:
    return CORPUS_ROOT / slug


def _load_yaml(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    return data if isinstance(data, dict) else {}


def _save_yaml(path: Path, data: dict[str, Any]) -> None:
    path.write_text(
        yaml.dump(
            data,
            default_flow_style=False,
            allow_unicode=True,
            sort_keys=False,
            width=1024,
        ),
        encoding="utf-8",
    )


def _find_pdf(slug: str) -> Path | None:
    bundle = _bundle_dir(slug)
    data = _load_yaml(bundle / "source.yaml")
    files = data.get("files", {})
    if isinstance(files, dict):
        media_ref = files.get("media_reference")
        if isinstance(media_ref, str) and media_ref:
            cand = REPO_ROOT / media_ref
            if cand.is_file():
                return cand
        if files.get("pdf") == "original.pdf":
            cand = bundle / "original.pdf"
            if cand.is_file():
                return cand
    cand = bundle / "original.pdf"
    return cand if cand.is_file() else None


def _ensure_skeleton_bundle(slug: str, file_path: Path) -> Path:
    """Create a bundle dir + minimal `source.yaml` if either is missing.

    `file_path` must already exist on disk and live under the repo
    (typically `media/...`). Returns the bundle directory.

    If the bundle already has a `source.yaml`, only fills in
    `files.media_reference` when it's absent — never overwrites an existing
    pointer (use `--force` semantics on the runner if needed; not done here
    to keep this helper safe).
    """
    if not file_path.is_file():
        raise SystemExit(f"--file does not exist: {file_path}")
    try:
        rel = file_path.resolve().relative_to(REPO_ROOT)
    except ValueError as exc:
        raise SystemExit(
            f"--file must live inside the repo ({REPO_ROOT}); got {file_path}"
        ) from exc

    bundle = _bundle_dir(slug)
    bundle.mkdir(parents=True, exist_ok=True)
    yaml_path = bundle / "source.yaml"
    data = _load_yaml(yaml_path)

    if not data:
        data = {
            "id": slug,
            "title": slug.replace("-", " ").title(),
            "kind": "pdf" if file_path.suffix.lower() == ".pdf" else "scan",
            "files": {"media_reference": str(rel)},
            "extractions": [],
        }
        _save_yaml(yaml_path, data)
        print(f"  created skeleton {yaml_path.relative_to(REPO_ROOT)}")
        return bundle

    files = data.get("files")
    if not isinstance(files, dict):
        files = {}
        data["files"] = files
    if not files.get("media_reference"):
        files["media_reference"] = str(rel)
        _save_yaml(yaml_path, data)
        print(f"  set files.media_reference in {yaml_path.relative_to(REPO_ROOT)}")
    return bundle


# ---------------------------------------------------------------------------
# Page-spec parsing  ("234,405-407,500" → [234, 405, 406, 407, 500])
# ---------------------------------------------------------------------------


def _parse_pages_arg(spec: str, max_page: int | None = None) -> list[int]:
    """Parse a 1-based page spec like "234,405-407,500" into a sorted unique list."""
    out: set[int] = set()
    spec = (spec or "").strip()
    if not spec:
        return []
    for chunk in spec.split(","):
        chunk = chunk.strip()
        if not chunk:
            continue
        if "-" in chunk:
            a, b = chunk.split("-", 1)
            try:
                lo, hi = int(a), int(b)
            except ValueError as exc:
                raise SystemExit(f"Bad page range {chunk!r}") from exc
            if lo > hi:
                lo, hi = hi, lo
            for n in range(lo, hi + 1):
                out.add(n)
        else:
            try:
                out.add(int(chunk))
            except ValueError as exc:
                raise SystemExit(f"Bad page number {chunk!r}") from exc
    if max_page is not None:
        out = {n for n in out if 1 <= n <= max_page}
    return sorted(out)


def _expand_with_context(pages: list[int], context: int, max_page: int) -> list[int]:
    out: set[int] = set()
    for p in pages:
        for d in range(-context, context + 1):
            n = p + d
            if 1 <= n <= max_page:
                out.add(n)
    return sorted(out)


# ---------------------------------------------------------------------------
# Probe
# ---------------------------------------------------------------------------


def probe_pdf(pdf_path: Path) -> dict[str, Any]:
    import fitz

    doc = fitz.open(pdf_path)
    pages: list[dict[str, Any]] = []
    bundle_tally: Counter[str] = Counter()

    for i in range(doc.page_count):
        page = doc[i]
        text = page.get_text() or ""
        char_count = sum(1 for ch in text if not ch.isspace())
        scripts = _script_tally(text)
        bundle_tally.update(scripts)

        page_w, page_h = page.rect.width, page.rect.height
        page_area = max(1.0, page_w * page_h)
        image_area = 0.0
        for img in page.get_images(full=True):
            try:
                rects = page.get_image_rects(img[0])
                for r in rects:
                    image_area += max(0.0, r.width) * max(0.0, r.height)
            except Exception:
                continue
        image_area_ratio = round(min(1.0, image_area / page_area), 3)

        pages.append(
            {
                "n": i + 1,
                "char_count": char_count,
                "image_area_ratio": image_area_ratio,
                "scripts": _dominant_scripts(scripts),
                "scripts_raw_counts": scripts,
            }
        )

    doc.close()

    page_count = len(pages)
    total_chars = sum(p["char_count"] for p in pages)
    pages_with_text = sum(1 for p in pages if p["char_count"] >= 200)
    image_only_pages = sum(
        1 for p in pages if p["char_count"] < 50 and p["image_area_ratio"] >= 0.6
    )
    bundle_scripts = _dominant_scripts(dict(bundle_tally))
    has_rtl = any(s in _RTL_SCRIPTS for s in bundle_scripts)
    multi_script = len(bundle_scripts) >= 2

    if page_count == 0:
        recommended_tier = "b"
        reasons = ["empty document"]
    elif image_only_pages >= max(1, int(0.5 * page_count)):
        recommended_tier = "b"
        reasons = [f"{image_only_pages}/{page_count} pages look image-only"]
    elif has_rtl:
        recommended_tier = "b"
        reasons = [f"RTL script(s) present: {bundle_scripts}"]
    elif multi_script:
        recommended_tier = "b"
        reasons = [f"multi-script document: {bundle_scripts}"]
    elif pages_with_text >= max(1, int(0.5 * page_count)):
        recommended_tier = "a"
        reasons = [
            f"{pages_with_text}/{page_count} pages have a usable text layer",
            f"single non-RTL script: {bundle_scripts or ['(none detected)']}",
        ]
    else:
        recommended_tier = "b"
        reasons = ["sparse text layer; vision pass needed"]

    return {
        "schema": SCHEMA_VERSION,
        "probed_at": _utc_now(),
        "source_pdf": str(pdf_path.resolve().relative_to(REPO_ROOT)),
        "page_count": page_count,
        "total_chars": total_chars,
        "pages_with_text_layer": pages_with_text,
        "image_only_pages": image_only_pages,
        "bundle_scripts": bundle_scripts,
        "is_rtl": has_rtl,
        "is_multi_script": multi_script,
        "recommended_tier": recommended_tier,
        "recommendation_reasons": reasons,
        "pages": pages,
    }


# ---------------------------------------------------------------------------
# Tier A — text layer + line-wrap join
# ---------------------------------------------------------------------------

_JOIN_STOP_LEFT = frozenset(
    """
    the and are but not you all had her was one our out day get has him his how man new now
    see two who boy did its let say she too use any may will can that with have this from they
    been were said each which their time would there could about other after first never these
    think where being those under while might every great shall still whole often among women
    ready against into than them then some more very what when your as is it we he be at or if
    of to no an so on by do me my up us go into only also than such both few most other his
    our your its in upon nor yet too
    """.split()
)
_JOIN_ALLOW_2 = frozenset({"un", "re"})
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


def _join_wrapped_lines(text: str, max_rounds: int = 12) -> str:
    t = text
    for _ in range(max_rounds):
        n = re.sub(r"([a-z])-\n([a-z])", r"\1\2", t)
        n = re.sub(r"([a-z])\n([a-z])", r"\1 \2", n)
        if n == t:
            break
        t = n
    return t


def _join_space_wraps(text: str, max_rounds: int = 10) -> str:
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


def _postprocess_text(text: str) -> str:
    return _join_space_wraps(_join_wrapped_lines(text.strip()))


def tier_a_extract(pdf_path: Path) -> tuple[str, int]:
    import fitz

    doc = fitz.open(pdf_path)
    n = doc.page_count
    parts: list[str] = []
    for i in range(n):
        body = _postprocess_text(doc[i].get_text(sort=True))
        parts.append(f"<!-- page {i + 1} of {n} -->\n\n{body}")
    doc.close()
    return "\n\n".join(parts), n


# ---------------------------------------------------------------------------
# Tier B — render pages to PNG + manifest
# ---------------------------------------------------------------------------


def _render_pages(
    pdf_path: Path,
    out_dir: Path,
    dpi: int,
    pages: list[int] | None = None,
    skip_existing: bool = False,
) -> list[Path]:
    """Render `pages` (1-based) — or every page when None — at `dpi` to `out_dir/pNNN.png`.

    Returns the list of files written (or already present, when skip_existing).
    """
    import fitz

    out_dir.mkdir(parents=True, exist_ok=True)
    doc = fitz.open(pdf_path)
    page_count = doc.page_count
    target = pages if pages is not None else list(range(1, page_count + 1))
    written: list[Path] = []
    for n in target:
        if n < 1 or n > page_count:
            continue
        out = out_dir / f"p{n:03d}.png"
        if out.is_file() and skip_existing:
            written.append(out)
            continue
        pix = doc[n - 1].get_pixmap(dpi=dpi)
        pix.save(out)
        written.append(out)
    doc.close()
    return written


def _render_thumbnails(pdf_path: Path, out_dir: Path, dpi: int) -> list[Path]:
    """Render every page at low DPI to `out_dir/tNNN.png` (regenerable, gitignored)."""
    import fitz

    out_dir.mkdir(parents=True, exist_ok=True)
    doc = fitz.open(pdf_path)
    written: list[Path] = []
    for i in range(doc.page_count):
        out = out_dir / f"t{i + 1:03d}.png"
        if out.is_file():
            written.append(out)
            continue
        pix = doc[i].get_pixmap(dpi=dpi)
        pix.save(out)
        written.append(out)
    doc.close()
    return written


# ---------------------------------------------------------------------------
# Focus search — text-layer (Tier C) and OCR-index (Tier C+)
# ---------------------------------------------------------------------------


def _compile_focus(terms: list[str], use_regex: bool) -> list[tuple[str, "re.Pattern[str]"]]:
    out: list[tuple[str, re.Pattern[str]]] = []
    for t in terms:
        t = t.strip()
        if not t:
            continue
        pat = re.compile(t if use_regex else re.escape(t), re.IGNORECASE)
        out.append((t, pat))
    return out


def _make_preview(text: str, span: tuple[int, int], width: int = 80) -> str:
    """Return a one-line ±width-char window around `span` in `text` for the manifest."""
    start = max(0, span[0] - width)
    end = min(len(text), span[1] + width)
    snippet = text[start:end]
    snippet = re.sub(r"\s+", " ", snippet).strip()
    if start > 0:
        snippet = "…" + snippet
    if end < len(text):
        snippet = snippet + "…"
    return snippet


def _hits_in_text(text: str, focus: list[tuple[str, "re.Pattern[str]"]]) -> tuple[list[str], str]:
    """Return (matched_terms, preview_around_first_match) for one page's text."""
    matched: list[str] = []
    first_span: tuple[int, int] | None = None
    for term, pat in focus:
        m = pat.search(text)
        if m:
            matched.append(term)
            if first_span is None:
                first_span = m.span()
    preview = _make_preview(text, first_span) if first_span else ""
    return matched, preview


def _text_layer_hits(
    pdf_path: Path,
    focus: list[tuple[str, "re.Pattern[str]"]],
) -> tuple[list[dict[str, Any]], dict[int, str]]:
    """Walk the text layer page by page, return (hits, per_page_text)."""
    import fitz

    doc = fitz.open(pdf_path)
    hits: list[dict[str, Any]] = []
    per_page: dict[int, str] = {}
    for i in range(doc.page_count):
        text = doc[i].get_text(sort=True) or ""
        per_page[i + 1] = text
        matched, preview = _hits_in_text(text, focus)
        if matched:
            hits.append(
                {
                    "page": i + 1,
                    "terms": matched,
                    "preview": preview,
                    "source": "text_layer",
                }
            )
    doc.close()
    return hits, per_page


def _ocr_index_dir(bundle: Path) -> Path:
    return bundle / OCR_INDEX_DIRNAME


def _ocr_index_pages_present(index_dir: Path) -> set[int]:
    out: set[int] = set()
    if not index_dir.is_dir():
        return out
    for p in index_dir.glob("p*.txt"):
        m = re.match(r"p(\d{3,})\.txt$", p.name)
        if m:
            out.add(int(m.group(1)))
    return out


def _build_ocr_index(
    pdf_path: Path,
    bundle: Path,
    pages: list[int] | None = None,
) -> tuple[Path, list[int]]:
    """Run Surya OCR over the PDF, cache per-page text into `_ocr_index/pNNN.txt`.

    The index is **never published**; it exists only as a page-finder for
    Tier C+ focus search. Skips pages already cached unless absent.
    Returns (index_dir, pages_freshly_indexed).
    """
    import fitz
    import shutil
    import subprocess
    import tempfile

    index_dir = _ocr_index_dir(bundle)
    index_dir.mkdir(parents=True, exist_ok=True)

    doc = fitz.open(pdf_path)
    page_count = doc.page_count
    doc.close()

    target = pages if pages is not None else list(range(1, page_count + 1))
    target = [n for n in target if 1 <= n <= page_count]
    have = _ocr_index_pages_present(index_dir)
    todo = [n for n in target if n not in have]
    if not todo:
        return index_dir, []

    surya_bin = shutil.which("surya_ocr") or str((REPO_ROOT / ".venv" / "bin" / "surya_ocr"))
    if not Path(surya_bin).is_file():
        raise SystemExit(
            "surya_ocr not found. Install with `.venv/bin/pip install surya-ocr`."
        )

    # Surya's --page_range is 0-based.
    page_arg = ",".join(str(n - 1) for n in todo)

    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        cmd = [
            surya_bin,
            str(pdf_path),
            "--page_range",
            page_arg,
            "--output_dir",
            str(tmp_path),
        ]
        print(f"  surya_ocr {len(todo)} page(s)…")
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            sys.stderr.write(result.stderr)
            raise SystemExit("surya_ocr failed; see stderr above")

        # Surya writes <output_dir>/<pdf_stem>/results.json (and other artefacts).
        result_json = next(tmp_path.rglob("results.json"), None)
        if not result_json:
            raise SystemExit(
                f"surya_ocr produced no results.json in {tmp_path}; "
                "check the version and CLI surface."
            )
        try:
            data = json.loads(result_json.read_text(encoding="utf-8"))
        except Exception as exc:
            raise SystemExit(f"could not parse surya results.json: {exc}") from exc

        # Surya v0.17 result shape: {"<doc_stem>": [ {page_number, text_lines:[{text,...}], ...}, ... ] }
        per_doc = next(iter(data.values())) if isinstance(data, dict) else data
        if not isinstance(per_doc, list):
            raise SystemExit("unexpected surya results.json shape")

        written: list[int] = []
        for entry in per_doc:
            if not isinstance(entry, dict):
                continue
            page_number_zero = entry.get("page")
            if page_number_zero is None:
                page_number_zero = entry.get("page_number")
            if page_number_zero is None:
                continue
            n = int(page_number_zero) + 1  # surya is 0-based
            lines = entry.get("text_lines") or []
            text_parts: list[str] = []
            for ln in lines:
                if isinstance(ln, dict):
                    t = ln.get("text")
                    if isinstance(t, str):
                        text_parts.append(t)
            (index_dir / f"p{n:03d}.txt").write_text(
                "\n".join(text_parts), encoding="utf-8"
            )
            written.append(n)

    return index_dir, sorted(written)


def _ocr_index_hits(
    bundle: Path,
    focus: list[tuple[str, "re.Pattern[str]"]],
) -> tuple[list[dict[str, Any]], dict[int, str]]:
    """Grep the cached OCR index for focus terms, return (hits, per_page_text)."""
    index_dir = _ocr_index_dir(bundle)
    if not index_dir.is_dir():
        return [], {}
    hits: list[dict[str, Any]] = []
    per_page: dict[int, str] = {}
    for p in sorted(index_dir.glob("p*.txt")):
        m = re.match(r"p(\d{3,})\.txt$", p.name)
        if not m:
            continue
        n = int(m.group(1))
        text = p.read_text(encoding="utf-8")
        per_page[n] = text
        matched, preview = _hits_in_text(text, focus)
        if matched:
            hits.append(
                {
                    "page": n,
                    "terms": matched,
                    "preview": preview,
                    "source": "ocr_index",
                }
            )
    return hits, per_page


# ---------------------------------------------------------------------------
# Snippets manifest (Tier C / C+)
# ---------------------------------------------------------------------------


def _write_evidence_files(
    bundle: Path,
    hits: list[dict[str, Any]],
    per_page_text: dict[int, str],
) -> list[Path]:
    """Write per-page evidence text (text-layer slice or OCR slice) into `snippets/`.

    Evidence is the raw text the pipeline used to find the hit — it lets a
    downstream agent see *why* a page was selected without re-running search.
    """
    snippets_dir = bundle / SNIPPETS_DIRNAME
    snippets_dir.mkdir(parents=True, exist_ok=True)
    written: list[Path] = []
    for h in hits:
        n = h["page"]
        text = per_page_text.get(n, "")
        if not text:
            continue
        out = snippets_dir / f"p{n:03d}.evidence.txt"
        out.write_text(text, encoding="utf-8")
        written.append(out)
    return written


def write_snippets_manifest(
    bundle: Path,
    pdf_path: Path,
    variant: str,                        # "C" or "C+"
    focus_terms: list[str],
    use_regex: bool,
    context: int,
    hits: list[dict[str, Any]],
    rendered_pages: list[int],
    page_count: int,
    dpi: int,
) -> Path:
    """Write the vision-handoff brief at `snippets/manifest.json`."""
    snippets_dir = bundle / SNIPPETS_DIRNAME
    snippets_dir.mkdir(parents=True, exist_ok=True)

    enriched_hits: list[dict[str, Any]] = []
    for i, h in enumerate(hits, start=1):
        anchor = h["page"]
        rendered_for_hit = sorted(
            n for n in range(anchor - context, anchor + context + 1)
            if 1 <= n <= page_count and n in set(rendered_pages)
        )
        enriched_hits.append(
            {
                "id": f"h{i:03d}",
                "anchor_page": anchor,
                "rendered_pages": rendered_for_hit,
                "terms": h.get("terms", []),
                "source": h.get("source", "unknown"),
                "preview": h.get("preview", ""),
                "evidence_file": f"{SNIPPETS_DIRNAME}/p{anchor:03d}.evidence.txt",
                "image_files": [
                    f"{PAGES_DIRNAME}/p{n:03d}.png" for n in rendered_for_hit
                ],
            }
        )

    manifest = {
        "schema": SCHEMA_VERSION,
        "kind": "tier-c-snippets",
        "variant": variant,
        "generated_at": _utc_now(),
        "slug": bundle.name,
        "source_pdf": str(pdf_path.resolve().relative_to(REPO_ROOT)),
        "page_count": page_count,
        "dpi": dpi,
        "focus": {
            "terms": focus_terms,
            "match": "regex" if use_regex else "substring",
            "context": context,
        },
        "hits": enriched_hits,
        "rendered_pages": rendered_pages,
        "agent_instructions": {
            "task": (
                "For each hit, look at the PNGs listed in `image_files` and write "
                "the transcribed text into `transcription.snippets.md` under a "
                "section heading per hit. Use the rendered PNGs as the source of "
                "truth — the `preview` and `evidence_file` are search aids only "
                "(text layers misread old typefaces; OCR misreads even more)."
            ),
            "expected_outputs": [
                f"{SNIPPETS_TX_FILENAME}  (per-hit transcribed text)",
                "translation.en.md  (English translation if any non-English content)",
                "reference.md  (English commentary, IDs, dates, links to people/*.md)",
            ],
            "snippet_format": (
                "## Hit hNNN — p.<anchor> — match: <terms>\n\n"
                "<transcribed text exactly as on page>\n\n"
                "[image: ../../sources/corpus/<slug>/pages-png/p<anchor>.png]"
            ),
            "frontmatter_template": {
                "language": "<iso-639-1>",
                "source_file": str(pdf_path.resolve().relative_to(REPO_ROOT)),
                "source_pages": "list of anchor pages",
                "transcriber": "agent",
                "agent_model": "<model name>",
                "agent_date": "<utc timestamp>",
                "agent_locked": False,
                "verified": False,
            },
            "do_not_overwrite": (
                "Files whose frontmatter has `transcriber: human` OR "
                "`agent_locked: true` must be left untouched."
            ),
            "log_when_done": (
                "Append a `stage: vision` entry to source.yaml under "
                "`extractions:`, naming the files written and the agent_model."
            ),
        },
    }
    out = snippets_dir / MANIFEST_FILENAME
    out.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    return out


def _persist_focus_in_yaml(
    yaml_path: Path,
    focus_terms: list[str],
    use_regex: bool,
    context: int,
    variant: str,
    hits: list[dict[str, Any]],
    rendered_pages: list[int],
) -> None:
    data = _load_yaml(yaml_path)
    if focus_terms:
        data["focus"] = {
            "terms": focus_terms,
            "match": "regex" if use_regex else "substring",
            "context": context,
        }
    tier_c = data.get("tier_c") or {}
    if not isinstance(tier_c, dict):
        tier_c = {}
    tier_c["variant"] = variant
    if hits:
        tier_c["hits"] = [
            {
                "page": h["page"],
                "terms": h.get("terms", []),
                "preview": h.get("preview", ""),
                "source": h.get("source", "unknown"),
            }
            for h in hits
        ]
    existing_rendered = set(tier_c.get("rendered_pages") or [])
    existing_rendered.update(rendered_pages)
    tier_c["rendered_pages"] = sorted(existing_rendered)
    data["tier_c"] = tier_c
    _save_yaml(yaml_path, data)


def _expected_outputs_for(probe: dict[str, Any]) -> list[str]:
    scripts = probe.get("bundle_scripts") or []
    out: list[str] = []
    lang_hint = {
        "Latin": "transcription.<lang>.md (Latin-script; pick fr/it/de/la/en as appropriate)",
        "Arabic": "transcription.fa.md or transcription.ar.md (Arabic-script — Persian vs Arabic)",
        "Hebrew": "transcription.he.md",
        "Cyrillic": "transcription.ru.md (or other Cyrillic language)",
        "Greek": "transcription.el.md",
        "Devanagari": "transcription.hi.md",
        "CJK": "transcription.zh.md / .ja.md / .ko.md",
    }
    for s in scripts:
        if s in lang_hint:
            out.append(lang_hint[s])
    if not out:
        out.append(
            "transcription.<lang>.md (no script detected from the text layer; identify it from the rendered PNGs)"
        )
    out.append("translation.en.md (English translation of the document)")
    out.append(
        "reference.md (English commentary: structured fields, cross-confirmations, "
        "links to people/*.md, genealogical position)"
    )
    return out


def write_tier_b_manifest(
    bundle: Path,
    pdf_path: Path,
    probe: dict[str, Any],
    page_paths: list[Path],
    dpi: int,
) -> Path:
    manifest = {
        "schema": SCHEMA_VERSION,
        "kind": "vision-handoff",
        "generated_at": _utc_now(),
        "slug": bundle.name,
        "source_pdf": str(pdf_path.resolve().relative_to(REPO_ROOT)),
        "dpi": dpi,
        "page_count": len(page_paths),
        "bundle_scripts": probe.get("bundle_scripts", []),
        "is_rtl": probe.get("is_rtl", False),
        "is_multi_script": probe.get("is_multi_script", False),
        "pages": [
            {
                "n": i + 1,
                "image": f"{PAGES_DIRNAME}/{p.name}",
                "scripts_detected": probe["pages"][i]["scripts"]
                if i < len(probe.get("pages", []))
                else [],
                "char_count": probe["pages"][i]["char_count"]
                if i < len(probe.get("pages", []))
                else 0,
                "image_area_ratio": probe["pages"][i]["image_area_ratio"]
                if i < len(probe.get("pages", []))
                else None,
            }
            for i, p in enumerate(page_paths)
        ],
        "agent_instructions": {
            "task": (
                "Read every PNG in pages-png/ and write the expected output files "
                "into the same bundle directory. Each output gets YAML frontmatter "
                "with `language:` (ISO 639-1) and `transcriber:` (\"agent\" or \"human\"). "
                "Set `agent_locked: true` once the file is final to prevent re-overwrites."
            ),
            "expected_outputs": _expected_outputs_for(probe),
            "do_not_overwrite": (
                "Files whose frontmatter has `transcriber: human` OR `agent_locked: true` "
                "must be left untouched."
            ),
            "image_links_in_md": (
                "Reference page facsimiles via repo-relative paths "
                "(e.g. ../../sources/corpus/<slug>/pages-png/p001.png) so the web app can render them."
            ),
            "frontmatter_template": {
                "language": "<iso-639-1>",
                "source_file": str(pdf_path.resolve().relative_to(REPO_ROOT)),
                "source_pages": "1-N",
                "transcriber": "agent",
                "agent_model": "<model name>",
                "agent_date": "<utc timestamp>",
                "agent_locked": False,
                "verified": False,
            },
            "log_when_done": (
                "Append a `stage: vision` entry to source.yaml under `extractions:`, "
                "naming the files written and the agent_model used."
            ),
        },
    }
    out = bundle / PAGES_DIRNAME / MANIFEST_FILENAME
    out.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    return out


# ---------------------------------------------------------------------------
# Idempotency / write helpers
# ---------------------------------------------------------------------------


_FRONTMATTER_RE = re.compile(r"^---\n(.*?)\n---\n", re.DOTALL)


def _read_frontmatter(path: Path) -> dict[str, Any] | None:
    if not path.exists():
        return None
    try:
        m = _FRONTMATTER_RE.match(path.read_text(encoding="utf-8"))
        if not m:
            return {}
        data = yaml.safe_load(m.group(1)) or {}
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def _is_locked(path: Path) -> str | None:
    fm = _read_frontmatter(path)
    if fm is None:
        return None
    if fm.get("agent_locked") is True:
        return "agent_locked: true"
    transcriber = fm.get("transcriber")
    if isinstance(transcriber, str) and transcriber.lower() == "human":
        return "transcriber: human"
    return None


def _write_protected(path: Path, body: str, force: bool) -> bool:
    if path.exists() and not force:
        reason = _is_locked(path)
        if reason:
            print(f"  SKIP {path.relative_to(REPO_ROOT)} ({reason}); pass --force to override")
            return False
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(body, encoding="utf-8")
    print(f"  wrote {path.relative_to(REPO_ROOT)}")
    return True


def _append_extraction(yaml_path: Path, record: dict[str, Any]) -> None:
    data = _load_yaml(yaml_path)
    extractions = data.get("extractions")
    if not isinstance(extractions, list):
        extractions = []
    extractions.append(record)
    data["extractions"] = extractions
    _save_yaml(yaml_path, data)


# ---------------------------------------------------------------------------
# Subcommand: probe
# ---------------------------------------------------------------------------


def cmd_probe(args: argparse.Namespace) -> int:
    bundle = _bundle_dir(args.slug)
    pdf = _find_pdf(args.slug)
    if not pdf:
        print(f"No PDF for slug {args.slug!r}", file=sys.stderr)
        return 1
    probe = probe_pdf(pdf)
    out = bundle / PROBE_FILENAME
    out.write_text(json.dumps(probe, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Probed {pdf.relative_to(REPO_ROOT)}")
    print(f"  pages={probe['page_count']} chars={probe['total_chars']} scripts={probe['bundle_scripts']}")
    print(
        f"  recommended tier: {probe['recommended_tier'].upper()} — "
        f"{'; '.join(probe['recommendation_reasons'])}"
    )
    print(f"  wrote {out.relative_to(REPO_ROOT)}")
    return 0


# ---------------------------------------------------------------------------
# Subcommand: triage
# ---------------------------------------------------------------------------


def cmd_triage(args: argparse.Namespace) -> int:
    # --file: skeleton-create the bundle if missing.
    if args.file:
        _ensure_skeleton_bundle(args.slug, Path(args.file).resolve())

    bundle = _bundle_dir(args.slug)
    pdf = _find_pdf(args.slug)
    if not pdf:
        print(
            f"No PDF for slug {args.slug!r}. "
            "Pass --file media/path/to.pdf to create the bundle from a media file.",
            file=sys.stderr,
        )
        return 1

    probe = probe_pdf(pdf)
    bundle.mkdir(parents=True, exist_ok=True)
    (bundle / PROBE_FILENAME).write_text(
        json.dumps(probe, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    tier = args.tier
    if tier == "auto":
        tier = probe["recommended_tier"]
    tier = tier.lower()

    print(f"Slug: {args.slug}")
    print(f"PDF:  {pdf.relative_to(REPO_ROOT)}")
    print(
        f"Probe: pages={probe['page_count']} scripts={probe['bundle_scripts']} → tier {tier.upper()}"
    )

    yaml_path = bundle / "source.yaml"

    if tier == "a":
        return _do_tier_a(bundle, yaml_path, pdf, args)
    if tier == "b":
        return _do_tier_b(bundle, yaml_path, pdf, probe, args)
    if tier == "c":
        return _do_tier_c(bundle, yaml_path, pdf, probe, args)

    print(f"Unknown tier: {tier!r}", file=sys.stderr)
    return 2


# ---------------------------------------------------------------------------
# Tier dispatch helpers (factored out of cmd_triage for readability)
# ---------------------------------------------------------------------------


def _do_tier_a(bundle: Path, yaml_path: Path, pdf: Path, args: argparse.Namespace) -> int:
    body, n_pages = tier_a_extract(pdf)
    lang = (args.lang or "").strip().lower()
    out_name = f"transcription.{lang}.md" if lang else "transcription.md"
    out_path = bundle / out_name
    header_lines = [
        "---",
        f"source_file: {pdf.resolve().relative_to(REPO_ROOT)}",
        "generator: projects/ingest_source/runner/extract_source.py tier-a (pymupdf get_text(sort=True) + wrap-join)",
        f"generated: {_utc_now()}",
        f"pages: {n_pages}",
    ]
    if lang:
        header_lines.append(f"language: {lang}")
    header_lines += [
        "transcriber: machine",
        "verified: false",
        "agent_locked: false",
        "---",
        "",
    ]
    full = "\n".join(header_lines) + body + "\n"
    written: list[str] = []
    if _write_protected(out_path, full, force=args.force):
        written.append(out_name)

    _append_extraction(
        yaml_path,
        {
            "at": _utc_now(),
            "stage": "triage",
            "tier": "a",
            "engine": "pymupdf get_text(sort=True) + wrap-join",
            "pages": n_pages,
            "files_written": written,
        },
    )
    return 0


def _do_tier_b(
    bundle: Path,
    yaml_path: Path,
    pdf: Path,
    probe: dict[str, Any],
    args: argparse.Namespace,
) -> int:
    out_dir = bundle / PAGES_DIRNAME
    page_paths = _render_pages(pdf, out_dir, args.dpi)
    for p in page_paths:
        print(f"  rendered {p.relative_to(REPO_ROOT)}")
    manifest_path = write_tier_b_manifest(bundle, pdf, probe, page_paths, args.dpi)
    print(f"  wrote {manifest_path.relative_to(REPO_ROOT)}")

    _append_extraction(
        yaml_path,
        {
            "at": _utc_now(),
            "stage": "render",
            "tier": "b",
            "engine": "pymupdf rasterise + manifest (vision handoff)",
            "pages": len(page_paths),
            "dpi": args.dpi,
            "files_written": [f"{PAGES_DIRNAME}/{p.name}" for p in page_paths]
            + [f"{PAGES_DIRNAME}/{MANIFEST_FILENAME}"],
        },
    )
    print(
        "\nNext: open the PNGs above with vision and write the expected outputs "
        f"listed in {manifest_path.relative_to(REPO_ROOT)}."
    )
    return 0


def _do_tier_c(
    bundle: Path,
    yaml_path: Path,
    pdf: Path,
    probe: dict[str, Any],
    args: argparse.Namespace,
) -> int:
    """Selective extraction. Variant chosen automatically.

    Operating modes (any one per invocation):
      --thumbnails  → render low-DPI scan sheet (image-only docs only).
      --ocr-index   → run/refresh Surya page-finder index (image-only docs).
      --focus T,…   → grep text-layer (C) or ocr-index (C+); render hits ± context.
      --pages SPEC  → render those specific pages at --dpi to pages-png/.
    """
    page_count = probe.get("page_count") or 0
    has_text_layer = (probe.get("pages_with_text_layer") or 0) > max(
        1, int(0.2 * page_count)
    )
    variant = "C" if has_text_layer else "C+"

    # Mode 1: thumbnails (regenerable, gitignored). Lets the agent scan visually.
    if args.thumbnails:
        thumb_dir = bundle / THUMBNAILS_DIRNAME
        rendered = _render_thumbnails(pdf, thumb_dir, args.thumb_dpi)
        print(
            f"  rendered {len(rendered)} thumbnails at {args.thumb_dpi} DPI → "
            f"{thumb_dir.relative_to(REPO_ROOT)}/ (gitignored)"
        )
        _append_extraction(
            yaml_path,
            {
                "at": _utc_now(),
                "stage": "thumbnails",
                "tier": "c",
                "variant": variant,
                "engine": "pymupdf rasterise (low DPI, gitignored)",
                "pages": len(rendered),
                "dpi": args.thumb_dpi,
                "files_written": [f"{THUMBNAILS_DIRNAME}/{p.name}" for p in rendered],
            },
        )
        print(
            "\nNext: open thumbnails/, scan them visually, then run "
            f"`triage --slug {args.slug} --tier c --pages \"…\"` for the pages you want at high DPI."
        )
        return 0

    # Mode 2: OCR index (regenerable, gitignored). Page-finder only.
    if args.ocr_index:
        if has_text_layer:
            print(
                "  note: this PDF has a text layer; --ocr-index is intended for image-only docs. "
                "Continuing anyway."
            )
        page_subset = (
            _parse_pages_arg(args.ocr_index_pages, max_page=page_count)
            if args.ocr_index_pages
            else None
        )
        index_dir, fresh = _build_ocr_index(pdf, bundle, pages=page_subset)
        print(
            f"  ocr-index: {len(fresh)} new page(s) cached → "
            f"{index_dir.relative_to(REPO_ROOT)}/ (gitignored)"
        )
        _append_extraction(
            yaml_path,
            {
                "at": _utc_now(),
                "stage": "ocr-index",
                "tier": "c",
                "variant": "C+",
                "engine": "surya_ocr (page-finder index; never published)",
                "pages": len(fresh),
                "files_written": [
                    f"{OCR_INDEX_DIRNAME}/p{n:03d}.txt" for n in fresh
                ],
            },
        )
        print(
            "\nNext: run `triage --slug {slug} --tier c --focus \"terms\"` "
            "to grep the index and render hits.".format(slug=args.slug)
        )
        return 0

    # Mode 3 & 4: focus search and/or explicit page list — both end in render + manifest.
    focus_terms = [t.strip() for t in (args.focus or "").split(",") if t.strip()]
    explicit_pages = (
        _parse_pages_arg(args.pages, max_page=page_count) if args.pages else []
    )

    if not focus_terms and not explicit_pages:
        print(
            "Tier C needs one of: --focus, --pages, --thumbnails, --ocr-index. "
            "Pass --plan-only with --focus to preview the hit table without writing.",
            file=sys.stderr,
        )
        return 2

    hits: list[dict[str, Any]] = []
    per_page_text: dict[int, str] = {}

    if focus_terms:
        focus = _compile_focus(focus_terms, use_regex=args.regex)
        if variant == "C":
            hits, per_page_text = _text_layer_hits(pdf, focus)
        else:
            if not _ocr_index_pages_present(_ocr_index_dir(bundle)):
                print(
                    "Tier C+: no OCR index present. Run "
                    f"`triage --slug {args.slug} --tier c --ocr-index` first.",
                    file=sys.stderr,
                )
                return 1
            hits, per_page_text = _ocr_index_hits(bundle, focus)
        print(f"  focus: {focus_terms} ({'regex' if args.regex else 'substring'})")
        print(f"  hits:  {len(hits)} page(s)")
        for h in hits[:20]:
            preview = h.get("preview") or ""
            print(f"    p.{h['page']:>4}  [{','.join(h['terms'])}]  {preview[:90]}")
        if len(hits) > 20:
            print(f"    … {len(hits) - 20} more")

    # Compose the page set we will render at high DPI.
    hit_pages = [h["page"] for h in hits]
    pages_to_render = sorted(
        set(_expand_with_context(hit_pages, args.context, page_count))
        | set(explicit_pages)
    )

    if not pages_to_render:
        print("  nothing to render (no hits, no --pages).")
        return 0

    if args.plan_only:
        print(f"\nPlan: would render {len(pages_to_render)} page(s) at {args.dpi} DPI:")
        print(f"  {pages_to_render}")
        return 0

    out_dir = bundle / PAGES_DIRNAME
    rendered = _render_pages(
        pdf, out_dir, args.dpi, pages=pages_to_render, skip_existing=not args.force
    )
    for p in rendered:
        print(f"  rendered {p.relative_to(REPO_ROOT)}")

    if hits:
        evidence_files = _write_evidence_files(bundle, hits, per_page_text)
        for p in evidence_files:
            print(f"  wrote {p.relative_to(REPO_ROOT)}")

    manifest_path = write_snippets_manifest(
        bundle=bundle,
        pdf_path=pdf,
        variant=variant,
        focus_terms=focus_terms,
        use_regex=args.regex,
        context=args.context,
        hits=hits,
        rendered_pages=pages_to_render,
        page_count=page_count,
        dpi=args.dpi,
    )
    print(f"  wrote {manifest_path.relative_to(REPO_ROOT)}")

    _persist_focus_in_yaml(
        yaml_path,
        focus_terms=focus_terms,
        use_regex=args.regex,
        context=args.context,
        variant=variant,
        hits=hits,
        rendered_pages=pages_to_render,
    )

    _append_extraction(
        yaml_path,
        {
            "at": _utc_now(),
            "stage": "render",
            "tier": "c",
            "variant": variant,
            "engine": (
                "pymupdf rasterise + tier-c snippets manifest "
                f"(index={'text_layer' if variant == 'C' else 'ocr_index'})"
            ),
            "focus_terms": focus_terms,
            "hits": len(hits),
            "pages": len(pages_to_render),
            "dpi": args.dpi,
            "files_written": [f"{PAGES_DIRNAME}/{p.name}" for p in rendered]
            + [f"{SNIPPETS_DIRNAME}/{MANIFEST_FILENAME}"]
            + [f"{SNIPPETS_DIRNAME}/p{h['page']:03d}.evidence.txt" for h in hits],
        },
    )

    print(
        "\nNext: look at the rendered PNGs above and write the expected outputs "
        f"listed in {manifest_path.relative_to(REPO_ROOT)}."
    )
    return 0


# ---------------------------------------------------------------------------
# Subcommand: pending
# ---------------------------------------------------------------------------


_TX_FILE_RE = re.compile(
    r"^(transcription|translation|reference)([-.].*)?\.md$", re.IGNORECASE
)
_EXPECTED_FILE_RE = re.compile(
    r"\b((?:transcription|translation|reference)[\w.\-]*\.md)\b", re.IGNORECASE
)


def _bundle_has_any_transcription(bundle: Path) -> bool:
    """True if the bundle contains any human/agent transcription/translation/reference file."""
    for p in bundle.iterdir():
        if not p.is_file():
            continue
        name = p.name.lower()
        if name in {"extracted.pdf.md", "extracted.web.md"}:
            continue
        if _TX_FILE_RE.match(name):
            return True
    return False


def _expected_files_from_manifest(manifest: dict[str, Any]) -> list[str]:
    """Extract expected output filenames from a manifest's agent_instructions.expected_outputs.

    Each list entry is free-form prose with the filename embedded
    (e.g. "transcription.fa.md (Persian column)"). We pull the .md tokens.
    """
    raw = manifest.get("agent_instructions", {}).get("expected_outputs") or []
    found: list[str] = []
    for line in raw:
        for m in _EXPECTED_FILE_RE.finditer(str(line)):
            name = m.group(1).lower()
            if name not in found:
                found.append(name)
    return found


def _cite_pressure(slug: str) -> int:
    """Count references to this corpus slug from people/, stories/, topics/ markdown.

    Uses a non-word-character lookahead to avoid prefix collisions
    (e.g. `corpus/burgess` would otherwise match `corpus/burgess-persian-letters`).
    """
    pattern = re.compile(rf"corpus/{re.escape(slug)}(?=[/?#\"'\)\s]|$)")
    n = 0
    for root in (PEOPLE_ROOT, STORIES_ROOT, TOPICS_ROOT):
        if not root.exists():
            continue
        for p in root.rglob("*.md"):
            try:
                if pattern.search(p.read_text(encoding="utf-8")):
                    n += 1
            except Exception:
                continue
    return n


def _bundle_pending_state(bundle: Path) -> dict[str, Any] | None:
    """Inspect a bundle and return a pending descriptor, or None if not pending.

    A bundle is pending if it has a vision-handoff manifest (Tier B at
    `pages-png/manifest.json` or Tier C/C+ at `snippets/manifest.json`) and
    is missing one or more files named in that manifest's expected_outputs.
    """
    tier_b_manifest = bundle / PAGES_DIRNAME / MANIFEST_FILENAME
    tier_c_manifest = bundle / SNIPPETS_DIRNAME / MANIFEST_FILENAME

    descriptors: list[dict[str, Any]] = []
    for kind, mpath in (
        ("tier-b", tier_b_manifest),
        ("tier-c", tier_c_manifest),
    ):
        if not mpath.is_file():
            continue
        try:
            data = json.loads(mpath.read_text(encoding="utf-8"))
        except Exception:
            data = {}
        expected = _expected_files_from_manifest(data)
        if expected:
            present = {p.name.lower() for p in bundle.iterdir() if p.is_file()}
            missing = [f for f in expected if f not in present]
        else:
            # No structured expected_outputs — fall back to the loose
            # "any transcription/translation/reference file" check.
            missing = [] if _bundle_has_any_transcription(bundle) else ["(any transcription file)"]
        if missing:
            descriptors.append(
                {
                    "kind": kind,
                    "manifest": str(mpath.relative_to(REPO_ROOT)),
                    "page_count": int(data.get("page_count") or 0),
                    "expected": expected,
                    "missing": missing,
                    "raw_expected_lines": data.get("agent_instructions", {}).get(
                        "expected_outputs", []
                    ),
                }
            )

    if not descriptors:
        return None
    return {"descriptors": descriptors}


def cmd_pending(args: argparse.Namespace) -> int:
    rows: list[tuple[int, str, dict[str, Any]]] = []
    for bundle in sorted(CORPUS_ROOT.iterdir()):
        if not bundle.is_dir() or bundle.name.startswith("."):
            continue
        state = _bundle_pending_state(bundle)
        if state is None:
            continue
        cites = _cite_pressure(bundle.name)
        rows.append((cites, bundle.name, state))

    rows.sort(key=lambda r: (-r[0], r[1]))

    if not rows:
        print(
            "No vision-pending bundles. "
            "(Every bundle with a vision-handoff manifest has the expected outputs in place.)"
        )
        return 0

    print(f"Vision-pending bundles ({len(rows)}):\n")
    for cites, slug, state in rows:
        cite_label = f"{cites} cite{'s' if cites != 1 else ''}"
        print(f"- [{cite_label:>9}] {slug}")
        for d in state["descriptors"]:
            print(f"      {d['kind']:>6}  manifest: {d['manifest']}  ({d['page_count']} pages)")
            for line in d.get("raw_expected_lines") or []:
                print(f"        → {line}")
            if d["missing"]:
                print(f"        missing: {', '.join(d['missing'])}")
    print(
        "\nWork order: take the top of the list, open the manifest for that bundle, "
        "look at the rendered PNGs, write the missing expected output files."
    )
    return 0


# ---------------------------------------------------------------------------
# Subcommand: status
# ---------------------------------------------------------------------------


def cmd_status(args: argparse.Namespace) -> int:
    bundle = _bundle_dir(args.slug)
    if not bundle.is_dir():
        print(f"No bundle at {bundle.relative_to(REPO_ROOT)}", file=sys.stderr)
        return 1

    yaml_path = bundle / "source.yaml"
    data = _load_yaml(yaml_path)
    title = data.get("title") or args.slug
    print(f"# {args.slug}")
    print(f"  title: {title}")
    files_field = data.get("files")
    if isinstance(files_field, dict):
        media_ref = files_field.get("media_reference")
        if media_ref:
            print(f"  media_reference: {media_ref}")

    extractions = data.get("extractions") or []
    if not extractions:
        print("\n  extractions[]: (none recorded)")
    else:
        print(f"\n  extractions[] ({len(extractions)}):")
        for e in extractions:
            line = "    - "
            for k in ("at", "stage", "tier", "engine", "pages", "agent_model"):
                v = e.get(k)
                if v is not None:
                    line += f"{k}={v} "
            print(line.rstrip())
            for fn in e.get("files_written", []) or []:
                print(f"        · {fn}")

    print("\n  files in bundle:")
    for p in sorted(bundle.iterdir()):
        if not p.is_file():
            continue
        marker = ""
        if p.suffix.lower() == ".md":
            lock = _is_locked(p)
            if lock:
                marker = f"  [LOCKED — {lock}]"
            else:
                fm = _read_frontmatter(p) or {}
                ver = fm.get("verified")
                if ver is False:
                    marker = "  [verified: false]"
                elif ver is True:
                    marker = "  [verified: true]"
        print(f"    · {p.name}{marker}")

    pages_dir = bundle / PAGES_DIRNAME
    if pages_dir.is_dir():
        n = sum(1 for _ in pages_dir.glob("*.png"))
        manifest = pages_dir / MANIFEST_FILENAME
        print(f"    · {PAGES_DIRNAME}/  ({n} PNGs{' + manifest.json' if manifest.is_file() else ''})")

    snippets_dir = bundle / SNIPPETS_DIRNAME
    if snippets_dir.is_dir():
        evidence_n = sum(1 for _ in snippets_dir.glob("*.evidence.txt"))
        manifest = snippets_dir / MANIFEST_FILENAME
        print(
            f"    · {SNIPPETS_DIRNAME}/  ({evidence_n} evidence file"
            f"{'s' if evidence_n != 1 else ''}"
            f"{' + manifest.json' if manifest.is_file() else ''})"
        )

    thumbs_dir = bundle / THUMBNAILS_DIRNAME
    if thumbs_dir.is_dir():
        n = sum(1 for _ in thumbs_dir.glob("*.png"))
        print(f"    · {THUMBNAILS_DIRNAME}/  ({n} PNGs, gitignored)")

    ocr_dir = bundle / OCR_INDEX_DIRNAME
    if ocr_dir.is_dir():
        n = sum(1 for _ in ocr_dir.glob("p*.txt"))
        print(f"    · {OCR_INDEX_DIRNAME}/  ({n} pages indexed, gitignored)")

    pending = _bundle_pending_state(bundle)
    if pending:
        print("\n  pending:")
        for d in pending["descriptors"]:
            print(f"    - {d['kind']} manifest: missing {', '.join(d['missing'])}")

    cites = _cite_pressure(args.slug)
    print(f"\n  cite-pressure (people/ + stories/ + topics/ links): {cites}")
    return 0


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> int:
    p = argparse.ArgumentParser(
        description="Tiered source extractor (projects/ingest_source/). See ../AGENTS.md.",
    )
    sub = p.add_subparsers(dest="cmd", required=True)

    pp = sub.add_parser("probe", help="Diagnose a PDF and write probe.json")
    pp.add_argument("--slug", required=True, help="Folder name under sources/corpus/")
    pp.set_defaults(func=cmd_probe)

    pt = sub.add_parser(
        "triage",
        help="Probe + auto-route + execute (Tier A/B/C). Pass --file to create a new bundle.",
    )
    pt.add_argument("--slug", required=True)
    pt.add_argument(
        "--file",
        default="",
        help="Path to a media file (typically media/...). Creates the bundle skeleton "
        "(source.yaml with files.media_reference) if it doesn't already exist.",
    )
    pt.add_argument(
        "--tier",
        choices=["auto", "a", "b", "c"],
        default="auto",
        help="Override probe routing. Tier C is selective extraction; "
        "the C/C+ variant is chosen automatically by text-layer presence.",
    )
    pt.add_argument(
        "--lang",
        default="",
        help="Tier A only: ISO 639-1 language code (e.g. en, fr, it). "
        "Determines output filename `transcription.<lang>.md` and frontmatter.",
    )
    pt.add_argument("--dpi", type=int, default=200, help="High-DPI raster (default 200)")

    # Tier C controls.
    pt.add_argument(
        "--focus",
        default="",
        help="Tier C: comma-separated focus terms. Greps the text layer (C) or "
        "the cached OCR index (C+).",
    )
    pt.add_argument(
        "--regex",
        action="store_true",
        help="Tier C: treat --focus terms as regex (default is case-insensitive substring).",
    )
    pt.add_argument(
        "--context",
        type=int,
        default=1,
        help="Tier C: pages either side of each hit to also render (default 1).",
    )
    pt.add_argument(
        "--pages",
        default="",
        help="Tier C: explicit page list/ranges to render at high DPI (e.g. \"1-12,234,405-407\").",
    )
    pt.add_argument(
        "--plan-only",
        action="store_true",
        help="Tier C: show the hit table and the page list that would be rendered, write nothing.",
    )
    pt.add_argument(
        "--thumbnails",
        action="store_true",
        help="Tier C+: render every page at low DPI to thumbnails/ (gitignored) for an agent visual scan.",
    )
    pt.add_argument(
        "--thumb-dpi",
        type=int,
        default=DEFAULT_THUMBNAIL_DPI,
        help=f"Tier C+ --thumbnails DPI (default {DEFAULT_THUMBNAIL_DPI}).",
    )
    pt.add_argument(
        "--ocr-index",
        action="store_true",
        help="Tier C+: build/refresh the Surya page-finder index in _ocr_index/ (gitignored, never published).",
    )
    pt.add_argument(
        "--ocr-index-pages",
        default="",
        help="Tier C+ --ocr-index: limit to these pages (default: all). Format like --pages.",
    )

    pt.add_argument(
        "--force",
        action="store_true",
        help="Overwrite outputs even if locked (transcriber: human / agent_locked: true). "
        "Also re-renders pages that already exist in pages-png/.",
    )
    pt.set_defaults(func=cmd_triage)

    pl = sub.add_parser(
        "pending",
        help="List bundles that have pages-png/manifest.json but no transcription file yet",
    )
    pl.set_defaults(func=cmd_pending)

    ps = sub.add_parser("status", help="Show extractions[] and locked files for one bundle")
    ps.add_argument("--slug", required=True)
    ps.set_defaults(func=cmd_status)

    args = p.parse_args()
    return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main())
