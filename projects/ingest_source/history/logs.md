# `projects/ingest_source/history/logs.md`

Chronological log of changes to **the runner / this project itself**. Per-source audit lives in each bundle's `source.yaml.extractions[]` — not here.

Newest at the top. Free-form prose with UTC timestamps. Add an entry whenever:

- the runner changes behaviour, gains a tier, or drops one,
- the playbook in `AGENTS.md` is rewritten,
- a manifest format / frontmatter convention changes,
- a class of bundles is reclassified (e.g. "all handwritten Farsi removed from `marker_reextract.py` queue → vision-only").

---

## 2026-06-05T00:00Z — Tier C / C+ selective extraction + web excerpts

- **`triage --file`** — creates `sources/corpus/<slug>/source.yaml` with `files.media_reference` when the bundle is new.
- **Tier C** — text-layer grep + `--focus` / `--pages` + `--context`; renders hit pages to `pages-png/`, writes per-hit `snippets/*.evidence.txt` + `snippets/manifest.json`, persists `focus` / `tier_c` into `source.yaml`.
- **Tier C+ candidate builders** — `--thumbnails` (low-DPI `thumbnails/`, gitignored), `--ocr-index` (Surya → `_ocr_index/`, gitignored; `results.json` parsed). `--focus` after `--ocr-index` greps the index.
- **`pending` / `status`** — recognise Tier C manifests and parse `expected_outputs` for missing filenames; fix cite-pressure prefix collision (`corpus/slug` boundary).
- **Web** — `resolveSource` exposes `snippets`; source page renders **Excerpts** (manifest hits + optional `transcription.snippets.md`); suppresses duplicate `pages-png/` gallery rows when snippets images are inline.
- **`.gitignore`** — `sources/corpus/*/_ocr_index/` and `sources/corpus/*/thumbnails/`.

## 2026-04-19T08:00Z — Project bootstrapped

- Created `projects/ingest_source/` next to `web/`, `media/`, `sources/` as the first instance of the **per-project folder** pattern (others to follow).
- Layout: `AGENTS.md` (playbook), `state.md` (live dashboard), `inbox/` (gitignored raw drops), `runner/extract_source.py` (the script), `history/logs.md` (this file).
- `inbox/*` gitignored except `README.md` and `.gitkeep`.

## 2026-04-19T08:00Z — `scripts/extract_pdf.py` → `runner/extract_source.py`

Moved bodily into the project. Same code, with these changes:

- `REPO_ROOT` recomputed for new path depth (`parents[3]`).
- Subcommand `run` renamed to **`triage`**.
- Added subcommand **`pending`** — lists bundles with `pages-png/manifest.json` but no transcription/translation/reference file, sorted by cite-pressure (links from `people/`, `stories/`, `topics/`).
- Added subcommand **`status --slug X`** — shows `extractions[]`, files in bundle, lock state, cite-pressure.
- Loosened the "has-transcription" regex to also count legacy hyphen variants (`transcription-translation.en.md`) so they don't appear pending.
- Vision-handoff manifest now includes `verified: false` in the suggested frontmatter template, and a `log_when_done` reminder for agents to append `stage: vision` to `source.yaml.extractions[]`.

## 2026-04-19T07:30Z — Architecture pivot: OCR is for finding pages, vision is for transcribing them

After back-and-forth on Bottin Contract (handwritten Persian + French parallel-text), settled on:

> **OCR is for finding pages. Vision LLM is for transcribing them. Text layers are gold and used directly.**

Practical consequences:

- Tier B (image-only / RTL / handwritten / multi-script) goes **directly to vision**, not through Surya/marker. Machine OCR output is **never** published as a transcription.
- Surya / marker are only useful as a **page-finding index** for big books with `--focus` terms (Tier C+). Index output is never published.
- `scripts/marker_reextract.py` is restricted to clean Latin print only (Tier A.5 candidate). Its existing `strategy: marker+ocr` entries for handwritten Farsi (`reextract-manifest.yaml`, the burgess Persian batch) are mis-classified and should move to a vision-pending queue. **Not done in this commit** — to be cleaned up alongside Tier C wiring.

## 2026-04-19T07:30Z — Tier B end-to-end on `bottin-contract`

First test of the new runner. Probe correctly identified 3/3 pages as image-only, recommended Tier B, rendered `pages-png/p001-p003.png` at 200 DPI, wrote `pages-png/manifest.json`, appended `extractions:` entry to `source.yaml`. Existing `transcription-translation.en.md` (human-curated French + English from a previous vision pass) was left untouched.

## Things still NOT yet wired (honest list)

- **Tier A.5** (`ocrmypdf` for image-only Latin print) — image-only Latin currently routes to Tier B, which over-engineers the easy case.
- **Tier C+ OCR at scale** — `--ocr-index` invokes Surya; first-run model load and 700+ page PDFs are slow. Parsing depends on surya `results.json` shape; exercise on a real image-only volume before trusting it in batch.
- **`triage --sweep`** for batch walk of `media/**/*.pdf`. `scripts/ingest_all_media_pdfs.py` still does this.
- **Single-image inbox path** (no PDF) — drop and process by hand.
- **Web app `verified: false` banner** — frontmatter is captured, no UI surface yet.
- **Retiring `pdf-ingest-manifest*.yaml` and `reextract-manifest.yaml`** — they should be replaced by per-bundle `extractions:` + this project's `state.md`. Pending.
- **`scripts/ingest_source.py web`** still owns web-page ingest; should fold into the runner eventually.
