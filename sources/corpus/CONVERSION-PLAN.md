# Plan: better Markdown conversions (PDF & web)

## Goals

1. **Searchable text** next to every PDF that matters for research (not necessarily every chart JPEG).
2. **Stable provenance**: `source.yaml` + extract; `original.pdf` in corpus only for remote fetches, else canonical path in `files.media_reference`.
3. **Good enough for agents and humans**: headings, lists, tables preserved where possible; page references when useful.
4. **No duplicate masters**: corpus extract supplements `media/` files; citation cards in `sources/*.md` stay the navigation layer.

## Current state

| Piece | Role |
|-------|------|
| `scripts/ingest_source.py` `pdf` | Copies/fetches PDF → `original.pdf`, runs **pymupdf4llm** → `extracted.pdf.md`, updates `source.yaml`. |
| `scripts/ingest_source.py` `web` | **trafilatura** → `extracted.web.md` from `mirror.html`. |
| `media/**` | Most evidence PDFs live here **without** corpus bundles. |
| `sources/corpus/levantine-freemasonry/` | Remote-fetch example (`corpus/.../original.pdf` + extract). |

**Gaps:** single engine for PDFs; no batch path from `media/` slugs; no OCR path for scans; no human QA checklist; web extract fails on JS-heavy sites.

---

## Phase 1 — Coverage & hygiene (low risk)

1. **Priority list** — Order PDFs by research value (e.g. Bottin contract, Cormick articles, Wright burials, NYPL Henderson PDFs, key `media/publications/persia-iran/*`). Skip huge fan-chart PDFs unless you need text from them.
2. **One corpus bundle per priority PDF** — Use ingest (no duplicate PDF in corpus when using `--file`):
   - `.venv/bin/python scripts/ingest_source.py pdf --slug <kebab> --file media/.../doc.pdf --title "..."` (venv: `python3 -m venv .venv && .venv/bin/pip install -r requirements.txt`)
   - Batch: `pdf-ingest-manifest.yaml` (routine); **Bokhara + Medical Times Gazette** → `pdf-ingest-manifest-heavy.yaml` (long runs).
   - `source.yaml` records `files.media_reference` (repo-relative); bytes stay only under `media/`. Remote-only sources still get `corpus/.../original.pdf`.
3. **Citation cards** — Each `sources/<topic>.md` should link to `corpus/<slug>/extracted.pdf.md` and the canonical `media/...` scan when relevant.
4. ~~**Re-ingest Levantine**~~ — `original.pdf` in bundle for remote-only sources; local scans use `media/` only.
5. **Document frontmatter** — Standardize YAML on extracts: `generator`, `generated`, `source_file`, optional `pdf_sha256` (mirror of last fetch).

---

## Phase 2 — Better PDF→Markdown quality

1. **Compare engines on 2–3 hard samples** (scanned page, dense footnotes, two-column):
   - Keep **pymupdf4llm** as default (fast, already wired).
   - Trial **Marker**, **Docling**, or **pdftotext -layout** offline; pick one secondary path for “hard” PDFs only.
2. **Pluggable backend** — Refactor `cmd_pdf` to something like `--engine pymupdf4llm|marker` (second engine optional dep in `requirements-optional.txt` or extras).
3. ~~**Page boundaries**~~ — **Done:** default `<!-- page N -->` in extracts; `--no-page-markers` on `ingest_source.py pdf`.
4. **OCR flag** — For image-only PDFs: optional `--ocr` using Tesseract or engine-built-in OCR; record `ocr: true` in frontmatter when used.

---

## Phase 3 — Scale & maintenance

1. ~~**Batch helper**~~ — **Done:** [scripts/batch_pdf_extract.py](../../scripts/batch_pdf_extract.py) + [pdf-ingest-manifest.yaml](pdf-ingest-manifest.yaml).

2. **CI or pre-commit (optional)** — If `original.pdf` hash in `source.yaml` changes, fail until extract is refreshed; or a weekly “stale extract” report.
3. **Web improvements** — For JS pages: manual **print-to-PDF** → Phase 1 PDF ingest, or **Playwright** snapshot HTML then trafilatura (heavier, only for critical URLs).

---

## Quality bar (manual QA)

For each new extract, quick pass:

- [ ] First paragraph matches PDF opening.
- [ ] At least one table or list section looks structurally sane (if present in PDF).
- [ ] No empty file / single-line garbage (common on DRM or scan failures).
- [ ] `source.yaml` `fetches[-1].sha256` matches the canonical file (`media/...` via `files.media_reference`, or `corpus/.../original.pdf` for remote).

---

## Out of scope (for now)

- Full LaTeX/math fidelity.
- Replacing `media/` with corpus-only storage (`media/` remains canonical for local scans; corpus is extract + provenance).
- Auto-linking extract paragraphs to `people/*.md` (future RAG or manual anchors).

---

## Immediate next actions

1. ~~Add 3–5 corpus bundles for the highest-value `media/` PDFs~~ — **Done (2026-03):** `bottin-contract`, both Wright burials PDFs, `william-cormick-connections`, NYPL appendix + bulletin, Charles Burgess portrait. See [README.md](README.md).
2. **`media/` sweep** — [scripts/ingest_all_media_pdfs.py](../../scripts/ingest_all_media_pdfs.py): **default easy tier** (no charts, no NYPL folders `1`–`9`, no PDFs **>12 MiB**); `--all` for the rest. Idempotent. Logs: `.ingest-all-media-run.log`, `.media-pdf-ingest-failures.log`.
3. ~~Extend `ingest_source.py` with optional page markers~~ — **Done:** default `<!-- page N -->` via `page_chunks`; opt out with `--no-page-markers`.
4. ~~Add `batch_pdf_extract.py` + manifest~~ — **Done:** [scripts/batch_pdf_extract.py](../../scripts/batch_pdf_extract.py), [pdf-ingest-manifest.yaml](pdf-ingest-manifest.yaml), [manifest.example.yaml](manifest.example.yaml).
