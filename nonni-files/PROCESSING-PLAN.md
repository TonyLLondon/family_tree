# Nonni files — processing plan

Phased plan for moving material from `manual/dump/` into `media/docs/`, `sources/corpus/`, and updating `people/*.md`, `stories/`, and line hubs.

**Source:** `manual/dump/` (10,135 files remaining; started at 10,644 after dedup)
**Destination:** `media/docs/<person-or-topic-slug>/`, `sources/corpus/<slug>/`

---

## File formats

All files in the dump have been normalised:

- **Images:** 10,627 `.jpg` (all lowercase). One stray `.JPG` was renamed.
- **Documents:** 16 `.pdf`. The original 13 `.doc` and 3 `.rtf` files were converted to PDF via LibreOffice, then the originals were deleted.
- **PDF page images:** Every PDF has a sibling folder (same name, no extension) containing 300 DPI JPEG renders of each page (`page-1.jpg`, `page-2.jpg`, …). This allows vision models to read document content directly from images without PDF parsing. 23 page images total across 16 PDFs.

Example layout:

```
family-tree-documents/ft-file/
  FamHist180996.pdf          ← the document
  FamHist180996/             ← sibling folder, same name
    page-1.jpg               ← 300 DPI render of page 1
    page-2.jpg
    ...
    page-7.jpg
```

---

## Phase 1 — Family tree documents

**Source:** `manual/dump/family-tree-documents/` (268 files, 333 MB)

| Subfolder | Files | Moved to |
|-----------|-------|----------|
| `az&ez/` (68 files) | AZ & EZ certificates, family photos, San Miniato | `media/docs/zerauschek-family/` |
| `zerauschek/` (78 files) | Guido, R&L Zerauschek (incl. Will), Trieste, V Zerauschek | `media/docs/zerauschek-family/` |
| `addobbati/` (9 files) | 7 duplicates (already in `sabalich-guida-zara-addobbati/`), 2 unique moved | `media/docs/sabalich-guida-zara-addobbati/` |
| `ft-album/` (75 files) | Fulvia's family tree album scans + 3 PDF transcriptions | `media/docs/fulvia-family-tree-album/` |
| `ft-file/` (41 files) | Family tree file documents, Nonna notes, NDeFranchi, tree diagrams | `media/docs/fulvia-family-tree-file/` |
| `rogers/` (4 files) | M Rogers letters 1986 | `media/docs/rogers-family/` |
| 6 loose JPGs | Rina Zerauschek, Graziella Rivolta, Ignazio Tonioni, S&LL negatives | `media/docs/zerauschek-family/` |

**Status:** Complete. 268 files processed, 7 duplicates skipped, 261 unique files moved to `media/docs/`.

---

## Phase 2 — Correspondence

**Source:** `manual/dump/correspondence/` (362 files, 232 MB)

### 2a — Family letters (high priority) — DONE

| Subfolder | Correspondent | Files | Status |
|-----------|--------------|-------|--------|
| `az&eztofz/` (51 files) | Antonio & Ester → Fulvia (1936–1972) | Letters spanning boarding school, wartime Zara, exile, Antonio's last years | **Done** — integrated into `antonio-zerauschek.md`, `fulvia-*.md`, `giuliana-*.md`, `guido-*.md`, `mario-*.md`, `ester-*.md` |
| `fltoaz&ez/` (12 files) | Fulvia → Antonio & Ester | Christmas cards, letters c. 1952–72, 3 David Lewis watercolours | **Done** — integrated into `fulvia-*.md`, `david-john-lewis.md` |
| `mario/` (3 files) | Mario Zerauschek | Condolence letter (Nov 1972) on death of David's mother; telegram from Florence to Lusaka (Jul 1962) | **Done** — integrated into `mario-*.md`, `david-john-lewis.md`, `elizabeth-lilian-cushen.md` |
| `ce&liana/` (3 files) | Carlo Enrico Rivolta & Giuliana | CE to Fulvia (Sirmione, Apr 1948); Fulvia to CE (Dec 1995) re Zara documents | **Done** — integrated into `giuliana-*.md`, `fulvia-*.md` |
| `nonno/` (6 files) | David John Lewis → Fulvia | Note on KBT letterhead (May 1972); aerogramme from Zambia (Dec 1968) | **Done** — integrated into `david-john-lewis.md`, `fulvia-*.md` |
| `vjb/` (3 files) | Fulvia → Valerie ("Baba") | Letter (Jan 1967) re O-levels, modelling, interior design | **Done** — integrated into `fulvia-*.md`, `david-john-lewis.md` |
| `oml/` (2 files) | Michele (Michael) Lewis → David & Fulvia | Letter (May 1996) from 44 Lebanon Park, Twickenham; children Stephen and Alice | **Done** — integrated into `david-john-lewis.md`, `fulvia-*.md` |

### 2b — Family letters (lower priority)

Alice, Anthony, Bice, Butler, Cape Town, Gemma, Grazia, Laura, Louise, Lydia, Mark, Pendaren Street, Zie.

### 2c — Friends and general (lowest priority)

`correspondence/friends/` (Barrich, Fickling, Nella, Peggy, Sandra, etc.) and `correspondence/general/` (Africa, Brit Air, Smith).

**Per correspondent:** scan for dates and key content, ingest notable letters to `sources/corpus/`, cite in `people/*.md`.

---

## Phase 3 — Souvenirs — DONE

**Source:** `manual/dump/souvenirs/` (153 files after Sirmione subfolder processed earlier; 170 originally)

All 153 files read, content extracted, information integrated into people pages, and files moved to `media/docs/souvenirs/` with the following structure:

| Destination | Files | Content |
|-------------|-------|---------|
| `souvenirs/courtship/` | 20 | HPW Sirmione postcards and photos (1945–1949): David–Fulvia courtship correspondence, Fulvia portrait by Count Belgioioso (Sep 1946), Fulvia in England (1949), Fulvia with baby |
| `souvenirs/birthday-cards/` | 17 | DJ 80th birthday cards (1998), get-well cards (1999), FL birthday cards (1998), hand-drawn 81st birthday cards (1999) |
| `souvenirs/colonial-service/` | 8 | Bishop Mazzieri Vatican letter (Jul 1961), telegram Fulvia→David (Sep 1966), Lusaka Club tennis clipping (May 1963), aerogramme (1961), Kariba Hotel label |
| `souvenirs/fulvia-personal/` | 6 | National Geographic Society certificate (1995), "Al Congo con Nonno" book, letters to Peter |
| `souvenirs/peter-lewis-family/` | 15 | 1998 birthday calendar (13 pages), PMLsBirthdays.pdf + page image — **goldmine of birth dates** |
| `souvenirs/zerauschek-documents/` | 7 | Giuliana's Tripolitania visa (Apr 1951), Guido portrait, Liana UNICEF card, Lloyds Bank cheque, fascist-era docs |
| `souvenirs/africa-lusaka/` | 16 | Africa postcards, Lusaka Club, NR Police, Kyle Dam, Victoria Falls |
| `souvenirs/italy-postcards/` | 16 | Milano, Portofino, Pietrasanta, Florence, Brescia, Tripoli, Sussex postcards |
| `souvenirs/zara/` | 10 | Zara newspapers, society documents, Nonna photos |
| `souvenirs/family-photos/` | 21 | FL-Framed series (11), Fulvia 18th birthday (4), Fulle boat, Esso motorboat, Pel photos |
| `souvenirs/miscellaneous/` | 17 | Arezzo wedding, Castel-F brochure, C-E-Libri publishing, SanRemo, Parcelforce, blank scan |

**Also copied:** `KBT041083.jpg` → `media/docs/david-john-lewis-kbt/` (Fulvia Lewis Trophy press clippings)

**Key genealogical findings integrated:**
- **Giuliana Zerauschek** born **5 September 1921** in Zara (visa application + birthday calendar) — resolved open question
- **Carlo Enrico Rivolta** born **9 November 1920** (birthday calendar)
- **Daniela Rivolta** born **2 February 1946**, **Silvana Rivolta** born **5 August 1950** (birthday calendar + visa cross-ref)
- **Peter Mark Lewis** born **14 July 1953**; wife **Anne** (23 Aug 1960); children **Gemma** (26 Jan 1984), **Haley** (15 Feb 1985), **Clara** (5 Jan 1988), **Robert** (20 Nov 1989) — from PMLsBirthdays.pdf
- **Antonio Zerauschek** born **24 June 1889**, **Ester Addobbati** born **16 May 1896** — confirmed by birthday calendar
- **David John Lewis** — Deputy Provincial Commissioner of Ndola received papal audience introduction from **Bishop Francis Mazzieri OFM Conv.** (Jul 1961)
- **"Fulvia Lewis Keep Britain Tidy Trophy"** awarded at Café Royal, Oct 1983 (Daily Telegraph + Times)
- **Fulvia** played competitive tennis at **Lusaka Club** (1963 newspaper clipping)
- **Fulvia** was a **National Geographic Society** member (1995)
- Courtship traced through postcards: David at Sirmione (Jul 1945), David→Fulvia at Genova (Jul 1946), Fulvia→David at Aberdare (Mar/May 1947)

---

## Phase 4 — David John Lewis photos

**Source:** `manual/dump/david-john-lewis-photos/` (552 files, 911 MB)

| Album | Notes |
|-------|-------|
| `david-ia/` (163 files) | Compare against existing `media/docs/david-john-lewis-*` |
| `david-ib/` (26 files) | |
| `david-ii/` (124 files) | |
| `david-iii/` (29 files) | |
| `david-iv/` (76 files) | |
| `david-v/` (80 files) | |
| `david-vi/` (54 files) | |

**Per album:** dedup against existing `media/docs/david-john-lewis-personal/`, select best portraits and life-event photos, file to `media/docs/david-john-lewis-personal/photos/` or `media/images/portraits/`.

---

## Phase 5 — Fulvia pre-marriage photos

**Source:** `manual/dump/fulvia-lewis-photos/pre-marriage-*` (~6 albums)

| Album | Era | Genealogical value |
|-------|-----|-------------------|
| `pre-marriage-zara-album-01/` | 1916–1997 | High — Zerauschek family in Zara/Dalmatia |
| `pre-marriage-zara-album-02/` | 1920–1941 | High — same |
| `pre-marriage-schools/` | 1906–1942 | Medium — Genoa schools, Liana-Fulvia, Guido-Mario |
| `pre-marriage-lukoran/` | 1930–1943 | Medium — Lukoran island life |
| `pre-marriage-viaggi/` | 1925–1947 | Medium — Fiume, Trieste, dated travel photos |
| `pre-marriage-sirmione/` | Various | Medium — Villa Ester / Sirmione |

**Per album:** select key images for Zara line story, Fulvia person page, and context images. File to `media/docs/fulvia-lewis-photos/` or `media/context/`.

---

## Phase 6 — Fulvia Africa albums

**Source:** `manual/dump/fulvia-lewis-photos/africa-album-*` (6 albums)

| Album | Era | Notes |
|-------|-----|-------|
| `africa-album-01/` | 1946–1953 | Includes King Idris, Locust War, Sabratha, Tripoli — partial overlap with `media/docs/david-john-lewis-colonial-service/libya-idris-1949/` |
| `africa-album-02/` | 1952–1955 | Ft. Jameson, Italy visits |
| `africa-album-03/` | 1955–1958 | |
| `africa-album-04/` | 1959–1962 | |
| `africa-album-05/` | 1962–1964 | |
| `africa-album-06/` | 1965–1968 | |

**Per album:** dedup against existing Libya photos in `media/docs/`, select highlights for colonial service story and person pages.

---

## Phase 7 — Fulvia Hove albums + various

**Source:** `manual/dump/fulvia-lewis-photos/hove-album-*` (28 albums) + `various-*` (8 folders) + `big-album-93/` + `nonna-mario-album/`

This is ~5,800 files covering 1968–2000. Lowest genealogical density, highest volume.

**Fast-track subsets:**
- `various-weddings/` — wedding photos with specific dates, link to person pages immediately
- `various-favourites/` — pre-curated selection, scan for portraits worth promoting

**Bulk approach for Hove albums:** process in batches of 5, scanning for milestone events (births, graduations, holidays) and best portraits. Most will stay in `manual/dump/` as a browsable archive rather than being individually filed into `media/docs/`.

---

## Progress tracking

| Phase | Status | Files processed | Date |
|-------|--------|----------------|------|
| 1 — Family tree documents | **Done** | 268 / 268 | 2026-03-27 |
| 2a — Correspondence (priority) | **Done** | 80 / 80 | 2026-03-27 |
| 2b — Correspondence (other family) | Not started | 0 / ~140 | |
| 2c — Correspondence (friends/general) | Not started | 0 / ~90 | |
| 3 — Souvenirs | **Done** | 153 / 153 | 2026-03-27 |
| 4 — DjL photos | Not started | 0 / 552 | |
| 5 — Fulvia pre-marriage | Not started | 0 / ~1,500 | |
| 6 — Fulvia Africa | Not started | 0 / ~2,000 | |
| 7 — Fulvia Hove + various | Not started | 0 / ~5,800 | |
