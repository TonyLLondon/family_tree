#!/usr/bin/env python3
"""
Ingest every PDF under media/ not already referenced in any corpus bundle (source.yaml
files.media_reference). Idempotent: safe to re-run; skips completed paths automatically.

**Default (easy tier):** skips fan charts, bulk NYPL scan folders (…/burgess-persian-letters/1/–9/),
and files larger than 12 MB (big books / long OCR). Use `--all` to ingest everything.

  .venv/bin/python scripts/ingest_all_media_pdfs.py --dry-run
  .venv/bin/python scripts/ingest_all_media_pdfs.py --limit 5
  .venv/bin/python scripts/ingest_all_media_pdfs.py
  .venv/bin/python scripts/ingest_all_media_pdfs.py --all

Failures append to sources/corpus/.media-pdf-ingest-failures.log; the run continues.

Slug: basename kebab + short SHA-256 of repo-relative path. media/charts/ and files
≥ 50 MB use --no-page-markers (when those files are processed under `--all`).
"""

from __future__ import annotations

import argparse
import hashlib
import re
import subprocess
import sys
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parents[1]
MEDIA_ROOT = REPO_ROOT / "media"
CORPUS_ROOT = REPO_ROOT / "sources" / "corpus"
FAIL_LOG = CORPUS_ROOT / ".media-pdf-ingest-failures.log"
INGEST = REPO_ROOT / "scripts" / "ingest_source.py"

SIZE_NO_MARKERS = 50 * 1024 * 1024
# Easy tier: skip huge PDFs and paths that are almost always slow (charts, per-page NYPL dumps).
EASY_MAX_BYTES = 12 * 1024 * 1024
_BULK_NYPL_SCAN = re.compile(r"burgess-persian-letters/[1-9]/", re.IGNORECASE)


def _repo_rel(path: Path) -> str:
    return path.resolve().relative_to(REPO_ROOT).as_posix()


def _media_references_in_corpus() -> set[str]:
    refs: set[str] = set()
    for yp in CORPUS_ROOT.glob("*/source.yaml"):
        data = yaml.safe_load(yp.read_text(encoding="utf-8"))
        if not isinstance(data, dict):
            continue
        mr = (data.get("files") or {}).get("media_reference")
        if isinstance(mr, str) and mr.strip():
            refs.add(mr.strip().replace("\\", "/"))
    return refs


def _ascii_slug(s: str, max_len: int = 48) -> str:
    s = unicodedata.normalize("NFKD", s)
    s = s.encode("ascii", "ignore").decode("ascii")
    s = s.lower()
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    if len(s) > max_len:
        s = s[:max_len].rstrip("-")
    return s or "pdf"


def _slug_for(rel: str) -> str:
    digest = hashlib.sha256(rel.encode("utf-8")).hexdigest()[:10]
    stem = Path(rel).stem
    return f"{_ascii_slug(stem)}-{digest}"


def _skipped_easy_tier(rel: str, path: Path) -> str | None:
    """If this PDF is excluded from the easy tier, return a short reason; else None."""
    r = rel.replace("\\", "/")
    if "media/charts/" in r.lower():
        return "charts"
    try:
        if path.stat().st_size > EASY_MAX_BYTES:
            return f"size>{EASY_MAX_BYTES // (1024 * 1024)}MiB"
    except OSError:
        return "stat"
    if _BULK_NYPL_SCAN.search(r):
        return "nypl-scan-folder"
    return None


def main() -> int:
    p = argparse.ArgumentParser(description="Ingest all media/**/*.pdf missing from corpus")
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--limit", type=int, default=0, help="Max new ingests (0 = no limit)")
    p.add_argument(
        "--all",
        action="store_true",
        help="Include charts, NYPL folders 1–9, and files over 12 MiB (full sweep; can be very slow).",
    )
    args = p.parse_args()
    easy_only = not args.all

    refs = _media_references_in_corpus()
    seen_paths: set[Path] = set()
    unique: list[Path] = []
    for path in sorted(MEDIA_ROOT.rglob("*.pdf"), key=lambda x: str(x).lower()):
        rp = path.resolve()
        if rp in seen_paths:
            continue
        seen_paths.add(rp)
        unique.append(rp)

    pending: list[Path] = []
    skipped: list[tuple[str, str]] = []
    for path in unique:
        rel = _repo_rel(path)
        if rel in refs:
            continue
        if easy_only:
            why = _skipped_easy_tier(rel, path)
            if why:
                skipped.append((rel, why))
                continue
        pending.append(path)

    print(f"Corpus media_reference count: {len(refs)}", flush=True)
    print(f"PDFs under media/: {len(unique)}", flush=True)
    if easy_only:
        print(f"Skipped (easy-tier exclude): {len(skipped)}  (--all to include)", flush=True)
    print(f"Pending ingest: {len(pending)}", flush=True)

    if args.dry_run:
        for path in pending:
            print(_repo_rel(path), flush=True)
        if easy_only and skipped:
            print("\n# excluded (easy tier):", flush=True)
            for rel, why in skipped[:80]:
                print(f"# [{why}] {rel}", flush=True)
            if len(skipped) > 80:
                print(f"# ... {len(skipped) - 80} more excluded", flush=True)
        return 0

    ok = 0
    for path in pending:
        if args.limit and ok >= args.limit:
            break
        rel = _repo_rel(path)
        slug = _slug_for(rel)
        title = Path(rel).stem.replace("_", " ")[:200]
        cmd = [
            sys.executable,
            str(INGEST),
            "pdf",
            "--slug",
            slug,
            "--file",
            rel,
            "--title",
            title,
        ]
        rel_lower = rel.lower()
        if "media/charts/" in rel_lower or path.stat().st_size >= SIZE_NO_MARKERS:
            cmd.append("--no-page-markers")

        print(f"\n[{ok + 1}/{len(pending)}] {rel}", flush=True)
        r = subprocess.run(cmd, cwd=REPO_ROOT)
        if r.returncode != 0:
            with FAIL_LOG.open("a", encoding="utf-8") as log:
                log.write(f"{datetime.now(timezone.utc).isoformat()} rc={r.returncode} {rel}\n")
            print(f"FAILED → {FAIL_LOG.relative_to(REPO_ROOT)}", flush=True)
            continue
        refs.add(rel)
        ok += 1

    print(f"\nFinished: {ok} new corpus bundle(s); failures in {FAIL_LOG.relative_to(REPO_ROOT)}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
