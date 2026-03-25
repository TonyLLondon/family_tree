#!/usr/bin/env python3
"""
Report corpus ↔ citation-card coverage.

- Lists corpus bundles (directories under sources/corpus/ with source.yaml).
- Flags bundles whose slug never appears as corpus/<slug> in vault *.md (excl. sources/corpus/, sources/wishlist/).
- Lists top-level sources/*.md that lack corpus: frontmatter and do not mention corpus/ in body.

Run from repo root: .venv/bin/python scripts/source_coverage_report.py
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
SOURCES = REPO / "sources"
CORPUS = SOURCES / "corpus"


def corpus_slugs() -> list[str]:
    slugs: list[str] = []
    for p in sorted(CORPUS.iterdir()):
        if p.is_dir() and not p.name.startswith(".") and (p / "source.yaml").is_file():
            slugs.append(p.name)
    return slugs


def all_inbound_link_markdown_text() -> str:
    """Concatenate vault markdown that might link *to* corpus bundles (excl. bundle internals)."""
    parts: list[str] = []
    for path in sorted(REPO.rglob("*.md")):
        if ".venv" in path.parts or "__pycache__" in path.parts:
            continue
        try:
            rel = path.relative_to(REPO)
        except ValueError:
            continue
        if rel.parts[:2] == ("sources", "corpus"):
            continue
        if rel.parts[:2] == ("sources", "wishlist"):
            continue
        try:
            parts.append(path.read_text(encoding="utf-8", errors="replace"))
        except OSError:
            continue
    return "\n".join(parts)


def top_level_source_cards() -> list[Path]:
    return sorted(p for p in SOURCES.glob("*.md") if p.is_file())


def has_corpus_frontmatter(text: str) -> bool:
    if not text.startswith("---"):
        return False
    end = text.find("\n---", 3)
    if end == -1:
        return False
    fm = text[3:end]
    return bool(re.search(r"(?m)^corpus:\s*", fm))


def main() -> int:
    combined = all_inbound_link_markdown_text()
    slugs = corpus_slugs()

    unlinked: list[str] = []
    for slug in slugs:
        needle = f"corpus/{slug}"
        if needle not in combined:
            unlinked.append(slug)

    cards_gap: list[str] = []
    for path in top_level_source_cards():
        text = path.read_text(encoding="utf-8", errors="replace")
        if "corpus/" not in text and not has_corpus_frontmatter(text):
            cards_gap.append(path.name)

    print(f"Corpus bundles (with source.yaml): {len(slugs)}")
    print(f"Top-level source cards (*.md): {len(list(SOURCES.glob('*.md')))}")
    print()
    print("=== Corpus slugs never referenced as corpus/<slug> in vault *.md (excl. corpus/ + wishlist/) ===")
    if not unlinked:
        print("(none)")
    else:
        for s in unlinked:
            print(s)
    print()
    print("=== Top-level sources/*.md with no corpus: frontmatter and no 'corpus/' in body ===")
    if not cards_gap:
        print("(none)")
    else:
        for name in sorted(cards_gap):
            print(name)
    return 0


if __name__ == "__main__":
    sys.exit(main())
