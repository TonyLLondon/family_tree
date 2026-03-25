#!/usr/bin/env python3
"""
Run ingest_source.py pdf for each entry in a YAML manifest (batch corpus refresh).

  python scripts/batch_pdf_extract.py
  python scripts/batch_pdf_extract.py --manifest sources/corpus/pdf-ingest-manifest.yaml

Manifest schema (list of objects):
  slug: corpus folder name
  file: repo-relative path to PDF under media/ (or repo)
  title: stored in source.yaml
  no_page_markers: optional bool (default false)
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MANIFEST = REPO_ROOT / "sources" / "corpus" / "pdf-ingest-manifest.yaml"
INGEST = REPO_ROOT / "scripts" / "ingest_source.py"


def main() -> int:
    p = argparse.ArgumentParser(description="Batch PDF → corpus extract via ingest_source.py")
    p.add_argument(
        "--manifest",
        type=Path,
        default=DEFAULT_MANIFEST,
        help=f"YAML file (default: {DEFAULT_MANIFEST.relative_to(REPO_ROOT)})",
    )
    args = p.parse_args()
    path = args.manifest.expanduser().resolve()
    if not path.is_file():
        print(f"Manifest not found: {path}", file=sys.stderr)
        return 1
    raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    if not isinstance(raw, list):
        print("Manifest root must be a YAML list.", file=sys.stderr)
        return 1
    for i, item in enumerate(raw):
        if not isinstance(item, dict):
            print(f"Item {i} must be a mapping.", file=sys.stderr)
            return 1
        slug = item.get("slug")
        file_rel = item.get("file")
        title = item.get("title")
        if not slug or not file_rel or not title:
            print(f"Item {i} needs slug, file, title.", file=sys.stderr)
            return 1
        cmd: list[str] = [
            sys.executable,
            str(INGEST),
            "pdf",
            "--slug",
            str(slug),
            "--file",
            str(file_rel),
            "--title",
            str(title),
        ]
        if item.get("no_page_markers"):
            cmd.append("--no-page-markers")
        print("Running:", " ".join(cmd), flush=True)
        r = subprocess.run(cmd, cwd=REPO_ROOT)
        if r.returncode != 0:
            return int(r.returncode)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
