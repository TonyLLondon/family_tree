# Tehran Gazette (NLIR 1373) — plan after Asmane 4-volume acquisition

**Date:** 2026-10-08

## What changed

| Before | After |
|--------|--------|
| 9 IA-bundle PDFs (3,448 pp) | **Purged** — same content as IA `وقایع اتفاقیه.rar`, superseded by Asmane **4 vol** (3,243 pp) |
| `marker-full` on 9-bundle set | **`tehran-gazette-nlir1373-marker-fleet`** (25-page bands) |

**Only PDFs in `media/`:** `tehran-gazette-nlir1373-vol01`–`vol04.pdf`. Corpus **`tehran-gazette-vol01-issues-001-130`** keeps PNG/Marker/snippet work; page numbers = old 200-page extract (see bundle `reference.md`).

## Edward / Daoud research sequence

1. **Run Marker fleet** starting with **vol. 2** (issues ~131+).
2. **Grep** each vol. as bands land:

   ```bash
   .venv/bin/python3 scripts/grep_tehran_gazette_marker.py برجیس داود اجازه مرخص
   ```

   (Extend script if needed to scan `tehran-gazette-nlir1373-vol02/transcription.marker/`.)

3. **Map issue numbers** (`نمره`) from readable Marker lines → Gregorian dates (vol. 1 preface / tables in Asmane vol. 1 PDF).
4. **Human snippets** for citations: `transcription.snippets.fa.md` per slug (PNG verify lithograph names).
5. Update [edward-gazette-crosswalk.md](../sources/corpus/tehran-gazette-vol01-issues-001-130/edward-gazette-crosswalk.md) with **Asmane PDF page ↔ issue** once vol. 2 front matter is read.

## Runtime estimate (Marker bands)

- ~**130 steps** per vol. 2 (853÷25); ~**2–8 min/step** depending on lithograph density → **~4–17 h per volume**, **~1–3 days** for vol. 2+3 Edward window if one worker.
- **Do not** restart Surya full-fleet on lithograph for name grep.

## Browser / acquisition follow-ups

| Target | Result (2026-10-08) |
|--------|---------------------|
| [Asmane product page](https://asmaneketab.ir/product/%d8%b1%d9%88%d8%b2%d9%86%d8%a7%d9%85%d9%87-%d9%88%d9%82%d8%a7%db%8c%d8%b9-%d8%a7%d8%aa%d9%81%d8%a7%d9%82%db%8c%d9%87/) | **Confirmed:** ناشر = کتابخانه ملی ایران; نوبت چاپ = 1373; pages **825 / 853 / 863 / 702**; RAR 82 MB |
| [NLAI / nlai.ir](https://www.nlai.ir/) | **Navigate timeout** (15 s) from Local Browser — retry later or use OPAC mirror for **AP95 9ر/1373** |
| Google / WorldCat | Thin English hits; issue-year span still to read from **vol. 1 PDF** after Marker on preface pages |

Front matter in Asmane PDFs is **image-only** (no pymupdf text layer); issue-date table extraction depends on Marker or manual PNG read.

## Commands

**Fleet started 2026-10-08** on **vol. 2** (`tehran-gazette-nlir1373-vol02-marker`).

```bash
.venv/bin/python3 projects/ingest_source/runner/batch_runner.py fleet-status \
  --fleet projects/ingest_source/jobs/tehran-gazette-nlir1373-marker-fleet.yaml
tail -f projects/ingest_source/history/jobs/tehran-gazette-nlir1373-vol02-marker.log
.venv/bin/python3 scripts/grep_tehran_gazette_marker.py برجیس داود اجازه  # after bands land
```

## Superseded

- `tehran-gazette-marker-full-fleet.yaml` (9 PDFs, single `marker-full` step each) — **stopped 2026-10-08**.
- Surya `tehran-gazette-full-ocr-fleet.yaml` — **paused**; see [tehran-gazette-lithograph-ocr.md](tehran-gazette-lithograph-ocr.md).
