# `projects/ingest_source/state.md`

Live snapshot. Rewritten by the runner after each pass; safe to hand-edit between runs.

**Last updated:** 2026-04-19T07:35Z (initial seed)

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

## Stuck / failed

_(none)_

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
