# Tehran Gazette — NLIR 1373 facsimile PDFs

**Canonical (only copies in repo):** four-volume Asmane Ketab / NLIR **1373** reprint (**3,243** pages).

| PDF | Pages | Corpus slug |
|-----|------:|---------------|
| `tehran-gazette-nlir1373-vol01.pdf` | 825 | `tehran-gazette-nlir1373-vol01` |
| `tehran-gazette-nlir1373-vol02.pdf` | 853 | `tehran-gazette-nlir1373-vol02` |
| `tehran-gazette-nlir1373-vol03.pdf` | 863 | `tehran-gazette-nlir1373-vol03` |
| `tehran-gazette-nlir1373-vol04.pdf` | 702 | `tehran-gazette-nlir1373-vol04` |

**Bibliography (best hold):** [sources/tehran-gazette-nlir1373.md](../../../sources/tehran-gazette-nlir1373.md) (OPAC **AP95 9ر/1373**). Provenance: [manual/tehran-gazette-asmane/README.md](../../../../manual/tehran-gazette-asmane/README.md). IA log: [research/tehran-gazette-ia-acquisition.md](../../../research/tehran-gazette-ia-acquisition.md).

**Derivative corpus (frozen page map):** `tehran-gazette-vol01-issues-001-130` — PNGs, snippets, lithograph Marker bands for issues **1–130**; PDF page labels **1–200** refer to the old extract, not necessarily the same indices in `vol01.pdf`.

**Marker fleet (primary OCR):**

```bash
.venv/bin/python3 scripts/generate_tehran_gazette_marker_fleet.py
.venv/bin/python3 projects/ingest_source/runner/batch_runner.py fleet-start \
  --fleet projects/ingest_source/jobs/tehran-gazette-nlir1373-marker-fleet.yaml --parallel 1
```

Order: **vol. 2 → 3 → 1 → 4** (issue **131+** / Edward). Plan: [research/tehran-gazette-nlir1373-plan.md](../../../research/tehran-gazette-nlir1373-plan.md).
