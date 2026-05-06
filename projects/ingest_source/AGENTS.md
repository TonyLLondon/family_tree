# Agent playbook — `projects/ingest_source/`

Operating instructions for any agent (or human) processing a source through this project. **Read [README.md](README.md) first** for the file layout.

## Core principle

> **Mechanical work belongs to the pipeline. Cognitive work belongs to the agent.**

The runner does only what computers are good at: rasterise PDFs to PNG, grep text layers, run cheap OCR as a *page-finder index*, organise files, append yaml audit entries.

The agent (any vision-capable LLM, including the one reading this file) does the cognitive work: **look at the high-DPI PNGs**, decide which pages matter, transcribe, translate, judge confidence, write `reference.md`.

**OCR is never the transcription source.** Surya / Tesseract / marker-pdf output is rough, lossy, and useless on handwriting and non-Latin scripts. The runner uses OCR as a *page-finder index* for image-only big books — to surface pages that mention a focus term — and nothing else. The index lives in `_ocr_index/` and is gitignored.

**Text-layer grep is also a candidate builder, not a transcription.** When a PDF has an embedded text layer, Tier A publishes that text directly (it's machine-readable, not OCR'd). Tier C also greps that text layer to find candidate pages — but the agent still looks at the rendered PNG to *transcribe* what's on the page. Text layers misread old typefaces, drop marginalia, and silently corrupt names.

## Decision tree

```
new source (PDF / image / web page)
        │
        ▼
   triage --slug X --file media/...
        │   (creates the bundle skeleton if missing — source.yaml + media_reference)
        ▼
   probes the PDF, recommends a tier
        │
        ├─ Web page                          → trafilatura → extracted.web.md     (still scripts/ingest_source.py web for now)
        ├─ PDF + text layer:
        │     • single non-RTL, whole doc    → A   pymupdf+wrap-join → transcription[.lang].md
        │     • + --focus terms              → C   grep text layer → render hits → vision
        │     • RTL / multi-script           → B   render all pages → vision
        ├─ PDF image-only:
        │     • clean Latin print            → A.5 ocrmypdf adds layer → re-Tier A   (NOT YET WIRED — image-only Latin currently goes to B)
        │     • + --focus terms              → C+  surya page-finder index → grep → render hits → vision
        │     • discovery (no focus terms)   → C+  --thumbnails / --pages "TOC,end"  → agent picks pages → render
        │     • RTL / handwritten / multi    → B   render all pages → vision
        └─ Single image (no PDF)             → B-lite vision direct on image          (NOT YET WIRED — handle by hand)
```

## Tier table — the operating contract

| Tier | When | Pipeline does | Agent does | Outputs (published) |
|------|------|---------------|------------|---------------------|
| **A** | Text layer present, single non-RTL script | `pymupdf get_text(sort=True)` + wrap-join | nothing (the text layer is the transcription) | `transcription[.lang].md` (`transcriber: machine`) |
| **A.5** | Image-only **clean Latin print** | `ocrmypdf` → re-Tier A | nothing | same as A. **Not yet wired** |
| **B** | Image-only (RTL / handwritten / multi-script), or RTL/multi text-layer doc | Render every page to `pages-png/p###.png` + `pages-png/manifest.json` | Look at every PNG, transcribe + translate | `transcription.<lang>.md` per language + `translation.en.md` + `reference.md` (`transcriber: agent`, `verified: false` until human signs off) |
| **C** | Big doc, **text layer present**, with `--focus` (or `--pages`) | Grep text layer for focus terms → render hit pages ± `--context` → write `snippets/manifest.json` | Look at the rendered PNGs, write per-hit transcriptions | `transcription.snippets.md` (per-hit sections) + `translation.en.md` + `reference.md` + scoped `pages-png/` |
| **C+** | Big doc, **image-only**, with `--focus` (or `--pages`) | Build `_ocr_index/` (Surya, gitignored) → grep index for focus terms → render hits → write `snippets/manifest.json`. Also `--thumbnails` for an agent visual scan. | Either: scan thumbnails to pick pages, then ask runner to render them; or run `--ocr-index` + `--focus` and look at the hits | same as C |

## Candidate builders (mechanical)

These are the four ways the pipeline can surface candidate pages for the agent. They compose; you can use any combination.

| Builder | Flag | Output | Status |
|---------|------|--------|--------|
| Text-layer grep | `--focus`, Tier C, text-layer doc | hit list with previews from machine text | published transcription = the rendered PNG, not the text-layer slice |
| OCR-index grep | `--ocr-index` + `--focus`, Tier C+ | hit list with previews from Surya OCR | OCR text is **never** published; index lives in `_ocr_index/` (gitignored) |
| Thumbnails | `--thumbnails`, Tier C+ | low-DPI PNG per page in `thumbnails/` | gitignored; agent looks at them to decide what to render |
| Direct page render | `--pages "1-12,234"`, any tier C variant | high-DPI PNG per requested page in `pages-png/` | committed; this is the source of truth for transcription |

After a candidate builder runs, the agent decides which pages need rendering at high DPI, and asks the runner: `triage --slug X --tier c --pages "234,405-407" --dpi 300`. Then the agent looks at the rendered PNGs and writes the outputs.

## File conventions the website expects

| File in `sources/corpus/<slug>/` | Web role |
|----------------------------------|----------|
| `transcription.md` or `transcription.<lang>.md` | "Original" body section (whole-doc Tier A/B) |
| `transcription.snippets.md` | "Excerpts" section (Tier C/C+ — per-hit transcriptions, paired with their page PNGs) |
| `translation.md` or `translation.<lang>.md` (or `*.en.md`) | "Translation" body section |
| `reference.md` | English commentary, IDs, dates, links to `people/*.md` |
| `extracted.pdf.md` / `extracted.web.md` | Machine extract — rendered with an OCR warning |
| `pages-png/p001.png … pNNN.png` | High-DPI facsimiles (committed; Tier B = whole doc, Tier C = hit pages only) |
| `pages-png/manifest.json` | Tier B vision-handoff brief |
| `snippets/manifest.json` | Tier C/C+ vision-handoff brief (hits, expected outputs) |
| `snippets/p###.evidence.txt` | Per-hit evidence: the text-layer or OCR slice that triggered the hit |
| `_ocr_index/` | Surya page-finder index — **gitignored, never published** |
| `thumbnails/` | Low-DPI scan sheet for the agent — **gitignored** |
| `source.yaml.files.media_reference` | Primary facsimile + PDF download |
| `source.yaml.files.media_reference_crop` | Detail crops |

## Standard frontmatter (transcription / translation / reference / snippets)

```yaml
---
language: fa                       # ISO 639-1 (it, en, fr, fa, hr, …)
source_file: media/.../X.pdf       # repo-relative
source_pages: "1-3"                # whole doc OR list of anchor pages for snippets
transcriber: agent                 # agent | human | machine
agent_model: claude-opus-4.7       # only when transcriber: agent
agent_date: 2026-04-19T08:10Z
verified: false                    # human reviewer flips this to true
agent_locked: false                # set true to prevent any rewrite
---
```

The web app already reads `language:`. Other fields drive the `verified` banner (when wired) and the `do-not-overwrite` rule.

## Do-not-overwrite rule (mandatory)

The runner **must** refuse to overwrite a file whose YAML frontmatter contains either:

- `transcriber: human`, OR
- `agent_locked: true`

`--force` is the only escape hatch and should be used by humans only.

## Per-bundle audit: `source.yaml.extractions[]`

Every triage run appends one entry. Anyone re-encountering the bundle can read this to know what's been tried.

```yaml
extractions:
  - at: 2026-04-19T07:30Z
    stage: triage
    tier: c
    variant: C+
    engine: surya page-finder index
  - at: 2026-04-19T07:31Z
    stage: ocr-index
    tier: c
    variant: C+
    pages: 768
    files_written: [_ocr_index/p001.txt, …]
  - at: 2026-04-19T07:45Z
    stage: render
    tier: c
    variant: C+
    engine: pymupdf rasterise + tier-c snippets manifest
    focus_terms: [Burgess, Tabriz]
    hits: 7
    pages: 21
    dpi: 300
    files_written: [pages-png/p233.png, …, snippets/manifest.json]
  - at: 2026-04-19T08:10Z
    stage: vision
    tier: c
    agent_model: claude-opus-4.7
    files_written: [transcription.snippets.md, translation.en.md, reference.md]
    verified: false
```

## Project-wide audit: `state.md`

Hand-curated dashboard. Tracks what's in flight: vision-pending bundles, awaiting verification, recently completed, stuck items. Update after every meaningful pass.

The runner exposes `pending` (list vision-pending bundles ranked by cite-pressure) and `status --slug X` (per-bundle summary) — paste their output into `state.md` when you update it.

## Vision pass — the agent loop

When triage routes to Tier B / C / C+, it stops at "PNGs rendered + manifest written". The vision pass is the agent looking at the PNGs and writing the outputs.

1. Read `sources/corpus/<slug>/snippets/manifest.json` (Tier C/C+) or `pages-png/manifest.json` (Tier B) for the brief.
2. For each `hits[].image_files` (or every PNG for Tier B), read the PNG.
3. Write the expected output files into the bundle directory, with the standard frontmatter (transcriber, agent_model, agent_date, `verified: false`, `agent_locked: false`).
4. Append a `stage: vision` entry to `source.yaml.extractions[]` (the runner doesn't run during the vision pass — log it manually).
5. A human reviewer flips `verified: true` (and optionally `agent_locked: true`) when satisfied.

If the agent cannot read part of a page, **say so explicitly in the file** ("[Persian body — awaiting reader-grade transcription; see pages-png/p002.png]"). Never invent characters.

## Runner commands

```
.venv/bin/python projects/ingest_source/runner/extract_source.py triage  --slug X [--file media/...] \
                                                                           [--tier auto|a|b|c] \
                                                                           [--lang fr] [--dpi 200] \
                                                                           [--focus "term,term"] [--regex] [--context 1] \
                                                                           [--pages "1-12,234"] [--plan-only] \
                                                                           [--thumbnails] [--thumb-dpi 100] \
                                                                           [--ocr-index] [--ocr-index-pages "1-50"] \
                                                                           [--force]
                                                                  probe   --slug X
                                                                  pending
                                                                  status  --slug X
```

- `triage` — probe + auto-route + execute. Idempotent. Honours the do-not-overwrite rule.
- `probe`  — write `<bundle>/probe.json` only. No outputs.
- `pending` — list vision-pending bundles, sorted by cite-pressure. Detects both Tier B (`pages-png/manifest.json`) and Tier C/C+ (`snippets/manifest.json`) work.
- `status` — show `extractions[]`, files in bundle, pending state, cite-pressure for one bundle.

## Tier C / C+ — typical flows

**Big text-layer doc, you know the names you care about:**

```bash
triage --slug X --file media/.../book.pdf --tier c --focus "Burgess,Tabriz"
# → text-layer grep, prints hits, renders hit pages ± 1 to pages-png/, writes snippets/manifest.json
# Then look at the rendered PNGs and write transcription.snippets.md / translation.en.md / reference.md.
```

**Big image-only doc, you know the names:**

```bash
triage --slug X --file media/.../scan.pdf --tier c --ocr-index            # Surya page-finder, ~minutes
triage --slug X --tier c --focus "Burgess,Tabriz"                          # grep index, render hits
# Then transcribe from the rendered PNGs (do not transcribe from the OCR index).
```

**Big image-only doc, you don't yet know what's in it:**

```bash
triage --slug X --file media/.../scan.pdf --tier c --thumbnails            # contact sheet (gitignored)
# Open thumbnails/ visually. Identify candidate pages. Then:
triage --slug X --tier c --pages "1-12,234,405-407,760-768" --dpi 300      # render TOC + picks
# Then transcribe.
```

**Just preview the hits without rendering:**

```bash
triage --slug X --tier c --focus "term" --plan-only
```

## Currently NOT yet wired (for honesty)

- **Tier A.5 (`ocrmypdf`)** — image-only Latin print currently routes to Tier B until A.5 is added.
- **Single image inbox (no PDF)** — drop into `inbox/` and process by hand; not yet a runner path.
- **`triage --sweep`** — batch walk of `media/**/*.pdf`. Not yet — use the per-slug invocation.
- **Web app `verified: false` banner** — the standard frontmatter is in place, but the web component hasn't been written yet. `verified` is captured in files; it just isn't surfaced visually.
- **Auto-rewrite of `state.md`** — hand-edited; the runner does not write to it.

When any of these is wired, update this file and add a row to `history/logs.md`.

## Relationship to other parts of the repo

- **`scripts/ingest_source.py web`** — still the way to ingest a web page. Will eventually fold into this project's runner; for now, treat as the web-only sibling.
- **`scripts/marker_reextract.py`** — restricted to clean Latin print (Tier A.5 candidate). **Never** run on handwritten or non-Latin sources; those are vision pass only.
- **`scripts/extract_pdf_sorted_transcription.py`** — superseded by Tier A in this runner. Kept temporarily for the burgess-specific fixes.
- **`sources/corpus/CONVERSION-PLAN.md`** — the older roadmap doc. Will be retired in favour of this project's `AGENTS.md` + `state.md`.
- **`manual/`** — the broader human-facing inbox for any unsorted material. `inbox/` here is specifically files queued for the runner.

## When in doubt

Re-read this file. If the right answer isn't here, decide, do it, and **add a `history/logs.md` entry** so the next agent knows.
