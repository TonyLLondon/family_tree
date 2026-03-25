#!/usr/bin/env python3
"""
Ingest remote or local sources into sources/corpus/<slug>/ with provenance in source.yaml.

  # PDF from URL → corpus/original.pdf + extracted.pdf.md + source.yaml (no media/ copy)
  python scripts/ingest_source.py pdf --slug levantine-freemasonry \\
    --url https://example.com/doc.pdf \\
    --title "Freemasonry in the Middle East"

  # PDF under repo: read from media/ (or any path); do NOT duplicate bytes into corpus.
  # Set --media-reference to repo-relative path if the file is outside the repo.
  python scripts/ingest_source.py pdf --slug bottin-contract \\
    --file media/albums/henderson/Bottin\\ Contract.pdf \\
    --title "..."

  # Web page → mirror.html + extracted.web.md
  python scripts/ingest_source.py web --slug connections-saginian-interview \\
    --url https://connectionsbmc.wordpress.com/2013/01/14/134/ \\
    --title "Saginian interview notes"

  # Wikipedia (403 to httpx): fetch REST HTML, store canonical article URL
  python scripts/ingest_source.py web --slug my-wiki-page \\
    --url https://en.wikipedia.org/api/rest_v1/page/html/Example \\
    --public-url https://en.wikipedia.org/wiki/Example \\
    --title "Wikipedia: Example"

Re-fetch: run the same command again; source.yaml appends a fetch record and
overwrites mirror / extract files when content changed.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx
import yaml

REPO_ROOT = Path(__file__).resolve().parents[1]
CORPUS_ROOT = REPO_ROOT / "sources" / "corpus"

# Wikipedia and some archives return 403 without a browser-like User-Agent.
_DEFAULT_HTTP_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    )
}


def _repo_relative(path: Path) -> str | None:
    try:
        return str(path.resolve().relative_to(REPO_ROOT))
    except ValueError:
        return None


def _utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def _load_yaml(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    return data if isinstance(data, dict) else {}


def _save_yaml(path: Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
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


def _markdown_from_pdf(path: Path, *, page_markers: bool) -> str:
    import pymupdf4llm

    if not page_markers:
        return pymupdf4llm.to_markdown(str(path))
    chunks = pymupdf4llm.to_markdown(str(path), page_chunks=True)
    if isinstance(chunks, str):
        return chunks
    parts: list[str] = []
    for i, ch in enumerate(chunks, start=1):
        text = (ch.get("text") or "").strip()
        parts.append(f"<!-- page {i} -->\n\n{text}")
    return "\n\n".join(parts)


def _append_fetch(data: dict[str, Any], record: dict[str, Any]) -> None:
    data.setdefault("fetches", [])
    if not isinstance(data["fetches"], list):
        data["fetches"] = []
    data["fetches"].append(record)


def cmd_pdf(args: argparse.Namespace) -> int:
    import pymupdf4llm

    slug = args.slug.strip().replace(" ", "-")
    bundle = CORPUS_ROOT / slug
    bundle.mkdir(parents=True, exist_ok=True)
    corpus_pdf = bundle / "original.pdf"
    md_path = bundle / "extracted.pdf.md"
    yaml_path = bundle / "source.yaml"

    data = _load_yaml(yaml_path)
    data.setdefault("id", slug)
    if args.title:
        data["title"] = args.title
    data.setdefault("remote", {})
    if args.url:
        data["remote"]["primary_pdf_url"] = args.url
    if args.webpage_url:
        data["remote"]["webpage_url"] = args.webpage_url

    headers: dict[str, str] = {}
    read_path: Path
    source_file_label: str
    files_block: dict[str, Any] = {"pdf_markdown": "extracted.pdf.md"}

    if args.file:
        src = Path(args.file).expanduser().resolve()
        if not src.is_file():
            print(f"File not found: {src}", file=sys.stderr)
            return 1
        read_path = src
        media_ref = (args.media_reference or "").strip() or (_repo_relative(src) or "")
        if not media_ref:
            print(
                "File is outside the repo root; pass --media-reference with a repo-relative path "
                "(e.g. media/docs/report.pdf).",
                file=sys.stderr,
            )
            return 1
        canon = (REPO_ROOT / media_ref).resolve()
        if canon != src.resolve():
            print(
                f"--file ({src}) must be the same file as repo path {media_ref!r} ({canon}).",
                file=sys.stderr,
            )
            return 1
        source_file_label = media_ref
        files_block["media_reference"] = media_ref
        corpus_pdf.unlink(missing_ok=True)
    elif args.url:
        with httpx.Client(
            follow_redirects=True, timeout=120.0, headers=dict(_DEFAULT_HTTP_HEADERS)
        ) as client:
            with client.stream("GET", args.url) as resp:
                resp.raise_for_status()
                headers = {k.lower(): v for k, v in resp.headers.items()}
                first = True
                with corpus_pdf.open("wb") as out:
                    for chunk in resp.iter_bytes(chunk_size=1024 * 1024):
                        if first:
                            if not chunk.startswith(b"%PDF"):
                                print(
                                    "Response does not look like a PDF (missing %PDF header).",
                                    file=sys.stderr,
                                )
                                corpus_pdf.unlink(missing_ok=True)
                                return 1
                            first = False
                        out.write(chunk)
        read_path = corpus_pdf
        source_file_label = "original.pdf"
        files_block["pdf"] = "original.pdf"
    else:
        print("Provide --url or --file for pdf ingest.", file=sys.stderr)
        return 1

    sha = _sha256_file(read_path)
    fetch_record: dict[str, Any] = {
        "kind": "pdf",
        "at": _utc_now(),
        "sha256": sha,
        "bytes": read_path.stat().st_size,
    }
    if args.url and not args.file:
        fetch_record["remote_url"] = args.url
        if "last-modified" in headers:
            fetch_record["http_last_modified"] = headers["last-modified"]
        if "etag" in headers:
            fetch_record["http_etag"] = headers["etag"]
    if args.file:
        fetch_record["media_reference"] = files_block["media_reference"]

    _append_fetch(data, fetch_record)

    data["files"] = files_block

    page_markers = not getattr(args, "no_page_markers", False)
    md_text = _markdown_from_pdf(read_path, page_markers=page_markers)
    header = (
        "---\n"
        f"generated: {_utc_now()}\n"
        "generator: pymupdf4llm\n"
        f"source_file: {json.dumps(source_file_label, ensure_ascii=False)}\n"
        f"page_markers: {json.dumps(page_markers)}\n"
        "---\n\n"
    )
    md_path.write_text(header + md_text, encoding="utf-8")

    _save_yaml(yaml_path, data)
    if args.file:
        print(f"Canonical PDF (not copied): {files_block['media_reference']}\n      {md_path}\n      {yaml_path}")
    else:
        print(f"Wrote {corpus_pdf}\n      {md_path}\n      {yaml_path}")
    return 0


def cmd_web(args: argparse.Namespace) -> int:
    import trafilatura

    slug = args.slug.strip().replace(" ", "-")
    bundle = CORPUS_ROOT / slug
    bundle.mkdir(parents=True, exist_ok=True)
    html_path = bundle / "mirror.html"
    md_path = bundle / "extracted.web.md"
    yaml_path = bundle / "source.yaml"

    data = _load_yaml(yaml_path)
    data.setdefault("id", slug)
    if args.title:
        data["title"] = args.title
    data.setdefault("remote", {})
    fetch_url = args.url
    public_url = getattr(args, "public_url", None) or fetch_url
    data["remote"]["webpage_url"] = public_url
    if public_url != fetch_url:
        data["remote"]["fetch_url"] = fetch_url

    headers: dict[str, str] = {}
    try:
        with httpx.Client(
            follow_redirects=True, timeout=60.0, headers=dict(_DEFAULT_HTTP_HEADERS)
        ) as client:
            resp = client.get(fetch_url)
            resp.raise_for_status()
            raw_html = resp.text
            headers = {k.lower(): v for k, v in resp.headers.items()}
    except httpx.HTTPStatusError as exc:
        # Wikimedia often returns 403 to library TLS fingerprints; curl works.
        if exc.response.status_code != 403:
            raise
        body = (exc.response.text or "")[:2000]
        if "wikimedia" not in body.lower() and "mediawiki" not in body.lower():
            raise
        r = subprocess.run(
            [
                "curl",
                "-sSL",
                "--max-time",
                "120",
                "-A",
                _DEFAULT_HTTP_HEADERS["User-Agent"],
                fetch_url,
            ],
            capture_output=True,
            text=True,
            timeout=130,
        )
        if r.returncode != 0:
            raise RuntimeError(
                f"curl fallback failed ({r.returncode}): {r.stderr[:500]!r}"
            ) from exc
        raw_html = r.stdout

    html_path.write_text(raw_html, encoding="utf-8")

    md_body = trafilatura.extract(
        raw_html,
        url=public_url,
        output_format="markdown",
        include_comments=False,
        include_tables=True,
    )
    if not md_body:
        md_body = "(trafilatura produced no main text — page may be JS-only or blocked)\n"

    header = (
        "---\n"
        f"generated: {_utc_now()}\n"
        "generator: trafilatura\n"
        "source_file: mirror.html\n"
        f"source_url: {json.dumps(public_url)}\n"
        "---\n\n"
    )
    md_path.write_text(header + md_body, encoding="utf-8")

    fetch_record: dict[str, Any] = {
        "kind": "web",
        "at": _utc_now(),
        "remote_url": fetch_url,
        "sha256": _sha256_file(html_path),
        "bytes": html_path.stat().st_size,
    }
    if "last-modified" in headers:
        fetch_record["http_last_modified"] = headers["last-modified"]
    if "etag" in headers:
        fetch_record["http_etag"] = headers["etag"]

    _append_fetch(data, fetch_record)
    data["files"] = {**(data.get("files") or {}), "html_mirror": "mirror.html", "web_markdown": "extracted.web.md"}
    _save_yaml(yaml_path, data)

    print(f"Wrote {html_path}\n      {md_path}\n      {yaml_path}")
    return 0


def cmd_status(args: argparse.Namespace) -> int:
    """HEAD request: compare ETag / Last-Modified to last fetch (if any)."""
    slug = args.slug.strip().replace(" ", "-")
    yaml_path = CORPUS_ROOT / slug / "source.yaml"
    if not yaml_path.exists():
        print(f"No bundle at {yaml_path}", file=sys.stderr)
        return 1
    data = _load_yaml(yaml_path)
    remote = data.get("remote") or {}
    url = args.url or remote.get("primary_pdf_url") or remote.get("webpage_url")
    if not url:
        print("No URL in source.yaml and none passed with --url.", file=sys.stderr)
        return 1
    with httpx.Client(
        follow_redirects=True, timeout=30.0, headers=dict(_DEFAULT_HTTP_HEADERS)
    ) as client:
        r = client.head(url)
        if r.status_code == 405 or r.status_code == 501:
            r = client.get(url, headers={"Range": "bytes=0-0"})
        r.raise_for_status()
    lm = r.headers.get("last-modified")
    et = r.headers.get("etag")
    print(f"HEAD/GET {url}")
    print(f"  Last-Modified: {lm!r}")
    print(f"  ETag: {et!r}")
    fetches = data.get("fetches") or []
    if fetches:
        last = fetches[-1]
        print(f"Last recorded fetch: {last.get('at')}")
        print(f"  stored etag: {last.get('http_etag')!r}")
        print(f"  stored last-modified: {last.get('http_last_modified')!r}")
    return 0


def main() -> int:
    p = argparse.ArgumentParser(description="Ingest PDFs and web pages into sources/corpus/")
    sub = p.add_subparsers(dest="cmd", required=True)

    pp = sub.add_parser("pdf", help="Fetch or copy a PDF and extract Markdown")
    pp.add_argument("--slug", required=True, help="Folder name under sources/corpus/")
    pp.add_argument("--url", help="Remote PDF URL to download")
    pp.add_argument("--file", help="Local PDF path")
    pp.add_argument("--title", help="Human title stored in source.yaml")
    pp.add_argument(
        "--webpage-url",
        help="Optional landing / catalog page (not the PDF); stored for humans and re-fetch context",
    )
    pp.add_argument(
        "--media-reference",
        help="Canonical scan path under repo root (e.g. media/docs/foo.pdf); stored in source.yaml",
    )
    pp.add_argument(
        "--no-page-markers",
        action="store_true",
        help="Omit <!-- page N --> boundaries (default: emit one HTML comment per PDF page).",
    )
    pp.set_defaults(func=cmd_pdf)

    pw = sub.add_parser("web", help="Mirror an HTML page and extract Markdown")
    pw.add_argument("--slug", required=True)
    pw.add_argument("--url", required=True, help="URL to fetch (may be MediaWiki REST HTML API)")
    pw.add_argument(
        "--public-url",
        help="Canonical page URL for humans (stored in source.yaml as webpage_url)",
    )
    pw.add_argument("--title", help="Human title stored in source.yaml")
    pw.set_defaults(func=cmd_web)

    ps = sub.add_parser("status", help="Show remote Last-Modified/ETag vs last fetch")
    ps.add_argument("--slug", required=True)
    ps.add_argument("--url", help="Override URL from source.yaml")
    ps.set_defaults(func=cmd_status)

    args = p.parse_args()
    return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main())
