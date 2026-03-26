#!/usr/bin/env python3
"""
Find broken repo-relative targets in Markdown and story sidecars.

Checks:
  - Inline Markdown links/images: [text](url) and ![alt](url)
  - HTML: <img src="...">
  - stories/*.scrolly.json: steps[].media.src (and any other "src" string that
    looks like a repo-relative path)

Skips remote URLs (http/https/mailto/data), bare fragments (#...), and by default
machine corpus extracts (extracted.pdf.md / extracted.web.md) which are noisy.

Exit 1 if any broken link; 0 if all resolved.

Usage:
  .venv/bin/python scripts/check_markdown_links.py
  .venv/bin/python scripts/check_markdown_links.py --include-corpus-extracts
  .venv/bin/python scripts/check_markdown_links.py research/ stories/
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from urllib.parse import unquote

REPO_ROOT = Path(__file__).resolve().parent.parent

EXTERNAL_PREFIXES = (
    "http://",
    "https://",
    "//",
    "mailto:",
    "data:",
    "ftp:",
    "tel:",
)

# Start of inline [text]( ... — destination parsed separately (handles ") in paths)
INLINE_LINK_START_RE = re.compile(r"!?\[[^\]]*\]\(")

IMG_SRC_RE = re.compile(
    r"""<img\b[^>]*\bsrc\s*=\s*(["'])(.*?)\1""",
    re.IGNORECASE | re.DOTALL,
)


def _parse_inline_link_destination(text: str, open_paren_idx: int) -> tuple[str | None, int]:
    """
    Parse CommonMark-style link destination after the opening `(` of `](`.
    open_paren_idx is the index OF that `(`.
    Returns (destination or None, next_index_after_closing_paren).
    """
    i = open_paren_idx + 1
    n = len(text)
    while i < n and text[i] in " \t\n":
        i += 1
    if i >= n:
        return None, n

    if text[i] == "<":
        close = text.find(">", i + 1)
        if close < 0:
            return None, n
        dest = text[i + 1 : close].strip()
        i = close + 1
    else:
        start_dest = i
        depth = 0
        while i < n:
            c = text[i]
            if depth == 0 and c in " \t\n":
                break
            if c == "(":
                depth += 1
                i += 1
            elif c == ")":
                if depth > 0:
                    depth -= 1
                    i += 1
                else:
                    break
            else:
                i += 1
        dest = text[start_dest:i].strip()

    while i < n and text[i] in " \t\n":
        i += 1
    # Optional link title: "..." or '...' or (...)
    if i < n and text[i] in "\"\'(":
        if text[i] == "(":
            depth = 0
            i += 1
            while i < n:
                c = text[i]
                if c == "(":
                    depth += 1
                elif c == ")":
                    if depth == 0:
                        i += 1
                        break
                    depth -= 1
                i += 1
        elif text[i] == '"':
            i += 1
            while i < n:
                if text[i] == "\\" and i + 1 < n:
                    i += 2
                    continue
                if text[i] == '"':
                    i += 1
                    break
                i += 1
        elif text[i] == "'":
            i += 1
            while i < n:
                if text[i] == "\\" and i + 1 < n:
                    i += 2
                    continue
                if text[i] == "'":
                    i += 1
                    break
                i += 1
    while i < n and text[i] in " \t\n":
        i += 1
    if i >= n or text[i] != ")":
        return None, min(i, n)
    return dest, i + 1


def _is_external(url: str) -> bool:
    u = url.strip()
    if not u or u.startswith("#"):
        return True
    lu = u.lower()
    return any(lu.startswith(p) for p in EXTERNAL_PREFIXES)


def _targets_from_markdown(text: str) -> list[str]:
    seen: list[str] = []
    for m in INLINE_LINK_START_RE.finditer(text):
        dest, _ = _parse_inline_link_destination(text, m.end() - 1)
        if not dest:
            continue
        if _is_external(dest):
            continue
        path_part = dest.split("#", 1)[0].split("?", 1)[0].strip()
        if not path_part:
            continue
        seen.append(path_part)
    for m in IMG_SRC_RE.finditer(text):
        raw = m.group(2).strip()
        if _is_external(raw):
            continue
        path_part = raw.split("#", 1)[0].split("?", 1)[0].strip()
        if path_part:
            seen.append(path_part)
    return seen


def _walk_json_src(obj: object, acc: list[str]) -> None:
    if isinstance(obj, dict):
        for k, v in obj.items():
            if (
                k == "src"
                and isinstance(v, str)
                and v.strip()
                and not _is_external(v)
            ):
                path_part = v.split("#", 1)[0].split("?", 1)[0].strip()
                if path_part:
                    acc.append(path_part)
            _walk_json_src(v, acc)
    elif isinstance(obj, list):
        for item in obj:
            _walk_json_src(item, acc)


def _resolve_path(target: str, base_dir: Path, *, json_sidecar: bool) -> Path:
    if json_sidecar:
        # Story sidecars use repo-root-relative paths (see AGENTS.md).
        p = Path(target)
        return (REPO_ROOT / p) if not p.is_absolute() else p
    p = Path(target)
    if p.is_absolute():
        return p
    return (base_dir / p).resolve()


def _should_skip_md(path: Path, *, include_corpus_extracts: bool) -> bool:
    if include_corpus_extracts:
        return False
    name = path.name
    if name in ("extracted.pdf.md", "extracted.web.md"):
        return True
    return False


def _iter_markdown_files(
    roots: list[Path], *, include_corpus_extracts: bool
) -> list[Path]:
    out: list[Path] = []
    skip_dirs = {".git", ".venv", "node_modules", ".next", "__pycache__"}

    for root in roots:
        if not root.exists():
            continue
        if root.is_file():
            if root.suffix.lower() == ".md":
                out.append(root.resolve())
            continue
        for p in root.rglob("*.md"):
            if any(part in skip_dirs for part in p.parts):
                continue
            if _should_skip_md(p, include_corpus_extracts=include_corpus_extracts):
                continue
            out.append(p.resolve())
    return sorted(set(out))


def _iter_scrolly_json(roots: list[Path]) -> list[Path]:
    out: list[Path] = []
    skip_dirs = {".git", ".venv", "node_modules", ".next", "__pycache__"}
    for root in roots:
        cand = root
        if root.is_file():
            if root.name.endswith(".scrolly.json"):
                out.append(root.resolve())
            continue
        stories = root / "stories" if (root / "stories").is_dir() else None
        search_roots = [root]
        if stories is not None:
            search_roots.append(stories)
        for sr in search_roots:
            for p in sr.rglob("*.scrolly.json"):
                if any(part in skip_dirs for part in p.parts):
                    continue
                out.append(p.resolve())
    return sorted(set(out))


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.strip().split("\n\n")[0])
    ap.add_argument(
        "paths",
        nargs="*",
        type=Path,
        help="Files or directories to scan (default: vault + stories)",
    )
    ap.add_argument(
        "--include-corpus-extracts",
        action="store_true",
        help="Also scan extracted.pdf.md / extracted.web.md under corpus",
    )
    ap.add_argument(
        "--no-scrolly",
        action="store_true",
        help="Do not scan *.scrolly.json",
    )
    args = ap.parse_args()

    if args.paths:
        roots = [(REPO_ROOT / p) if not p.is_absolute() else p for p in args.paths]
    else:
        roots = [
            REPO_ROOT / "people",
            REPO_ROOT / "stories",
            REPO_ROOT / "lines",
            REPO_ROOT / "topics",
            REPO_ROOT / "sources",
            REPO_ROOT / "research",
            REPO_ROOT / "manual",
            REPO_ROOT / "index.md",
            REPO_ROOT / "stories_plan",
        ]

    broken: list[tuple[Path, str, str]] = []

    for md_path in _iter_markdown_files(
        roots, include_corpus_extracts=args.include_corpus_extracts
    ):
        try:
            text = md_path.read_text(encoding="utf-8", errors="replace")
        except OSError as e:
            broken.append((md_path, f"<read {e!s}>", ""))
            continue
        base = md_path.parent
        for target in _targets_from_markdown(text):
            decoded = unquote(target)
            resolved = _resolve_path(decoded, base, json_sidecar=False)
            try:
                if not resolved.exists():
                    broken.append((md_path, target, str(resolved)))
            except OSError:
                broken.append((md_path, target, str(resolved)))

    if not args.no_scrolly:
        for js_path in _iter_scrolly_json(roots):
            try:
                data = json.loads(js_path.read_text(encoding="utf-8", errors="replace"))
            except (OSError, json.JSONDecodeError) as e:
                broken.append((js_path, f"<json {e!s}>", ""))
                continue
            srcs: list[str] = []
            _walk_json_src(data, srcs)
            for target in srcs:
                decoded = unquote(target)
                resolved = _resolve_path(decoded, REPO_ROOT, json_sidecar=True)
                try:
                    if not resolved.exists():
                        broken.append((js_path, target, str(resolved)))
                except OSError:
                    broken.append((js_path, target, str(resolved)))

    if not broken:
        print("No broken repo-relative link targets found.", file=sys.stderr)
        return 0

    print(f"Broken targets: {len(broken)}", file=sys.stderr)
    cur: Path | None = None
    for path, target, resolved in broken:
        if path != cur:
            print(f"\n{path.relative_to(REPO_ROOT)}", file=sys.stderr)
            cur = path
        if resolved:
            print(f"  {target!r} -> missing: {resolved}", file=sys.stderr)
        else:
            print(f"  {target!r}", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
