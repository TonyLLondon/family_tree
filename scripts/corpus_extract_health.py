#!/usr/bin/env python3
"""
Flag corpus bundles with missing or very small machine extracts.

Run from repo root: .venv/bin/python scripts/corpus_extract_health.py

Exit 0 always; prints markdown-friendly sections to stdout.
"""
from __future__ import annotations

import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
CORPUS = REPO / "sources" / "corpus"
MIN_BYTES = 400  # below this, treat extract as stub / failed


def _artifact_paths(bundle: Path) -> list[Path]:
    out: list[Path] = []
    for name in ("extracted.pdf.md", "extracted.web.md", "reference.md"):
        p = bundle / name
        if p.is_file():
            out.append(p)
    out.extend(sorted(bundle.glob("transcription*.md")))
    out.extend(sorted(bundle.glob("translation*.md")))
    return out


def _largest(paths: list[Path]) -> tuple[int, Path | None]:
    best_n = 0
    best_p: Path | None = None
    for p in paths:
        n = p.stat().st_size
        if n > best_n:
            best_n = n
            best_p = p
    return best_n, best_p


def main() -> int:
    no_artifacts: list[str] = []
    thin: list[tuple[str, int, str]] = []
    machine_stub_covered: list[tuple[str, int, str, int, str]] = []

    for d in sorted(CORPUS.iterdir()):
        if not d.is_dir() or d.name.startswith("."):
            continue
        if not (d / "source.yaml").is_file():
            continue
        paths = _artifact_paths(d)
        if not paths:
            no_artifacts.append(d.name)
            continue
        max_n, max_p = _largest(paths)
        assert max_p is not None
        label = max_p.name
        if max_n >= MIN_BYTES:
            pdf_md = d / "extracted.pdf.md"
            web_md = d / "extracted.web.md"
            for mp in (pdf_md, web_md):
                if mp.is_file() and mp.stat().st_size < MIN_BYTES:
                    machine_stub_covered.append(
                        (
                            d.name,
                            mp.stat().st_size,
                            mp.name,
                            max_n,
                            max_p.name,
                        )
                    )
                    break
            continue
        thin.append((d.name, max_n, label))

    n_bundles = sum(
        1
        for d in CORPUS.iterdir()
        if d.is_dir() and not d.name.startswith(".") and (d / "source.yaml").is_file()
    )
    print(f"# Corpus extract health ({n_bundles} bundles with source.yaml)\n")
    print(
        f"Threshold: `{MIN_BYTES}` bytes. Counts the largest of "
        "`extracted.pdf.md`, `extracted.web.md`, `reference.md`, "
        "`transcription*.md`, `translation*.md`.\n"
    )

    print("## No text artifacts in bundle\n")
    if not no_artifacts:
        print("(none)\n")
    else:
        for slug in no_artifacts:
            print(f"- `{slug}`")
        print()

    print("## Below threshold (largest artifact < 400 B)\n")
    if not thin:
        print("(none)\n")
    else:
        for slug, n, label in sorted(thin, key=lambda x: x[0].lower()):
            print(f"- `{slug}` — {n} B (`{label}`)")
        print()

    print(
        "## Machine extract stub (< 400 B) but bundle OK via reference/transcription/translation\n"
    )
    if not machine_stub_covered:
        print("(none)\n")
    else:
        for slug, mn, mlabel, hn, hlabel in sorted(
            machine_stub_covered, key=lambda x: x[0].lower()
        ):
            print(
                f"- `{slug}` — `{mlabel}` {mn} B; largest artifact {hn} B (`{hlabel}`)"
            )
        print()

    return 0


if __name__ == "__main__":
    sys.exit(main())
