# Internet Archive — family-tree query reference

Working log of queries run on this vault. Add rows when new clusters are searched.

## Query results (representative)

### Persia / Saginian / Cormick

| Query | Total | Best hit |
|-------|-------|----------|
| `Gaushupongar` | 2 | `portfolio00unkngoog` p.659 OCR — Charles Burgess *Brief Notice* (PDF leaf **370**); ingested → `portfolio-1836-burgess-brief-notice-persia-villiers/` |
| `identifier:portfolio00unkngoog AND Burgess` | 1 | Same — heading *THE LATE T. H. VILLIERS, ESQ. BY C. H. BURGESS* |
| `identifier:englishamongstpe0000wrig AND Burgess` | 1 | Wright p.266 — Charles son of London banker; Edward hostage on Charles's account |
| `Daoud Khan Seguinoff Tabriz` | 1 | `proche-orient-chretien_1972_22` p.404 — Daoud Khan Saginian / Séguinoff |
| `Saginian Cormick` | 33 | `index-to-the-correspondence-of-the-foreign-office_1929_4_s-z` — FO index line K13255/138255/234 |
| `Armenian Saginian Tabriz` | 32 | Mostly generic; *Proche-Orient* already ingested |
| `Mustawfi Persia` | 4291 | Geography noise (Lest's *Lands of Eastern Caesar*) |
| `Stump Persia Tehran` | 33506 | Noise |
| `Mahmoudieh house Tehran` | 0 | Not indexed |
| `Villiers trade northern provinces Persia` | 0 | May be image-only on IA |

### Ireland / India — White / Roche

| Query | Total | Best hit |
|-------|-------|----------|
| `O'Byrne White Madras` | 9 | Army Lists, 1870 London Gazette promotion |
| `Army Medical Department India half pay` | 75 | AMD regulations, Indian List volumes |
| `Irish catholics army medical India` | 0 | Exact phrase not indexed |

### Wales — Lewis / Morgan

| Query | Total | Best hit |
|-------|-------|----------|
| `William Morgan Llanfairarybryn` | 40 | Rowland *Historical Notes* 1866 — Nantybai deed list |
| `Briton Ferry Lewis` | 239 | Mixed; *Archaeologia Cambrensis* 1898 vicarage mention |
| `Llanfairarybryn` | 356 | Parish admin, Quakers of Pembrokeshire |

### Zara / Addobbati / Zerauschek

| Query | Total | Best hit |
|-------|-------|----------|
| `identifier:sabalichguidaarcheologicadizara AND Addobbati` | 1 | p.562 — Vincenzo Addobbati pedigree (duplicate of vault pp.503–509) |
| `Addobbati Zara` | 3311 | Sabalich + *Il Piccolo* 1923 Francesco Addobbati |
| `identifier:Guida_TS-1935 AND Zerauschek` | (scoped) | Ausonia / directory entries — see zerauschek corpus |

### Essex / London

| Query | Total | Best hit |
|-------|-------|----------|
| `Coolbear Maldon Essex` | 55 | London Gazette 1918 — Florence Ada Coolbear |
| `Newcomb Tolleshunt Knights` | 1066 | Poll books / hearth tax — place names only |
| `Evans Clerkenwell Holy Redeemer` | 50 | Architecture books — not Alfred Evans family |

### Chile / France / Switzerland

| Query | Total | Best hit |
|-------|-------|----------|
| `Perez Parral Maule Chile` | 13041 | Modern politics — not Cerpa line |
| `Cerpa Chile` / `Chanco matrimonio` | high noise | Peru MRTA false positives |
| `Bottin Lyon genealogy` | 4925 | Publisher atlases — not René Bottin family |
| `Erbe Stump Thurgau` | 3683 | Swiss place-name noise |

## High-value identifiers already ingested

| Identifier | Topic | Vault |
|------------|-------|-------|
| `portfolio00unkngoog` | Charles Burgess *Brief Notice* in *The Portfolio* (1836) | `sources/corpus/portfolio-1836-burgess-brief-notice-persia-villiers/` |
| `proche-orient-chretien_1972_22` | Daoud Khan / Anna | `sources/corpus/proche-orient-chretien-1972-daoud-khan-saginian-seguinoff/` |
| `Piccolo_1973-03-03` | Antonio Zerauschek obit | `sources/corpus/piccolo-1973-03-03-antonio-zerauschek-obituary/` |
| `Guida_TS-1925` | Zerauschek Fratelli | `sources/corpus/guida-trieste-1925-zerauschek-fratelli-excerpt/` |
| `sabalichguidaarcheologicadizara` | Addobbati pp.503–509 | `sources/corpus/sabalich-guida-zara/` (JPG scans; full PDF on IA) |
| `4-1998_202212` | Saginov princes (Cyrillic) | `sources/corpus/dumin-1998-georgian-princes-saginov/` |

## Shelved leads (not yet ingested)

- FO index **K13255** — Saginian / Cormick (TNA file, not IA content)
- *Il Piccolo* obits Aldo 1992, Tatiana 1998
- Sabalich full PDF on IA (vault has pp.503–509 JPGs only)
- Guida Trieste years 1932–1939, 1942, 1947 (Ausonia continuity)

## Failed / unreliable patterns

| Pattern | Result |
|---------|--------|
| `identifier:Piccolo_*` | 0 hits |
| `identifier:Guida_TS*` | 0 hits |
| `identifier:*Gazzetta*` | 0 hits |
| `Difesa Adriatica` | Not on IA |
| Batch 8–25 queries in a loop | Timeouts / empty |
| `archive-search-inside-015` on large PDFs | HTTP 522 |

## Next queries to try (one at a time)

```text
identifier:index-to-the-correspondence-of-the-foreign-office AND Cormick
Nantybai Llanfairarybryn Morgan
Florence Ada Coolbear
Cerpa Chanco
Perez Chanco matrimonio
```
