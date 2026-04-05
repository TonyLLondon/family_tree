#!/usr/bin/env python3
"""
Re-extract broken machine-OCR corpus files using marker-pdf (Surya OCR).

Single file:
  .venv/bin/python scripts/marker_reextract.py --slug petition-swiss-political-department-bern-russian-ee8fdb0857

From manifest (batch):
  .venv/bin/python scripts/marker_reextract.py --manifest sources/corpus/reextract-manifest.yaml

Options:
  --force-ocr     Force OCR on every page (use for image-only scans)
  --dry-run       Show what would be processed without writing
  --backup        Keep old extracted.pdf.md as extracted.pdf.md.bak
"""

from __future__ import annotations

import argparse
import sys
from datetime import datetime, timezone
from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parents[1]
CORPUS_ROOT = REPO_ROOT / "sources" / "corpus"


def _utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _find_pdf(slug: str) -> Path | None:
    """Locate the source PDF for a corpus bundle."""
    bundle = CORPUS_ROOT / slug
    yaml_path = bundle / "source.yaml"
    if yaml_path.exists():
        data = yaml.safe_load(yaml_path.read_text(encoding="utf-8")) or {}
        files = data.get("files", {})
        media_ref = files.get("media_reference")
        if media_ref:
            candidate = REPO_ROOT / media_ref
            if candidate.is_file():
                return candidate
        if files.get("pdf") == "original.pdf":
            candidate = bundle / "original.pdf"
            if candidate.is_file():
                return candidate
    candidate = bundle / "original.pdf"
    if candidate.is_file():
        return candidate
    return None


def _build_converter(force_ocr: bool):
    """Create a marker PdfConverter (loads models once, reuse across files)."""
    from marker.config.parser import ConfigParser
    from marker.converters.pdf import PdfConverter
    from marker.models import create_model_dict

    config = {
        "output_format": "markdown",
        "paginate_output": True,
        "force_ocr": force_ocr,
    }
    config_parser = ConfigParser(config)
    artifact_dict = create_model_dict()
    converter = PdfConverter(
        config=config_parser.generate_config_dict(),
        artifact_dict=artifact_dict,
        processor_list=config_parser.get_processors(),
        renderer=config_parser.get_renderer(),
    )
    return converter


def _extract(converter, pdf_path: Path) -> str:
    """Run marker on a PDF and return paginated markdown."""
    from marker.output import text_from_rendered

    rendered = converter(str(pdf_path))
    text, _, _ = text_from_rendered(rendered)
    return text


def _write_result(slug: str, md_text: str, pdf_path: Path, *, backup: bool) -> Path:
    """Write extracted.pdf.md with standard frontmatter."""
    bundle = CORPUS_ROOT / slug
    md_path = bundle / "extracted.pdf.md"

    if backup and md_path.exists():
        bak = md_path.with_suffix(".md.bak")
        bak.write_text(md_path.read_text(encoding="utf-8"), encoding="utf-8")

    rel = None
    try:
        rel = str(pdf_path.resolve().relative_to(REPO_ROOT))
    except ValueError:
        pass
    source_label = rel or str(pdf_path)

    header = (
        "---\n"
        f"generated: {_utc_now()}\n"
        "generator: marker-pdf\n"
        f'source_file: "{source_label}"\n'
        "page_markers: true\n"
        "---\n\n"
    )
    md_path.write_text(header + md_text, encoding="utf-8")
    return md_path


def process_slug(
    slug: str,
    converter,
    *,
    force_ocr_override: bool | None = None,
    dry_run: bool = False,
    backup: bool = False,
) -> bool:
    """Process a single corpus slug. Returns True on success."""
    pdf_path = _find_pdf(slug)
    if not pdf_path:
        print(f"  SKIP {slug}: no PDF found", file=sys.stderr)
        return False

    size_mb = pdf_path.stat().st_size / (1024 * 1024)
    print(f"  {slug}")
    print(f"    PDF: {pdf_path.relative_to(REPO_ROOT)} ({size_mb:.1f} MB)")

    if dry_run:
        print("    (dry run — would re-extract)")
        return True

    md_text = _extract(converter, pdf_path)
    out = _write_result(slug, md_text, pdf_path, backup=backup)
    word_count = len(md_text.split())
    print(f"    -> {out.relative_to(REPO_ROOT)} ({word_count} words)")
    return True


def main() -> int:
    p = argparse.ArgumentParser(
        description="Re-extract broken corpus PDFs using marker-pdf (Surya OCR)"
    )
    p.add_argument("--slug", help="Single corpus slug to re-extract")
    p.add_argument(
        "--manifest",
        type=Path,
        help="YAML manifest listing slugs to re-extract",
    )
    p.add_argument(
        "--force-ocr",
        action="store_true",
        help="Force OCR on every page (for image-only scans)",
    )
    p.add_argument("--dry-run", action="store_true", help="Show plan without writing")
    p.add_argument(
        "--backup",
        action="store_true",
        help="Keep old extracted.pdf.md as .bak before overwriting",
    )
    args = p.parse_args()

    if not args.slug and not args.manifest:
        p.error("Provide --slug or --manifest")

    slugs: list[dict] = []
    if args.slug:
        slugs = [{"slug": args.slug}]
    else:
        manifest_path = args.manifest.expanduser().resolve()
        if not manifest_path.is_file():
            print(f"Manifest not found: {manifest_path}", file=sys.stderr)
            return 1
        raw = yaml.safe_load(manifest_path.read_text(encoding="utf-8"))
        if not isinstance(raw, list):
            print("Manifest root must be a YAML list.", file=sys.stderr)
            return 1
        slugs = raw

    force_ocr_global = args.force_ocr

    print(f"Loading marker models...", flush=True)
    converter = _build_converter(force_ocr=force_ocr_global)
    print(f"Processing {len(slugs)} file(s):\n")

    ok = 0
    fail = 0
    for item in slugs:
        slug = item if isinstance(item, str) else item.get("slug", "")
        if not slug:
            continue
        force = force_ocr_global
        if isinstance(item, dict) and item.get("force_ocr"):
            force = True
        try:
            if process_slug(
                slug,
                converter,
                force_ocr_override=force,
                dry_run=args.dry_run,
                backup=args.backup,
            ):
                ok += 1
            else:
                fail += 1
        except Exception as e:
            print(f"  ERROR {slug}: {e}", file=sys.stderr)
            fail += 1

    print(f"\nDone: {ok} succeeded, {fail} failed/skipped")
    return 0 if fail == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
