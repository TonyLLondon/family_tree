# Vol. 1 lithograph — Marker transcriptions

Force-OCR Persian text from the NLIR facsimile lithograph band (PDF **p. 17–200**, issues ~1–130). **Grep these files** for names and topics; verify doubtful readings against [pages-png/](pages-png/).

| PDF pages | File | Status |
|-----------|------|--------|
| 17–26 | [p017-026.fa.md](transcription.marker-lithograph/p017-026.fa.md) | pilot complete |
| 27–200 | [transcription.marker-lithograph/](transcription.marker-lithograph/) | batch job `tehran-gazette-vol01-lithograph-marker` |

**Job:** `projects/ingest_source/jobs/tehran-gazette-vol01-lithograph-marker.yaml`  
**Fleet:** `projects/ingest_source/jobs/tehran-gazette-lithograph-marker-fleet.yaml`

```bash
.venv/bin/python3 projects/ingest_source/runner/batch_runner.py fleet-status \
  --fleet projects/ingest_source/jobs/tehran-gazette-lithograph-marker-fleet.yaml
```

Curated PNG-verified excerpts: [transcription.snippets.fa.md](transcription.snippets.fa.md). Edward research map: [edward-gazette-crosswalk.md](edward-gazette-crosswalk.md).
