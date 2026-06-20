#!/usr/bin/env python3
"""
Rename sources/corpus/<long>/ → sources/corpus/<card-slug>/ when a single citation card
points at exactly one corpus folder with a different slug, then remove the card and
merge its prose into reference.md.

Skips corpus folders referenced by more than one such card (e.g. shared index bundle).

Usage:
  .venv/bin/python scripts/consolidate_source_slugs.py        # dry-run
  .venv/bin/python scripts/consolidate_source_slugs.py --apply
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
SKIP_ROOTS = {
    ".git",
    ".venv",
    "node_modules",
    ".next",
    "web/node_modules",
    "web/.next",
    "web/public/files",
}

EXCLUDE_FILES = {
    "scripts/consolidate_source_slugs.py",
}

CARD_SKIP = frozenset(
    {
        "corpus-bibliography.md",
        "master-source-list.md",
        "legacy-index.md",
    }
)

FM_RE = re.compile(r"^---\n(.*?)\n---", re.S)
LINK_RE = re.compile(r"\]\((?:\.\./sources/)?corpus/([^/)]+)")


def iter_text_files() -> list[Path]:
    out: list[Path] = []
    for p in ROOT.rglob("*"):
        rel = p.relative_to(ROOT).as_posix()
        if any(rel == s or rel.startswith(s + "/") for s in SKIP_ROOTS):
            continue
        if p.is_file():
            if rel in EXCLUDE_FILES:
                continue
            if p.suffix.lower() in {".md", ".yaml", ".yml", ".json", ".tsx", ".ts", ".mjs", ".html"}:
                out.append(p)
    return out


def collect_mismatches() -> tuple[list[tuple[str, str]], dict[str, list[str]]]:
    cards = [
        c
        for c in (ROOT / "sources").glob("*.md")
        if c.name not in CARD_SKIP
    ]
    corpus_slugs = {p.name for p in (ROOT / "sources" / "corpus").iterdir() if p.is_dir()}
    by_old: dict[str, list[str]] = {}
    pairs: list[tuple[str, str]] = []
    for c in cards:
        raw = c.read_text(encoding="utf-8")
        fm: dict = {}
        m = FM_RE.match(raw)
        if m:
            try:
                fm = yaml.safe_load(m.group(1)) or {}
            except yaml.YAMLError:
                fm = {}
        body = raw[m.end() :] if m else raw
        slugs: set[str] = set()
        cv = fm.get("corpus")
        if isinstance(cv, str):
            slugs.add(cv.replace("corpus/", "").strip("/"))
        elif isinstance(cv, list):
            for x in cv:
                slugs.add(str(x).replace("corpus/", "").strip("/"))
        for mm in LINK_RE.finditer(body):
            slugs.add(mm.group(1))
        slugs = {s for s in slugs if s in corpus_slugs}
        card_slug = c.stem
        if len(slugs) != 1:
            continue
        s = next(iter(slugs))
        if s == card_slug:
            continue
        pairs.append((card_slug, s))
        by_old.setdefault(s, []).append(card_slug)
    conflicts = {k: v for k, v in by_old.items() if len(v) > 1}
    safe = [(c, o) for c, o in pairs if len(by_old[o]) == 1]
    return safe, conflicts


def strip_first_h1(md: str) -> str:
    lines = md.splitlines()
    for i, line in enumerate(lines):
        if re.match(r"^#\s+", line):
            lines.pop(i)
            if i < len(lines) and lines[i].strip() == "":
                lines.pop(i)
            return "\n".join(lines)
    return md


def merge_card_into_reference(card_path: Path, corpus_dir: Path) -> None:
    raw = card_path.read_text(encoding="utf-8")
    m = FM_RE.match(raw)
    body = raw[m.end() :] if m else raw
    body = strip_first_h1(body.strip())
    if not body.strip():
        return
    block = (
        "\n\n---\n\n## Summary\n\n"
        + body.strip()
        + "\n"
    )
    ref = corpus_dir / "reference.md"
    if ref.exists():
        existing = ref.read_text(encoding="utf-8").rstrip() + block
        ref.write_text(existing + "\n", encoding="utf-8")
    else:
        ref.write_text("# Reference\n" + block, encoding="utf-8")


def run_git(args: list[str], cwd: Path) -> None:
    r = subprocess.run(["git", *args], cwd=cwd, capture_output=True, text=True)
    if r.returncode != 0:
        print(r.stdout, r.stderr, file=sys.stderr)
        raise SystemExit(r.returncode)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()
    safe, conflicts = collect_mismatches()
    print(f"Safe renames: {len(safe)}")
    print(f"Skipped (shared corpus): {len(conflicts)} folder(s)")
    for k, v in conflicts.items():
        print(f"  {k} <- cards {v}")
    if not args.apply:
        for c, o in sorted(safe, key=lambda x: x[1])[:20]:
            print(f"  {o} -> {c}")
        if len(safe) > 20:
            print(f"  ... and {len(safe) - 20} more")
        print("\nDry-run only. Pass --apply to execute.")
        return

    # Longest old slug first for global replace safety
    ordered = sorted(safe, key=lambda x: len(x[1]), reverse=True)

    for card_slug, old_slug in ordered:
        old_dir = ROOT / "sources" / "corpus" / old_slug
        new_dir = ROOT / "sources" / "corpus" / card_slug
        card_path = ROOT / "sources" / f"{card_slug}.md"
        if not old_dir.is_dir():
            print(f"SKIP missing corpus dir: {old_slug}")
            continue
        if not card_path.is_file():
            print(f"SKIP missing card: {card_slug}.md")
            continue
        if new_dir.exists():
            print(f"SKIP target exists: {new_dir}")
            continue
        print(f"git mv {old_slug} -> {card_slug}")
        run_git(["mv", str(old_dir.relative_to(ROOT)), str(new_dir.relative_to(ROOT))], ROOT)
        merge_card_into_reference(card_path, new_dir)
        print(f"git rm {card_path.relative_to(ROOT)}")
        run_git(["rm", str(card_path.relative_to(ROOT))], ROOT)

    # Global text replacements (longest old slug first)
    files = iter_text_files()
    repl_pairs = [(o, c) for c, o in ordered]
    changed = 0
    for fp in files:
        try:
            text = fp.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        orig = text
        for old_slug, new_slug in repl_pairs:
            text = text.replace(f"sources/corpus/{old_slug}/", f"sources/corpus/{new_slug}/")
            text = text.replace(f"sources/corpus/{old_slug}", f"sources/corpus/{new_slug}")
            text = text.replace(f"corpus/{old_slug}/", f"corpus/{new_slug}/")
            text = text.replace(f"corpus/{old_slug})", f"corpus/{new_slug})")
            text = text.replace(f"corpus/{old_slug}#", f"corpus/{new_slug}#")
            text = text.replace(f"/sources/{old_slug}", f"/sources/{new_slug}")
            text = text.replace(f"/sources/{old_slug}/", f"/sources/{new_slug}/")
            text = text.replace(f'"slug": "{old_slug}"', f'"slug": "{new_slug}"')
            text = text.replace(f'"corpusSlug": "{old_slug}"', f'"corpusSlug": "{new_slug}"')
        if text != orig:
            fp.write_text(text, encoding="utf-8")
            changed += 1
    print(f"Patched {changed} files for path rewrites.")


if __name__ == "__main__":
    main()
