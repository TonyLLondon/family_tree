# Instructions: Complete the Certi Ricordi supplement transcription

## What this project is

"Certi Ricordi" is a handmade family scrapbook created by Nonna (Fulvia Zerauschek, later Lewis). It combines photographs, postcards, letters, and handwritten Italian commentary documenting the Zerauschek-Addobbati family of Zara (Zadar), Dalmatia. The album was digitised as 129 main pages (Nonna000–Nonna128) plus 36 supplement pages (FLSupplMA-001–036). It is presented on the web app as a side-by-side scrapbook: original image on the left, Italian transcription + English translation on the right.

## What is already done

- **All 165 images** are in `media/docs/certi-ricordi/` (main) and `media/docs/certi-ricordi/suppl/` (supplement).
- **`stories/certi-ricordi.md`** has 129 `## Section` headings — one per main-album page (Nonna000–Nonna128). Each section has:
  - A descriptive English title after `##`
  - A prose paragraph describing what the page shows
  - Italian text in `> *blockquote italics*`
  - English translation below
- **`stories/certi-ricordi.scrolly.json`** has 165 entries in its `pages[]` array. The first 129 have accurate `alt` text. The last 36 (supplement) have placeholder `alt` text like `"Certi Ricordi supplement page 1"`.
- **The web component** (`web/components/ScrapbookNarrative.tsx`) pairs `pages[i]` with `sections[i]` — so section 130 in the markdown maps to `pages[129]` (FLSupplMA-001.jpg), etc. The 1:1 alignment is critical.

## What you need to do

### Task 1: Append 36 new `##` sections to `stories/certi-ricordi.md`

Open each supplement image, read it, and append a new `## Section` to the end of the markdown. Follow the exact same format used in the existing 129 sections.

**Format for each section:**

```markdown
---

## [Descriptive English title] — [Short subtitle]

[One or two sentences describing the page: what photos/documents appear, who is in them, what the handwriting says about.]

> *[Italian/dialect text transcribed verbatim, line by line]*

[English translation of the Italian text]
```

**Rules:**
1. **One section per image, in order.** FLSupplMA-001.jpg gets the first new section, FLSupplMA-036.jpg gets the last.
2. **Read the actual image** — do NOT rely on the summary descriptions below. Open each `.jpg` file and transcribe what you see.
3. **Transcribe handwritten Italian/Venetian dialect** faithfully, preserving spelling, punctuation, and line breaks.
4. **Translate into natural English** — not a word-for-word crib, but a readable translation.
5. **Skip purely photographic pages with no text.** If an image is just a photo with no handwriting or printed text, write a short descriptive paragraph only (no blockquote/translation needed). Still give it its own `## Section`.
6. **Do NOT write a script.** Process each image manually, one at a time.
7. **Do NOT invent text.** If handwriting is illegible, write `[illegible]`. If you're unsure, write `[?]` after the word.
8. Some images may need mental rotation — the scan may be sideways or upside down.

### Task 2: Update the 36 supplement `alt` texts in `stories/certi-ricordi.scrolly.json`

For each supplement page, replace the placeholder `alt` text with a short (under 120 chars) description matching what the page actually shows. These start at line ~528 in the JSON file.

**Example — change:**
```json
{
  "image": "media/docs/certi-ricordi/suppl/FLSupplMA-003.jpg",
  "alt": "Certi Ricordi supplement page 3"
}
```
**To something like:**
```json
{
  "image": "media/docs/certi-ricordi/suppl/FLSupplMA-003.jpg",
  "alt": "Sabalich's Guida archeologica di Zara — Addobbati genealogy from 1495 Bergamo to Zara"
}
```

### Task 3 (after Tasks 1–2): Cross-reference into people pages

Some supplement pages contain genealogical facts that should be noted in `people/*.md` files. Key cross-references:

| Supplement page | Content | People page(s) to update |
|---|---|---|
| FLSupplMA-003 | Addobbati genealogy from Sabalich (1495–1745) | `people/d-ioanes-addobbati.md`, `people/d-daniele-addobbati.md`, `people/d-jacobus-addobbati.md`, `people/d-joanes-baptista-addobbati.md`, `people/d-joannes-aloysious-addobbati.md`, `people/simeone-gilberto-addobbati.md`, `people/pietro-paolo-addobbati.md` |
| FLSupplMA-005 | University exam anecdote, Zara patriotism | Could go in `topics/zara-italy-dalmatia.md` |
| FLSupplMA-017–020 | Papa's letters to "Fulle" about grades (1940) | `people/antonio-zerauschek.md` (father), Fulvia's page if it exists |
| FLSupplMA-026–031 | Mamma's 1962 Egypt travel letter | Relevant person page |

Add a line in each relevant person page's Evidence/Sources section like:
```
- [Certi Ricordi supplement](../sources/certi-ricordi-zerauschek-addobbati.md), page [N]: [what it says]
```

## Image-by-image content guide (use as orientation, NOT as transcription source)

These are rough descriptions from a prior pass. **You must re-read each image and transcribe from the original.**

| # | File | Content summary |
|---|---|---|
| 1 | FLSupplMA-001.jpg | **English** handwritten provenance note: explains the supplement exists because these pages weren't in the copy sent to Mario. Original passed to Michael. |
| 2 | FLSupplMA-002.jpg | Italian handwriting: "Quindi: ...per chi non lo sapesse..... ...e sono in Tanti... della nostra generazione, di quella dei nostri figli ...e di quella dei nostri nipoti." (So: for those who didn't know... and there are many... of our generation, of our children's, and of our grandchildren's.) |
| 3 | FLSupplMA-003.jpg | Printed page (p. 503) from G. Sabalich, *Guida archeologica di Zara* — Addobbati genealogy from Bergamo 1495 to Zara. Handwritten attribution at bottom. VERY important genealogical source. |
| 4 | FLSupplMA-004.jpg | Postcard: "Zara – Liceo e Convitto S. Demetrio." Notes about Nonna's expulsion from the English Ladies' College for "insisting on telling the truth," Nonno's pride in the Addobbati name, the building later becoming a Dominican Sisters' elementary school. |
| 5 | FLSupplMA-005.jpg | Ceremony photo in Piazza dell'Erbe, Palazzo Zerauschek roof visible. "I Zaratini erano famosi Italiani." Below: anecdote about a university exam during wartime — professor gave 27 marks because Zaratini are "our best patriots." |
| 6 | FLSupplMA-006.jpg | War memorial in Zara ("Il monumento ai Caduti") — two photos, one with a child. Handwritten note about being 8 or 9 years old, the difficulty of the ledge, and someone telling Papa. |
| 7 | FLSupplMA-007.jpg | Sepia portrait — young woman reclining against ornate folding screen with flowers. No visible text. |
| 8 | FLSupplMA-008.jpg | Construction photos of apartment building in Zara. Notes about Roman walls/aqueducts discovered during excavation. Bottom note from Massimo about original shutters still present after a recent visit. |
| 9 | FLSupplMA-009.jpg | "Calypso" cigarette box — Manifattura Zaratina Sigarette, Società Anonima, Zara (Italia). With original cigarette. Note: "Passed on to Valerie August 05—" |
| 10 | FLSupplMA-010.jpg | Handwritten letter (blue ink) — continuation of a letter from Papà. Mentions "Il Centrale" being open and a great success, Mamma and Liano as best clients. Signed "Ottobre baci, Papà." |
| 11 | FLSupplMA-011.jpg | Three photos: tennis court (captioned as eliminated by communists as "gioco CAPITALISTA"), a small gate/house in Val di Maestro's garden, a group at a sea pool. Notes about skating rink ("campo di pattinaggio") on the right. |
| 12 | FLSupplMA-012.jpg | Three photos of Rive Nuove: two from the Bristol hotel window (Count Giampiero Belgioioso's honeymoon, "Nonno lo aveva soltanto in affitto" — grandfather only rented it), and the Rive Nuove after bombardments (ruins, church tower). |
| 13 | FLSupplMA-013.jpg | "Cavalli e Carozze" — horses and carriages. Three photos: family on horse cart, carriage among trees, group dining outdoors. |
| 14 | FLSupplMA-014.jpg | Two interior photos. Top: "Salotto: Ti ti ga el Tappeto" (Living room: you've got the carpet). Bottom: Christmas tree, "Camera da pranzo. Ben che la nonna iera bassa.... ma che soffitti!!" (Dining room. Though Nonna was short.... but what ceilings!!). |
| 15 | FLSupplMA-015.jpg | Seascape — Lukoran coast. Note about bomb damage from aircraft pursuing a steamship. |
| 16 | FLSupplMA-016.jpg | "Le scuole" — two photos. Note about nearly becoming a cardiologist. Caption about Nonno: fishing instead of school at 7, fled to Trieste at 16, millionaire at 30, "un vuoto di cultura — montecassino un faro di civiltà." |
| 17 | FLSupplMA-017.jpg | **Letter from Papà to "Fulle"** — scolding for poor grades, threat of boarding school, dialect note about not going fishing. Zara, May/June 1940. |
| 18 | FLSupplMA-018.jpg | Continuation of Papà's letter — threat to pull from school and put to work, brothers Mario and Guido doing well. |
| 19 | FLSupplMA-019.jpg | Another letter from Papà (March 1940) — incredulous about "44 out of 100" in math, emphasizes math and Italian are essential. |
| 20 | FLSupplMA-020.jpg | Continuation — reassurance, mentions cold weather, Easter plans uncertain. Also contains reflections on grandmother's reaction to university desire (slaps). |
| 21 | FLSupplMA-021.jpg | Colour postcard — building or waterfront scene. May have no significant text. |
| 22 | FLSupplMA-022.jpg | "Reale Collegio di Moncalieri" — photo and newspaper clipping about the college. |
| 23 | FLSupplMA-023.jpg | "Caserma Umberto I" — printed material with cavalry officer image. |
| 24 | FLSupplMA-024.jpg | Two photos: Nonno fishing in a boat, and a note: "Nonno era bravo nella fotografia. A 67 anni di età è ancora un maestro. Saper pescare e fotografare non è sufficiente. Bisogna saper raccontare." |
| 25 | FLSupplMA-025.jpg | Photo of a man in uniform. Handwritten letter about taking things philosophically. |
| 26 | FLSupplMA-026.jpg | Typewritten letter dated 27 May 1962 from "Mamma" to "Cara Fulle" — describing a journey (Egypt), temples, obelisks, palaces. |
| 27 | FLSupplMA-027.jpg | Continuation — Abu Simbel temples, Nile trip/cruise. |
| 28 | FLSupplMA-028.jpg | Continuation — Aswan, the new dam ("imposing but you cannot photograph it"). |
| 29 | FLSupplMA-029.jpg | Continuation — plans for next leg, possibly Red Sea. |
| 30 | FLSupplMA-030.jpg | Continuation — everyday details, health, promises of more news. |
| 31 | FLSupplMA-031.jpg | Continuation — reflections on "la storia millenaria," signed "Mamma." |
| 32 | FLSupplMA-032.jpg | Sepia group photo — children and adults outdoors, possibly family event. |
| 33 | FLSupplMA-033.jpg | Formal group of men in military/official attire. |
| 34 | FLSupplMA-034.jpg | Landscape — coastline with buildings. |
| 35 | FLSupplMA-035.jpg | Handwritten Italian reflection on people and family connections. |
| 36 | FLSupplMA-036.jpg | Final page — reflection on surviving through changing times, adapting to new places. |

## File locations

| File | Path |
|---|---|
| Story markdown (append to end) | `stories/certi-ricordi.md` |
| Scrolly JSON (update alt texts at bottom of pages array) | `stories/certi-ricordi.scrolly.json` |
| Supplement images | `media/docs/certi-ricordi/suppl/FLSupplMA-001.jpg` through `FLSupplMA-036.jpg` |
| Corpus reference (optional: add supplement entries) | `sources/corpus/certi-ricordi-zerauschek-addobbati/reference.md` |
| Source card | `sources/certi-ricordi-zerauschek-addobbati.md` |

## Verification

After completing all 36 sections:
1. Count `## ` headings in `stories/certi-ricordi.md` — should be **165** (129 + 36).
2. Count `"image"` entries in `stories/certi-ricordi.scrolly.json` — should be **165**.
3. No `alt` text should still say "Certi Ricordi supplement page N".
4. Run `cd web && npm run build` to confirm no build errors.

## Approach

Process in batches of 6 images. For each batch:
1. Read all 6 images.
2. Write the 6 `##` sections and append them to the markdown in one edit.
3. Update the 6 `alt` texts in the JSON in one edit.
4. Move to the next batch.

Do NOT re-read images you have already transcribed. Do NOT loop back to re-examine. Write and move forward.
