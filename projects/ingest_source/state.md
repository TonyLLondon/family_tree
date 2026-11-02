# `projects/ingest_source/state.md`

Live snapshot. Rewritten by the runner after each pass; safe to hand-edit between runs.

**Last updated:** 2026-10-09T16:58Z

## Inbox queue (`inbox/`)

_(empty — drop PDFs / images here, then run `triage`)_

## Vision-pending

Bundles with `pages-png/manifest.json` but missing the expected outputs the manifest names. Sorted by cite-pressure (links from `people/`, `stories/`, `topics/`).

```
$ .venv/bin/python projects/ingest_source/runner/extract_source.py pending
```

_(currently: 0 bundles)_

`bottin-contract` is the only bundle with rendered pages, and its existing `transcription-translation.en.md` (legacy combined file) satisfies the "has any transcription/translation/reference" check. The Persian column is still untranscribed — tracked separately under "Known refinement work" below.

## Awaiting verification

Bundles with `verified: false` agent-grade transcriptions ready for human sign-off.

_(currently: 0 — the `verified:` frontmatter convention is new; nothing predates it)_

## Recently completed

| When (UTC) | Slug | Tier | Notes |
|------------|------|------|-------|
| 2026-04-19T07:30Z | `bottin-contract` | B render | First end-to-end test of `extract_source.py` (then `extract_pdf.py`). Pages PNG + manifest. Existing French/English transcription-translation.en.md untouched. |

## Background mechanical jobs

### Tehran Gazette — Marker full PDF (primary, ~36 h)

| Asset | Role |
|-------|------|
| `jobs/tehran-gazette-marker-full-fleet.yaml` | **9 PDFs, 3448 pages** → `extracted.pdf.md` per slug |
| `scripts/generate_tehran_gazette_marker_fleet.py` | Regenerate job YAMLs + `on_complete_fleet` chain |

```bash
.venv/bin/python3 projects/ingest_source/runner/batch_runner.py fleet-status \
  --fleet projects/ingest_source/jobs/tehran-gazette-marker-full-fleet.yaml
.venv/bin/python3 projects/ingest_source/runner/batch_runner.py fleet-start \
  --fleet projects/ingest_source/jobs/tehran-gazette-marker-full-fleet.yaml --parallel 1
```

Vol. 1 lithograph bands (`transcription.marker-lithograph/`, ~92% before handoff): `scripts/grep_tehran_gazette_marker.py`. Strategy: `research/tehran-gazette-lithograph-ocr.md`.

### Tehran Gazette — NLIR 1373 Marker fleet (**paused** 2026-10-09)

`jobs/tehran-gazette-nlir1373-marker-fleet.yaml` — **PAUSED** at **2891/3243** pages (**89.1%**). Vols **1–3** complete; **vol. 4** **350/702** (stopped mid-band **p351–p375**). No workers running.

```bash
.venv/bin/python3 projects/ingest_source/runner/batch_runner.py fleet-status \
  --fleet projects/ingest_source/jobs/tehran-gazette-nlir1373-marker-fleet.yaml
.venv/bin/python3 projects/ingest_source/runner/batch_runner.py fleet-start \
  --fleet projects/ingest_source/jobs/tehran-gazette-nlir1373-marker-fleet.yaml --parallel 1
```

Log: `history/jobs/tehran-gazette-nlir1373-vol04-marker.log` (interrupted step will **RESET** on next start).

### Tehran Gazette — Surya `_ocr_index` (paused)

`jobs/tehran-gazette-full-ocr-fleet.yaml` — **PAUSED** (~40/3448). Page-finder only; resume only if you need coarse grep across IA bundles without Marker.

## Stuck / failed

_(check `history/jobs/*.state.json` for `failed` steps)_

## Known refinement work (manual queue)

Single-bundle gaps an agent can pick up by hand without going through `triage`:

| Slug | Gap | Action |
|------|-----|--------|
| `bottin-contract` | Persian (left) column never transcribed; right-column French and English already in `transcription-translation.en.md` | Vision pass on `pages-png/p001.png … p003.png`; write `transcription.fa.md` (Persian column only). Be explicit about confidence per article. |

## Coverage snapshot

- Corpus bundles total: ~487
- Bundles with `pages-png/`: 1 (only `bottin-contract` so far)
- Bundles with `verified: false` agent transcriptions: 0
- Backlog of `media/**/*.pdf` not yet ingested: see `scripts/ingest_all_media_pdfs.py --dry-run` (legacy script, will be folded into `triage --sweep`)
