# `inbox/` — pre-filesystem staging

Drop raw incoming material here before triage:

- PDFs (any size)
- single-image scans (JPG / PNG / TIFF)
- text files listing URLs to ingest
- screenshots needing OCR / vision

The runner will:

1. Move the file to its canonical home under `media/...` (or fetch the URL).
2. Create a corpus bundle at `sources/corpus/<slug>/`.
3. Run probe + auto-route + execute.
4. Update [`../state.md`](../state.md).

## What's tracked vs what's gitignored

| Tracked | Gitignored |
|---------|------------|
| This `README.md` | Everything else inside `inbox/` |
| `.gitkeep` | (raw drops can be very large) |

## How to use

```
# drop your file:
cp ~/Downloads/some-scan.pdf projects/ingest_source/inbox/

# triage it (will create bundle + run the right tier):
.venv/bin/python projects/ingest_source/runner/extract_source.py triage \
    --slug some-meaningful-kebab \
    --file projects/ingest_source/inbox/some-scan.pdf
```

If your source is already filed under `media/...`, skip the inbox and pass `--file media/...` directly.
