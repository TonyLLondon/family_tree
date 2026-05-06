# `projects/ingest_source/` — Source intake & transcription

Self-contained operational project. Owns everything between **a new PDF/image/web page arriving** and **a corpus bundle the website can render**.

| Path | Purpose |
|------|---------|
| [`AGENTS.md`](AGENTS.md) | Operating playbook — decision tree, tier table, file conventions, `do-not-overwrite` rules. **Read first.** |
| [`state.md`](state.md) | Live dashboard — inbox queue, vision-pending, awaiting-verification, recent completions, stuck items. Hand-maintained (paste from `pending` / `status` when it changes). |
| [`inbox/`](inbox/) | Pre-filesystem staging for raw drops (PDFs, images, URL lists). Contents are gitignored — only `README.md` and `.gitkeep` are tracked. |
| [`runner/`](runner/) | The script(s) that process inbox → canonical repo paths (`sources/corpus/<slug>/`, `media/...`). |
| [`history/logs.md`](history/logs.md) | Project changelog — how the runner and this project itself have evolved. **Per-source audit lives in each bundle's `source.yaml.extractions[]`, not here.** |

## Where outputs go (this project does **not** own them)

- `sources/corpus/<slug>/` — bundles with `transcription.*.md` (or `transcription.snippets.md` for Tier C), `translation.en.md`, `reference.md`, `pages-png/`, optional `snippets/`, `source.yaml`
- `media/...` — canonical scans (PDFs, images) when the file isn't already there
- `sources/<slug>.md` — citation cards (created by the human/agent during the vision pass, not by the runner)
- `people/*.md`, `stories/*.md`, `topics/*.md` — citations back to the bundle (downstream)

## Single command surface

```
projects/ingest_source/runner/extract_source.py triage   --slug X [--file media/...] [--tier auto|a|b|c] [--lang fr] [--dpi 200] \
    [--focus "term,term"] [--regex] [--context 1] [--pages "1-12,234"] [--plan-only] \
    [--thumbnails] [--thumb-dpi 100] [--ocr-index] [--ocr-index-pages "1-50"] [--force]
projects/ingest_source/runner/extract_source.py probe    --slug X
projects/ingest_source/runner/extract_source.py pending
projects/ingest_source/runner/extract_source.py status   --slug X
```

Always invoked via the venv: `.venv/bin/python projects/ingest_source/runner/extract_source.py …`
