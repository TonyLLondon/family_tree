# Corpus bundles (`sources/corpus/<slug>/`)

Each folder is one **ingested source**: provenance in `source.yaml`, plus whatever readable layers exist (**`transcription*.md`**, **`translation*.md`**, **`reference.md`**, **`extracted.pdf.md`**, **`extracted.web.md`**). **Machine extracts** are starting points; **human transcriptions and translations** are what you usually cite from when building **`people/`** and **`stories/`**. **Local PDFs** stay under `media/` only (`files.media_reference`); **`original.pdf`** appears only for **remote** PDF ingests (`--url`). **Full slug index (regenerate):** [../corpus-bibliography.md](../corpus-bibliography.md) · `scripts/generate_corpus_bibliography.py`.

| Slug | Kind | Notes |
|------|------|--------|
| `bottin-contract` | PDF | Ministry of War contract — Julien Bottin; + `transcription-translation.en.md` |
| `estonian-biographical-center-stump-family-resear-856c90185e` | PDF | Estonian Biographical Center — Stump family Tallinn research report 2005-09-01 |
| `wright-burials-british-in-persia` | PDF | Sir Denis Wright — main burials volume |
| `wright-burials-british-in-persia-further-notes` | PDF | Wright — further notes |
| `william-cormick-connections` | PDF | Cormick — *Connections* article |
| `william-cormick-monograph-pdf` | PDF | `William Cormick.pdf` (short piece) |
| `cormick-man-who-met-bab-connections` | PDF | *Báb* article, part 1 (*Connections*) |
| `cormick-man-who-met-bab-connections-2` | PDF | *Báb* article, part 2 |
| `narrative-mission-bokhara` | PDF | *Narrative of a mission to Bokhara* (large book) |
| `medical-times-gazette-1878-vol2-july-december` | PDF | *Medical Times and Gazette* vol. 2 Jul–Dec 1878 (very large) |
| `nypl-burgess-appendix-anna-interview` | PDF | NYPL bulletin appendix — Anna / Daoud Khan |
| `nypl-burgess-bulletin-pdf` | PDF | Henderson NYPL bulletin PDF |
| `charles-burgess-portrait-nypl-context` | PDF | Charles Burgess portrait (sibling context) |
| `levantine-freemasonry` | PDF | Levantine Heritage Freemasonry volume (remote fetch) |
| `connectionsbmc-saginian-interview` | Web | WordPress mirror + extract |
| `nypl-archives-mss-431-curl-mirror` | Web | NYPL archives mss/431 — curl Incapsula challenge shell only (not finding aid) |
| `en-wikipedia-william-cormick-curl-mirrors` | Web | Wikipedia (en) William Cormick — REST v1 + desktop HTML + trafilatura extract |
| `obrien-roche-url-offline-captures` | Web | O’Brien/Roche link list — fifteen numbered `curl` HTML captures + `reference.md` |
| `retrozadar-povijest-kavana-u-zadru` | Web | Retrozadar — *Povijest kavana u Zadru* (full HTML mirror + extract) |
| `slobodna-dalmacija-kavane-zadar-dio-2-curl-mirror` | Web | Slobodna Dalmacija part 2 — curl Cloudflare challenge shell only |
| `beytoote-stump-dentist-atabak-ahmadshah` | Web | Beytoote.com — Dr. Stump (Ashtump), dentist of Atabak & Ahmad Shah (Persian) |
| `iranica-dentistry-article` | Web | Encyclopaedia Iranica — DENTISTRY; names Stump alongside Melczarski |
| `addobbati-simeone-oesta-kriegsarchiv-excerpts` | PNG + MD | KA/ÖStA typescript excerpts, 1926 Zara letter, 1968 reply, grave — images in `media/docs/addobbati-simeone-gilberto/` |
| `oesta-kuk-generale-1816-1918` | PDF | ÖStA list k.k./k.u.k. Generale 1816–1918 (remote) |
| `hazu-dizbi-nin-nobles-list-1817` | PDF | HAZU DIZBI — Nin nobles list 1817 (register scan) |
| `oesta-ka-personenforschung-merkblatt-1868-1918` | PDF | ÖStA/KA — Personenforschung Merkblatt 1868–1918 |
| `oesta-kriegsarchiv-genealogie-2014` | PDF | ÖStA — Genealogie im Kriegsarchiv leaflet (2014) |
| `dazd-hr-dazd-497-petricioli-family` | PDF | DAZD HR-DAZD-497 Petricioli — analytical inventory |
| `dazd-hr-dazd-355-filippi-family` | PDF | DAZD HR-DAZD-355 Filippi — analytical inventory |
| `viella-urban-elites-download` | PDF | Viella — urban-elites.pdf (remote) |
| `hvtg-kirchgemeinden-pfarrbuecher-thurgau` | PDF | HVTG — Kirchgemeinden und Pfarrbücher Thurgau |
| `polito-iris-adaptive-cities-volume-completo` | PDF | Polito IRIS — *Adaptive cities* (large scan; see bundle `extracted.pdf.md` for extract status) |
| `hungaricana-militar-almanach-1887-pp471-472` | PDF | Hungaricana export — Militär-Almanach 1887 pp. 471–472 (`media/docs/hungaricana-schematismus/`) |
| `hungaricana-kriegsmarine-schematismus-1909-pp169-172` | PDF | Hungaricana export — KriegsMarine 1909 pp. 169–172 (`media/docs/hungaricana-schematismus/`) |
| `granic-nin-noble-list-1817` | PDF | Granić — Nin noble list 1817 (HAZU article PDF) |
| `celic-zadarsko-plemstvo-francuska-uprava` | PDF | Celić — Zara nobility/citizens French period |
| `societa-dalmata-storia-patria-2017` | PDF | Società Dalmata / Talpo *Per l'Italia* (dalmatitaliani.org) |
| `dazd-addobbati-family-fonds` | PDF | DAZD HR-DAZD-342 Addobbati inventory |
| `arhinet-hr-dazd-12-opcina-nin` | MD | ARHiNET catalog entry Općina Nin HR-DAZD-12 (`reference.md`; run `ingest_source.py web` on URL when host resolves) |
| `dazd-obavijesna-pomagala-index` | Web | DAZD obavijesna pomagala (finding aids index) — mirror + extract |
| `hazu-hrcak-anzulovic-priticevic-nin-noble-family` | PDF | Anzulović (2009) — Nin noble family Pritičević; Hrčak full text |
| `dazd-notaries-zadar` | PDF | DAZD HR-DAZD-31 notaries inventory |
| `dalbello-consular-italiani-spalato` | PDF | Dalbello — Italian consular presence Split |
| `venetian-cittadini-originari-ch3` | PDF | Ca' Foscari — *cittadini originari* ch. 3 |
| `bbld-erbe-hermann-eberhard-gnd1203190484` | Web | BBLD — Hermann Eberhard Erbe |
| `bbld-erbe-eugen-edmund-eduard-gnd1173663347` | Web | BBLD — Eugen Edmund Eduard Erbe |
| `bbld-landesen-carl-v-gnd1229738681` | Web | BBLD — Carl v. Landesen |
| `bbld-erbe-eugen-karl-eberhard-gnd1213595010` | Web | BBLD — Eugen Karl Eberhard Erbe |
| `de-wikipedia-eugen-edmund-erbe` | Web | Wikipedia (de) Eugen — REST HTML mirror; reader URL in `source.yaml` |
| `en-wikipedia-eugen-edmund-eduard-erbe` | Web | Wikipedia (en) Eugen |
| `et-wikipedia-eugen-erbe-syndik` | Web | Wikipedia (et) Eugen Erbe |
| `et-wikipedia-carl-friedrich-landesen` | Web | Wikipedia (et) Carl Friedrich Landesen |
| `deutsche-biographie-hermann-erbe-gnd1203190484` | Web | Deutsche Biographie index — Hermann Erbe |
| `eadb-erbe-hermann-memorial-65373` | Web | EADB memorial DB entry (Hermann cluster) |
| `austria-wiki-eugen-edmund-erbe` | Web | AustriaWiki — Eugen Edmund Erbe |
| `thomas-erbe-deutsches-geschlechterbuch-erbe-index` | Web | Thomas Erbe — *DGB* Erbe index transcript |
| `difesa-adriatica-1973-antonio-zerauschek-obituary` | JPEG + MD | *Difesa Adriatica* clipping — Antonio Zerauschek obituary (1973); `transcription-*.it.md` + `translation-*.en.md`; scan in `media/docs/` |
| `digar-revalsche-zeitung-1894-10-15-olga-stump-notice-static` | PDF + JPEG + MD | DIGAR — *Revalsche Zeitung* 15 Oct 1894; **Olga Stump geb. Erbe** *Familien-Nachrichten* `transcription-*.de.md` + `translation-*.en.md` |
| `digar-revalsche-zeitung-1908-01-23-nr19-static` | PDF + JPEG + MD | DIGAR — *Revalsche Zeitung* nr. 19, 23 Jan 1908; **Eugen Erbe** obituary `transcription-*.de.md` + `translation-*.en.md` |
| `digar-revalsche-zeitung-1908-01-23-nr19-reader` | Web | DIGAR reader shell for same issue |
| `raee-fotis-eugen-erbe-portrait-record` | Web | RA.EE Fotis — Eugen Erbe portrait record (HTML viewer) |
| `wikidata-eugen-erbe-q12362430` | JSON | Wikidata entity dump Q12362430 |

**Ingest:** `.venv/bin/python scripts/ingest_source.py` — see [AGENTS.md](../../AGENTS.md). **Batch:** `.venv/bin/python scripts/batch_pdf_extract.py` + [pdf-ingest-manifest.yaml](pdf-ingest-manifest.yaml); huge PDFs: [pdf-ingest-manifest-heavy.yaml](pdf-ingest-manifest-heavy.yaml). Example list: [manifest.example.yaml](manifest.example.yaml). **All `media/` PDFs:** `scripts/ingest_all_media_pdfs.py` — by default an **easy tier** (skips charts, bulk NYPL `…/1/`–`9/` scans, files **>12 MiB**); `--all` for everything. Skips paths already in corpus. **Roadmap:** [CONVERSION-PLAN.md](CONVERSION-PLAN.md).
