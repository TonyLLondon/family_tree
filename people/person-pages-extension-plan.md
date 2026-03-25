# Plan — extending `people/*.md`

This complements **[ancestor-coverage-list.md](ancestor-coverage-list.md)** (strict **parents-only** path from `@I1@`). Here we define **who gets a page**, **how deep to write**, and **where the evidence already lives**.

---

## Scope tiers

| Tier | Who | Policy |
|------|-----|--------|
| **A — Ancestors** | Everyone on [ancestor-coverage-list.md](ancestor-coverage-list.md) | Eventually one `people/` file each; depth follows evidence (see phases below). |
| **B — Priority collateral** | **Tamar Saginian** · **Dr. William Cormick** | Explicitly **keep** full articles; not on strict ancestor list but central to Persia narrative and sources. |
| **C — Siblings & significant others** | Full/half siblings of ancestors; spouses not on strict list when they anchor a branch or story | Add a page when (1) they appear in **`family-tree.json`** with unions, **and** (2) you have **either** narrative + sources **or** **named media** (cert, photo, article). Skip endless “name-only” GEDCOM individuals until something attaches. |
| **D — Descendants (recent)** | Children of `@I1@`, siblings of `@I1@`, nieces/nephews | Optional; useful for living privacy boundaries — use **`family-tree.json`** as the list; write only where you want a public biography. |

**Authoritative structure:** **`family-tree.json`** (571 people, unions, edges). Use GEDCOM / ancestor list for import history; prefer **JSON `id`** (`I3`, …) in YAML on new pages when it matches.

---

## Standard page shape (every biography)

Use the same skeleton so pages feel like one wiki:

1. **YAML frontmatter** — `name`, `gedcom` or `treeId: I…`, dates/places if known, `sex`, `generation` or `era`, optional `spouses:` as slugs.
2. **Opening paragraph** — One tight summary (who, when, why they matter in *your* story).
3. **Life** — Chronological bullets; mark uncertain items `(est.)`.
4. **Family** — Links to `people/…` + short note on non-documented children.
5. **Evidence** — Bullet list: `media/…` paths, `sources/…`, `sources/corpus/…`, `topics/…`.
6. **Open questions** — Empty section is fine; remove when nothing left.

---

## Phase 1 — **Expand** existing pages (richest return)

These files exist but stay thin. You already have citations or files to weave in.

| Person | Why expand now | Pull in |
|--------|----------------|--------|
| [edward-burgess.md](edward-burgess.md) | NYPL + narrative | Longer career arc; *Bokhara* quotes from [media/docs/](../media/docs/) (`Edward Burgess Paragraph…`, `Narrative of a mission…` PDF); link [topics/nypl-burgess-papers-archive.md](../topics/nypl-burgess-papers-archive.md). |
| [anna-saginian.md](anna-saginian.md) | Interview + NYPL | Expand marriage 1851, Armenian identity, Fanny as infant; [connectionsbmc](../sources/connectionsbmc-saginian-interview.md); [obrien-roche-notes](../sources/obrien-roche-notes.md). |
| [daoud-khan-saginian.md](daoud-khan-saginian.md) | Military narrative | 1834 Isfahan; same sources as Anna; optional *Bokhara* Daoud paragraph image. |
| [fanny-burgess.md](fanny-burgess.md) | Grave + NYPL + photos | Embed grave scan; Henderson Teheran 1896; electoral register PNG in `media/docs/`. |
| [julien-bottin.md](julien-bottin.md) | Contract + Masonry | Pull French contract clauses into blockquotes; [corpus levantine PDF](../sources/corpus/levantine-freemasonry/) excerpts. |
| [henriette-bottin.md](henriette-bottin.md) | Passport + album | Narrative of Tehran birth / travel; link Stump marriage; Henderson tree discrepancies (if any) in one footnote-style note. |
| [etienne-stump.md](etienne-stump.md) | Iranica + Mustawfi + grave | Longer “dentistry in Iran” section; blockquote Iranica; Mahmoudieh email summary expanded. |
| [antonio-zerauschek.md](antonio-zerauschek.md) · [antonio-zerauschek-senior.md](antonio-zerauschek-senior.md) | Zara narrative + scans | Line hub [lines/zara-italy-dalmatia.md](../lines/zara-italy-dalmatia.md); [stories/zerauschek-zadar.md](../stories/zerauschek-zadar.md); `media/collections/zerauschek/` + Difesa obit JPEG in `media/docs/`. |
| **[tamar-saginian.md](tamar-saginian.md)** (Tier B) | Priority collateral | Same interview as Anna; court role; relationship to Cormick household. |
| **[william-cormick.md](william-cormick.md)** (Tier B) | Priority collateral | Wikipedia + corpus if ingested; PDFs under [media/publications/persia-iran/](../media/publications/persia-iran/) (Cormick / Báb / *Medical Times*); tie to royal physician narrative. |

**Goal:** Each of the above should reach **~1–2 screens** of prose plus **3–6 evidence links** minimum.

---

## Phase 2 — **Create** pages with **strong local evidence**

New files; you can draft from `family-tree.json` + scans already in **`media/docs/`** or **`media/albums/henderson/`**.

| Target file (suggested) | Tree id (JSON) | Evidence to lead with |
|-------------------------|----------------|------------------------|
| `anthony-robert-lewis.md` | `I1` | `family-tree.json`; birth Macclesfield; spouse/children from unions — keep living details minimal if preferred. |
| `ivor-anthony-samuel-lewis.md` | `I2` | GEDCOM notes; Florence birth; link to David + Fulvia. |
| `catherine-stump.md` | `I3` | Mother of `@I1@`; link Robert Stump, Gerald White line; Surrey birth registration in JSON if present. |
| `david-john-lewis.md` | `I8` | Major, Merthyr, Sirmione burial; MyHeritage URL in GEDCOM text; Welsh census refs. |
| `fulvia-ottilia-antonia-zerauschek.md` | `I9` | Italian civil line; link both Antonios; `media/collections/zerauschek/`. |
| `maureen-catherine-finbarr-white.md` | `I10` | Irish line; Roche/O’Shea; narrative role in Henderson chart. |
| `robert-marc-murard-stump.md` | `I11` | Tehran children; link Étienne; photos in Henderson / `media/docs/` (Stump, Robert). |
| `gerald-sebastian-white.md` | `I12` | Obit scans in `media/docs/`; Times clipping; probate images. |
| `mary-oshea.md` | `I13` | **Strong:** Ireland birth cert scan; census NAI jpgs; May O’Shea nursing photo. |
| `cornelius-oshea.md` | `I118` | Portrait + census household links. |
| `catherine-enright.md` | `I119` | Monkstown census; marriage/birth chain. |
| `charles-bottin.md` | `I138` | Julien’s father — Ancestry Nice birth screenshot already linked from Julien page; expand. |
| `josephine-baudouin.md` | `I139` | Same Ancestry flow; mother of Julien. |
| `marc-francois-stump.md` | `I140` | Swiss / Stump patriline; link Hans Jacob STUMP chain from ancestor list. |
| `henry-burgess.md` | `I81` | Henderson chart vitals; Groby / Wakefield line; link Edward + Frances Ridsdale. |
| `frances-ridsdale.md` | `I82` | Mother of Edward; Ridsdale genealogy PDFs in `media/docs/` if named. |
| `catherine-mary-roche.md` | `I136` | Roche / Limerick mirrors + `obrien-roche-notes`; Limerick Chronicle PDFs in `media/docs/`. |
| `william-roche.md` | `I137` | Same cluster. |
| `archibald-percy-coolbear.md` | `I103` | **Very strong:** dozens of RAF/medal scans in `media/docs/`; medal index cards. |

**Goal:** First draft = **YAML + 2–4 paragraphs + Evidence section with real paths** (no placeholder “TBD”).

---

## Phase 3 — **Siblings & other unions** (Tier C)

Use **`family-tree.json`** (`unions` / `people`) to list siblings of people in Phase 1–2. Prioritize:

- **Burgess siblings** of Edward (Charles H, Joseph, George, Mary, etc. on Henderson chart) — create only when you add a source or image.
- **Stump siblings** of Robert (Theo, Irene, Jacques, Jean in Henderson) — link from `robert-marc-murard-stump.md` first; separate pages when you have obits or photos.
- **Zal Saginian** (`family-tree.json`) — if same as “Zal” in interview notes, one short page + source link.
- **Spouses** of Lewis/Stump lines appearing in JSON with marriage events — page when census or civil registration exists in `media/docs/`.

---

## Phase 4 — **Long tail** (ancestors with GEDCOM name only)

Remaining rows in [ancestor-coverage-list.md](ancestor-coverage-list.md) (Italian parish stacks, Swiss Stump depth, Braithwaite/Lawson, etc.):

- **Stub rule:** YAML + 2 sentences + `treeId` + link to parents’ pages + “Evidence: GEDCOM only — pending.”
- **Promotion:** When you add a parish image, mirror HTML, or publication cite, expand to Phase 2 standard.

---

## Suggested order of work (sprints)

1. **Persia collateral polish:** Tamar + William (Tier B) + Anna + Daoud + Edward (one coherent “Saginian–Burgess” pass).
2. **Tony’s parents:** `I2`, `I3`, then `I8`–`I11` (Lewis–Stump–White core).
3. **Ireland:** Mary O’Shea → Cornelius → Catherine Enright → Roche pair (documents already in `media/docs/`).
4. **Italy:** Fulvia → Giuseppe/Biagio chain as scans get matched to IDs.
5. **Coolbear / Evans / Lewis Wales:** pick one descendant branch in JSON and follow media filenames.

---

## Maintenance

- After bulk edits to **`family-tree.json`**, re-run `python scripts/generate_ancestor_coverage_list.py` and reconcile any renamed `people/` stems.
- When you ingest a new PDF for someone, add **`sources/corpus/<slug>/`** and link from their person page **Evidence** section.

---

## Related files

- [ancestor-coverage-list.md](ancestor-coverage-list.md) — strict ancestor enumeration  
- [../family-tree.json](../family-tree.json) — full graph  
- [../index.md](../index.md) — media layout map  
