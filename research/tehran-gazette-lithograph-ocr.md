# Tehran Gazette — lithograph OCR strategy

**Primary pipeline (2026-10-08):** **Asmane 4-volume** set (3,243 pp) — resumable **`tehran-gazette-nlir1373-marker-fleet`** (25-page bands → `transcription.marker/`). Vol. **2 first** (issue 131+ / Edward). Legacy lithograph bands under `transcription.marker-lithograph/` (200-page issues 1–130 scan) still valid for spot grep. Surya `_ocr_index` on 9-bundle set **paused**.

```bash
.venv/bin/python3 scripts/generate_tehran_gazette_marker_fleet.py
.venv/bin/python3 projects/ingest_source/runner/batch_runner.py fleet-start \
  --fleet projects/ingest_source/jobs/tehran-gazette-nlir1373-marker-fleet.yaml --parallel 1
.venv/bin/python3 scripts/grep_tehran_gazette_marker.py برجیس داود اجازه
```

Plan: [tehran-gazette-nlir1373-plan.md](tehran-gazette-nlir1373-plan.md).

**Problem:** Fleet Surya at **200–300 DPI** on Nasta'liq lithograph (PDF pp. 17–200) produces **page-finder–grade** text, not readable Persian or reliable name grep. Example: **PDF p.25** (issue 9, Karīm Khān b. Dāʾūd Khān / Julfa Armenians) — see bench below.

**Bench (PDF p.25):** `research/tehran-gazette-p025-ocr-bench/`

| Method | Keyword score (11 terms) | Readable paragraph? |
|--------|-------------------------:|---------------------|
| Fleet baseline 200 DPI | ~2 | No |
| Surya 300/400 DPI PDF raster | 2–3 (often **≤** 200 DPI on p.25) | No |
| Surya 300 + stale `pages-png/` | 3 | No |
| **Marker** (`marker-p25-bench.fa.md`) | **8+** (داود، ارمن، فوج، امورات قشونی…) | **Yes** (with OCR typos: کرین، صفهانی→جلفا) |
| **Agent + PNG** | — | **Citation-grade** (see `transcription.snippets.fa.md`) |

## Fleet changes (2026-10-08)

- **`ocr_highres_dpi: 300`** for all NLIR jobs (`scripts/generate_tehran_gazette_full_ocr_jobs.py`).
- **`ocr_no_prefer_pages_png: true`** everywhere — rasterise from PDF at job DPI (do not embed old 200 DPI `pages-png/` frames into Surya batches).
- **Uniform reindex:** `scripts/generate_tehran_gazette_full_ocr_jobs.py --uniform-reindex` then `batch_runner fleet-start` — re-OCRs all **3448** pages at 300 DPI (~**19–22 h** one worker). Meaningful for **consistent grep**; lithograph **names** still need Marker/PNG.

## Vol. 1 lithograph already indexed at 200 DPI

Re-run lithograph band when you care about grep quality:

```bash
.venv/bin/python3 projects/ingest_source/runner/extract_source.py triage \
  --slug tehran-gazette-vol01-issues-001-130 --tier c \
  --ocr-index --ocr-index-pages 17-200 \
  --ocr-highres-dpi 300 --ocr-index-force --ocr-no-prefer-pages-png
```

Expect **hours** for 184 pages; still not Marker-quality for names.

## Citation / Edward / Daoud hits

1. **Surya `_ocr_index/`** — find candidate **page numbers** (typeset preface works well; lithograph: verify on PNG).
2. **Marker** (single page or range) — `scripts/tehran_gazette_marker_pages.py --pages 25`.
3. **Snippet transcription** from `pages-png/` — publish in `transcription.snippets.fa.md`.

Do **not** quote lithograph text from Surya alone without PNG check.

## Tools

- `scripts/tehran_gazette_lithograph_ocr_bench.py --page N` — compare Surya DPI variants.
- `scripts/tehran_gazette_marker_pages.py` — Marker markdown under `sources/corpus/<slug>/`.
