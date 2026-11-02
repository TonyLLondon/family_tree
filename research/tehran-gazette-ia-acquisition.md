# Tehran Gazette — Internet Archive & mirror search (2026-10-08)

## Conclusion

**Canonical hold:** four NLIR 1373 PDFs from Asmane Ketab (`tehran-gazette-nlir1373-vol01`–`vol04.pdf`, **3,243** pages). **No additional IA acquisition needed** for a complete catalog-faithful set.

The former **9 local PDFs** were **not** missing from IA — they live inside one mis-titled item as **`وقایع اتفاقیه.rar`** (`vagaye (1).pdf` … `vagaye (9).pdf`). That RAR is **superseded** by the Asmane 4-volume RAR (same NLIR edition, proper volume split). Legacy PDFs **purged** from `media/` 2026-10-08.

---

## Internet Archive — queries run

| Query | `numFound` | Notes |
|--------|------------|--------|
| `title:(وقایع اتفاقیه)` | **1** | [`20191220_20191220_2247`](https://archive.org/details/20191220_20191220_2247) |
| `title:(Ettefaqiye)` | 0 | — |
| `nlir1373` | 0 | — |
| `vagaye` (identifier/title) | 0 | Filename not indexed |
| `وقایع` (broad) | 139 | Only one *Vaqāyeʿ-e Ettefāqiye* title match (same item) |
| `title:(Vaqaye)` | 9 | Unrelated Afghan / historical “Vaqaye” books |
| `creator:("National Library" Iran)` | 2 | Unrelated NLIR music records (2026 uploads) |
| `subject:Tehran + subject:newspaper + language:Persian` | 0 | — |

### Item [`20191220_20191220_2247`](https://archive.org/details/20191220_20191220_2247)

| Asset | Size | Verdict |
|--------|------|---------|
| **`وقایع اتفاقیه.rar`** | ~117 MB | **9 PDFs:** `vagaye (1).pdf` … `vagaye (9).pdf` — source of old repo filenames after rename; **no vol. 4 in name**, arbitrary splits, **3,448** pp total |
| `ایران.rar` | ~44 MB | Tabarestan watermark scans — **not** the gazette |
| `خاطرات…`, `روزنامه قانون`, `مرات السفر` PDFs | various | Other newspapers / memoirs — same sloppy bundle |
| Metadata collection | `booksbylanguage_urdu` | Poor cataloguing |

**Download verified:** `https://archive.org/download/20191220_20191220_2247/%D9%88%D9%82%D8%A7%DB%8C%D8%B9%20%D8%A7%D8%AA%D9%81%D8%A7%D9%82%DB%8C%D9%87.rar` — listed with `bsdtar`; not kept in repo (Asmane set retained).

---

## Browser / other mirrors (2026-10-08)

| Source | Result |
|--------|--------|
| [Asmane Ketab](https://asmaneketab.ir/product/%d8%b1%d9%88%d8%b2%d9%86%d8%a7%d9%85%d9%87-%d9%88%d9%82%d8%a7%db%8c%d8%b9-%d8%a7%d8%aa%d9%81%d8%a7%d9%82%db%8c%d9%87/) | **Canonical PDFs in repo** — Picofile `vaqetefie.rar` → 4 PDFs (825/853/863/702 pp) |
| [OPAC mirror (Zheen)](http://zheenlibrary.com/opac/index.php?id=22030&lvl=record_display) | **Confirmed** **AP95 9ر/1373**, 1373, NLIR publisher, **1656 pp / 2 physical vols**; scope note 1277–1367; Rezvani preface |
| [OPARS serial sc28279](https://www.opars.com/serial/sc28279/) | Run **1267–1277** AH, **471 issues**; names Burgess as translator/editor |
| [search.worldcat.org](https://search.worldcat.org/) | **429 Cloudflare** from automation — use OPAC mirror above |
| [nlai.ir](https://www.nlai.ir/) | **Timeout** (15 s) — same record as OPAC mirror when site loads |

**Source card:** [sources/tehran-gazette-nlir1373.md](../sources/tehran-gazette-nlir1373.md).

---

## Repo policy after purge

| Keep | Remove |
|------|--------|
| `media/…/tehran-gazette-nlir1373-vol0[1-4].pdf` | 9-bundle PDFs, IA RAR copies |
| Corpus `tehran-gazette-nlir1373-vol0*` + **`tehran-gazette-vol01-issues-001-130`** (frozen PNG/Marker work; page numbers = old 200-pp extract) | `tehran-gazette-ia-vagaye-*`, `tehran-gazette-ia-scan-vagaye-*` |
| Fleet `tehran-gazette-nlir1373-marker-fleet.yaml` | `tehran-gazette-full-ocr-fleet`, `tehran-gazette-marker-full-fleet`, all `ia-vagaye-*` jobs |

See [tehran-gazette-nlir1373-plan.md](tehran-gazette-nlir1373-plan.md), [INVENTORY.md](../media/docs/internet-archive/tehran-gazette/INVENTORY.md).
