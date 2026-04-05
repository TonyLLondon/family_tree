# Agent guide — `family_tree`

## Canonical data

| Asset | Role |
|-------|------|
| `family-tree.json` | **Single source of truth** for structured tree (web app). **Schema 2:** topology + rich optional fields (vitals, `alsoKnownAs`, `personPage`, etc.). **Master workflow:** edit JSON and/or `people/*.md` (`treeId`), then run `scripts/sync_family_tree_json.py` (vault overwrites, existing JSON preserved for unset fields). Validate: `scripts/validate_family_tree_json.py`. |
| `people/*.md` | One file per person; YAML frontmatter + prose + links. Planning: `ancestor-coverage-list.md`, `person-pages-extension-plan.md`. |
| `ancestor-tracker.md` | **Ahnentafel ancestor chart** rooted at Archer/Sloan Lewis. Tracks every known direct-ancestor slot using standard genealogical numbering (father = 2n, mother = 2n+1). Coverage summary table, per-generation listings, surname index by region, and prioritised dead-ends list. Currently 302 known ancestors across 17 generations. See **Research approach** below. |
| `web/` | **Family history site** (Next.js): static browsing for `index.md`, `people/`, `stories/`, `topics/`, `sources/`, corpus indexes, `research/`, `manual/`; **`/chart`** ancestor fan from `family-tree.json`; **`/files/...`** serves `media/`, `sources/corpus/`, and `family-tree.json` (local dev: filesystem read; Vercel: static CDN via prebuild copy to `public/files/`). **`web/photo-map.json`** maps tree id → repo-relative image path (e.g. `media/images/portraits/…`) for chart + person sidebar. Dev: `cd web && npm install && npm run dev`. Deploy: see **Deployment (Vercel)** section below. See `web/README.md`. |

## Primary workflow (read → write)

The vault is for **judgment and narrative**, not for treating machine extracts as finished work.

1. **Read the evidence** in `sources/corpus/<slug>/`: prefer **`transcription*.md`**, **`translation*.md`**, and **`reference.md`** when present; use **`extracted.pdf.md` / `extracted.web.md`** or the file under **`media/`** when that is what you have.
2. **Integrate** defensible facts and (where rights allow) short quotations into **`people/*.md`**, **`stories/*.md`**, **`topics/*.md`**, or a thin **`sources/*.md`** card—always with **repo-relative links** back to the bundle.
3. **`research/`** is working space; fold stable conclusions into those canonical files and trim redundant memos.

Scripts (below) handle **sync, ingest, and validation**. They do not replace opening the markdown or PDF and writing what you learned.

## Content types (Markdown)

| Dir | Holds |
|-----|--------|
| `stories/` | Multi-gen or long-form essays rendered as **visual scrollytelling** on the web app. Each story has two files: `<slug>.md` (vault markdown with `# Title` and `## Section` headings) and `<slug>.scrolly.json` (sidecar configuring the visual layout). See **Building a story** below. |
| `topics/` | Places, institutions, themes, and regional family hubs (`topics/index.md` hub). Includes former "line hubs" (Persia, Zara, Lewis/Stump, Evans/Cerpa-Pérez). |
| `sources/*.md` | **Citation cards**: short summary, links to people, pointer into corpus. Optional YAML `corpus:` + `kind: pdf\|web`. |
| `index.md` | Vault map (tables for `media/` layout). |
| `manual/` | **Inbox** for raw drops to be **read and relocated** into `people/`, `stories/`, `sources/corpus/`, `media/`, etc. See `manual/README.md`. |

**Regional hubs (in `topics/`):** `topics/persia.md` (Persia trunk); `topics/zara-italy-dalmatia.md` (Zara); `topics/evans-cerpa-perez-london-chile.md` (London Evans × Chile).

## Sources: corpus bundles

Path: `sources/corpus/<slug>/` — inventory: [sources/corpus/README.md](sources/corpus/README.md). **Held map:** [sources/master-source-list.md](sources/master-source-list.md). **Acquisitions to pursue:** [sources/wishlist/README.md](sources/wishlist/README.md).

| File | Meaning |
|------|---------|
| `source.yaml` | `remote.primary_pdf_url`, `remote.webpage_url`, `fetches[]` (sha256, etag, last-modified). |
| `files.media_reference` | **Canonical PDF** under repo root (e.g. `media/...`) when the scan lives in `media/` — corpus does **not** duplicate bytes. |
| `original.pdf` | Only for **remote** ingests (`--url`); PDF stored in the bundle. Local ingests omit this. |
| `extracted.pdf.md` | Machine extract (pymupdf4llm); frontmatter `source_file` points at `media/...` or `original.pdf`. |
| `mirror.html` | Raw HTML snapshot. |
| `extracted.web.md` | Trafilatura extract from mirror. |
| `transcription*.md`, `translation*.md`, `*.en.md` (optional) | Human cleanup of the same source (e.g. `transcription-translation.en.md` next to `extracted.pdf.md`); register in `source.yaml` `files` when used. |

**Ingest:** `.venv/bin/python scripts/ingest_source.py` subcommands `pdf`, `web`, `status`. Create venv once: `python3 -m venv .venv && .venv/bin/pip install -r requirements.txt`. **Roadmap for richer PDF→MD:** [corpus/CONVERSION-PLAN.md](sources/corpus/CONVERSION-PLAN.md).

Offline web/PDF captures live in **`sources/corpus/<slug>/`** (`mirror.html`, `original.pdf`, extracts) — not a separate mirrors tree.

## Binaries & legacy

| Dir | Holds |
|-----|--------|
| `media/` | Evidence: albums, collections, docs inbox, publications, charts, military PDFs, loose images. See `index.md` **Media layout**. |
| `archive/` | Gramps/RM exports, sun charts, legacy GEDCOM (no longer used by sync), personal files. **Not** canonical tree. Catalog: `archive/index.md`. |
| `sources/legacy-index.md` | Catalog of pre-reorg paths if still referenced. |

Do **not** commit or edit `.venv/`, `__pycache__/`, `.mypy_cache/`.

## Scripts (hygiene & ingest)

Optional tooling—not a substitute for reading corpus files and editing prose.

- `validate_family_tree_json.py` — validate `family-tree.json` (schema 1 or 2).
- `sync_family_tree_json.py` — apply `people/*.md` (`treeId`) + keep hand-edited JSON fields. Vault-only (no GEDCOM). `merge_gedcom_vitals_into_family_tree.py` is a backward-compatible wrapper.
- `ingest_source.py` — corpus PDF/web ingest + provenance (`--no-page-markers` to skip `<!-- page N -->` breaks). **Web:** optional `--public-url` when `--url` is a fetch-only endpoint (e.g. MediaWiki REST HTML); **403** from Wikimedia falls back to **curl** for the same URL.
- `batch_pdf_extract.py` — run `ingest_source.py pdf` for each row in `sources/corpus/pdf-ingest-manifest.yaml` (use `.venv/bin/python scripts/batch_pdf_extract.py`).
- `ingest_all_media_pdfs.py` — ingest `media/**/*.pdf` not yet in corpus; **default easy tier** skips charts, NYPL scan folders `…/1/`–`9/`, and PDFs **>12 MiB**; `--all` for full sweep (`--dry-run`, `--limit N`).
- `source_coverage_report.py` — corpus bundles vs `sources/**/*.md` link coverage (excludes `sources/wishlist/`).
- `generate_corpus_bibliography.py` — regenerate `sources/corpus-bibliography.md` (one inbound link per `corpus/<slug>/`).
- `corpus_extract_health.py` — optional inventory of thin machine extracts (still **read** `transcription*` / `translation*` / `reference.md` / PDFs in the bundle).
- `marker_reextract.py` — re-extract broken `extracted.pdf.md` files using **marker-pdf** (Surya OCR). Handles image-only scans, RTL scripts (Farsi/Arabic), multi-column layouts, and Google Books doubled-text artifacts that `pymupdf4llm` cannot. Single: `--slug <slug>`; batch: `--manifest sources/corpus/reextract-manifest.yaml`. Use `--force-ocr` for image-only PDFs, `--backup` to keep old `.bak`. Manifest (`reextract-manifest.yaml`) lists all broken files with strategy/priority.
- `generate_ancestor_coverage_list.py`, `validate_family_tree_json.py` — tooling; read before changing outputs.

## Deployment (Vercel)

**Live site:** <https://family-tree-lewis.vercel.app/>

**GitHub repo:** `TonyLLondon/family_tree` (private). Vercel auto-deploys on every push to `main`.

**Vercel project settings:**

| Setting | Value |
|---------|-------|
| Root Directory | `web` |
| Framework | Next.js (auto-detected) |
| Build command | `npm run build` (runs prebuild copy script first) |
| Plan | Hobby (free) |

**How static files are served on Vercel:**

The `/files/[...path]` API route uses `fs.readFileSync` at runtime, which works for local dev but not on Vercel's serverless functions (files aren't on the function's filesystem). Instead:

1. `web/scripts/copy-static-files.mjs` runs before `next build` (via the `build` script in `package.json`).
2. It copies `../media/`, `../sources/corpus/`, and repo-root `family-tree.json` into `web/public/files/` (same paths as `/files/…` on the site).
3. Next.js serves `public/files/` as static CDN assets — requests to `/files/media/…`, `/files/sources/corpus/…`, and `/files/family-tree.json` are served from the edge without invoking a serverless function.
4. Edge `web/proxy.ts`: `.md`/`.yaml` under `/files/` rewrite to `/view/…` (unless `?raw`). `/view/` pages are **pre-rendered at build time** via `generateStaticParams` (SSG) — the build reads from the full repo, so local dev and production serve identical rendered HTML with no serverless function.
5. `web/public/files/` is gitignored (build artifact, regenerated each deploy).
6. `next.config.ts` has `outputFileTracingExcludes` to prevent the ~1 GB of static files from being bundled into serverless functions (Vercel's 300 MB function limit).

**What's gitignored (not deployed):**

| Dir | Why |
|-----|-----|
| `archive/` | PPTX sun charts, Gramps exports, legacy GEDCOM, personal files — not needed by the web app |
| `manual/` | Unprocessed inbox scans — file into `media/` or `sources/corpus/` before they appear on the site |
| `web/node_modules/`, `web/.next/` | Build artifacts |
| `web/public/files/` | Generated at build time by the prebuild copy script |

**Portrait images:** Extracted JPGs from the sun-chart PPTX live in `media/images/portraits/`. Previously in `archive/sun-charts/…` (gitignored). Referenced by `web/photo-map.json` and `stories/*.scrolly.json`.

## Building a story

Stories are **side-by-side image + text pages** on the web app — each section gets a full-viewport layout with the image on the left (55%) and text on the right (45%), navigated by arrow keys, trackpad swipe, touch swipe, or click. Every story needs **two files** in `stories/`:

| File | Purpose |
|------|---------|
| `<slug>.md` | Vault markdown. Structured as `# Title` then `## Section` headings. Each `##` section becomes one page (side-by-side image + text). Sections after `scrollyStepCount` render as a scrollable appendix. `###` subsections within a `##` render inside the same text panel. |
| `<slug>.scrolly.json` | Sidecar controlling the visual layout: `hero` (title, subtitle, era), `scrollyStepCount` (how many `##` sections are paged vs appendix), and `steps[]` (one per paged section, each with `era` string and `media: { src, alt, caption? }`). |

**Sidecar shape (standard story):**

```json
{
  "hero": { "title": "…", "subtitle": "…", "era": "1860 – 1940" },
  "scrollyStepCount": 7,
  "steps": [
    {
      "era": "1860 – 1880",
      "media": {
        "src": "media/context/london-clerkenwell/some-image.jpg",
        "alt": "Description for accessibility",
        "caption": "Caption shown bottom-right over the image"
      }
    }
  ]
}
```

**Sidecar shape (scrapbook — used by certi-ricordi):**

```json
{
  "hero": { "title": "…", "subtitle": "…", "era": "…" },
  "layout": "scrapbook",
  "scrollyStepCount": 0,
  "steps": [],
  "pages": [
    { "image": "media/docs/certi-ricordi/Nonna000.jpg", "alt": "Page description" }
  ]
}
```

**Image paths** in `steps[].media.src` or `pages[].image` are **repo-relative** (e.g. `media/docs/alfred-evans-baptism-holy-redeemer-clerkenwell-1893.jpg`). The web app resolves them to `/files/…` URLs via `photoPublicPath`. Use family photos from `media/docs/` or `media/images/portraits/` where available; use context images from `media/context/<topic>/` for scenes, maps, and landmarks. Each `media/context/<topic>/` directory must include a `CREDITS.md` listing source and licence for every image.

**How it renders:** `web/components/StoryNarrative.tsx` renders all stories with side-by-side image + text layout. Navigation: keyboard arrows, trackpad horizontal swipe, touch swipe, and click arrows. Features: cover page (hero with blurred first-image preview), per-page era ribbon and image caption, lightbox zoom, URL hash deep-linking, progress bar, and appendix view for sections beyond `scrollyStepCount`. Both standard (`steps[]`) and scrapbook (`pages[]`) sidecars are normalised to the same page model by the route. If no `.scrolly.json` sidecar exists, the story falls back to a plain `PageShell` + `MarkdownContent` article layout.

**Checklist for a new story:**

1. Write `stories/<slug>.md` with `# Title`, then `## Section` per visual beat, then `## Evidence` / `## Related` as appendix.
2. Gather images: family photos in `media/docs/`; download CC/public-domain context images to `media/context/<topic>/` with a `CREDITS.md`.
3. Create `stories/<slug>.scrolly.json` matching the number of `##` sections to `scrollyStepCount` and `steps[]`.
4. Link the story from the relevant `topics/*.md` hub (not from unrelated hubs — Evans stories link from `evans-cerpa-perez-london-chile.md`, not from `persia.md`).
5. Test locally: `cd web && npm run dev` → visit `/stories/<slug>`.

## Research approach

The project works **generation by generation, parent by parent**, pushing each direct line back as far as records allow. The [ancestor-tracker.md](ancestor-tracker.md) is the dashboard for this effort.

**Method:** For each person on the frontier (the deepest known ancestor in a line), search for their baptism/birth record — which names their parents — then catalog the record in `sources/corpus/`, add the parents to `family-tree.json`, create `people/*.md` pages, and update the tracker. Repeat.

**Evidence standards:** Every parent-child link should be supported by at least one primary record (baptism, burial, marriage, or family register). Where the link rests on circumstantial evidence only (e.g. sole bearer of a surname in a parish, consistent birth spacing, naming patterns), it is marked 🔗⚠ in the tracker and flagged as "unconfirmed" in the person page. The [sources/wishlist/](sources/wishlist/) captures what would be needed to resolve each gap.

**Priorities:** Shallow dead ends first — lines that stop earliest offer the most generational gain per research effort. The tracker's "Dead ends" section ranks these. Currently the shallowest lines are the Chilean (Cerpa/Pérez/González/Escobar, Gen 4–5) and French (Bottin/Baudouin, Gen 6).

**Tools:** `scripts/fs_search.py` queries FamilySearch historical records via CLI (catalog, records, detail, image subcommands). Bearer token from browser DevTools; never stored in env vars. Swiss church record images are restricted to FamilySearch Centers; indexed text data is captured in `sources/corpus/<slug>/reference.md` regardless.

## Editorial voice

Treat **reader-facing genealogy** as distinct from **working vault** material.

| Audience / role | Paths | Voice |
|-----------------|-------|--------|
| **Prose & engagement** | `people/*.md`, `topics/*.md`, `stories/*.md` | Continuous prose: clear biographical or topical writing that a non-genealogist can read. Lead with people, places, and story; explain context in plain language. |
| **Working vault** | `research/`, `manual/`, `index.md`, `sources/*.md` cards, `sources/corpus/*` extracts | Operational detail is fine: tables, filing codes, wishlists, GEDCOM/file-level provenance, sync notes, “next steps.” |

When **people/topics/stories** need machine or export identifiers (`treeId`, FamilySearch IDs), keep them in YAML frontmatter and/or a compact **Evidence** / **Sources & identifiers** section so the main body reads like an article, not a database dump.

**No direct FamilySearch or other platform links in people/topics/stories pages.** All FamilySearch record data must first be transcribed into `sources/corpus/<slug>/reference.md` (with record IDs, dates, names, image ARKs). People pages then cite the **corpus reference** or **source card** — never a raw `familysearch.org` URL. This keeps the vault self-contained: if FamilySearch changes URLs or access, the evidence is already captured locally.

**Collaborative tree references (FamilySearch Tree, Geni, Geneanet, Ancestry).** These are *secondary sources* — records of another researcher's work, not primary evidence. They are valuable as reference points, attribution, and aggregated citations. Handle them as follows:

| Source type | Corpus treatment |
|-------------|------------------|
| **Primary record** (baptism, census, civil register, etc.) | Must be transcribed into `sources/corpus/<slug>/reference.md` |
| **Collaborative tree** (FS Tree person, Geni profile, Geneanet tree, Ancestry tree) | Create a corpus entry per researcher/tree covering the family cluster (e.g. `geneanet-meazza-addobbati/`). List the person IDs, contributing researcher, platform, and what data the tree provides. People pages cite this corpus entry. |

Tree person IDs (e.g. `GW1S-CGK`, Geni numeric IDs) are kept in the corpus `reference.md` as identifiers — they are breadcrumbs for future researchers, not evidence of anything. The people page Evidence section cites the **corpus entry** (e.g. "Meazza Geneanet tree") and names the contributing researcher where known.

## Conventions

- **Links:** repo-relative from the file you edit (e.g. from `people/x.md` use `../sources/...`, `../topics/...`).
- **New remote source:** add `sources/corpus/<slug>/` via ingest; thin card in `sources/<name>.md` pointing at `corpus/<slug>/`.
- **Large PDFs:** Keep canonical scans under `media/`; corpus holds `extracted.pdf.md` + `source.yaml` (+ `original.pdf` only for remote fetches). Consider Git LFS if repo size hurts.
- **Scope:** Only change files needed for the task; match existing frontmatter/link style.
