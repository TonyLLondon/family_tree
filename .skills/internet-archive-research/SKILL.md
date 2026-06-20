---
name: internet-archive-research
description: >-
  Search Internet Archive full-text OCR, catalog metadata, and Wayback web
  history via mcpbundles CLI; download PDFs and page excerpts into the vault.
  Use when researching genealogy on archive.org, searching inside scanned books,
  finding historical newspapers, pulling IA PDFs, or checking Wayback snapshots
  of old websites.
---

# Internet Archive & Wayback research (CLI)

Genealogy desk research on **Internet Archive** (books, newspapers, gazettes) and
**Wayback Machine** (archived web pages). Uses the **`internet-archive`** MCP
server through **`mcpbundles call`**.

Generic MCPBundles CLI mechanics: see [mcpbundles-cli](../mcpbundles-cli/SKILL.md).

Bundle domain reference (refresh after CLI upgrades):

```bash
mcpbundles call get_skill -- server_slug=internet-archive
```

## Which surface to use

| Goal | Tool | Server |
|------|------|--------|
| Phrase inside scanned books/PDFs (OCR) | `archive-fulltext-search-015` | `internet-archive` |
| Find items by title, creator, collection | `archive-metadata-search-015` | `internet-archive` |
| File list + size for one item | `archive-get-item-015` | `internet-archive` |
| Page hits inside one known identifier | `archive-search-inside-015` | `internet-archive` |
| Was a **URL** archived? Closest snapshot | `get-wayback-available-015` | `internet-archive` |
| All captures for a URL | `wayback-cdx-search-015` / `wayback-timemap-015` | `internet-archive` |
| Archived HTML content | `wayback-get-content-015` | `internet-archive` |

**Do not confuse:**

- **Metadata search** — matches title, creator, collection fields; not words on page 282.
- **Full-text search** — matches OCR inside volumes; best for names in newspapers/books.
- **Wayback** — live-web URLs over time; not the same as IA book OCR.

## Operational rules (learned on this repo)

1. **One search at a time** — run queries sequentially (~3–90 s each). Batch loops and
   parallel background calls fail or time out.
2. **Scope with `identifier:`** when you know the item — e.g.
   `identifier:sabalichguidaarcheologicadizara AND Addobbati`.
3. **Wildcards often return 0** — avoid `identifier:Piccolo_*`, `identifier:Guida_TS*`.
4. **`archive-search-inside-015` is flaky** (HTTP 522 on large items). Prefer
   full-text search for discovery; use PyMuPDF on a downloaded PDF for precise pages.
5. **Garbled OCR** — try alternate scripts (e.g. Cyrillic for Russian genealogy
   volumes), or download the **text PDF** and search the text layer locally.
6. **Large newspapers** — prefer **page PNG + excerpt PDF** over ingesting multi‑hundred‑MB
   full issues unless the whole issue is needed.

## Full-text search (primary genealogy workflow)

```bash
mcpbundles call archive-fulltext-search-015 --server internet-archive -- \
  query="Zerauschek Zara" size:=10
```

Parse hits with a short Python filter (keeps terminal readable):

```bash
mcpbundles call archive-fulltext-search-015 --server internet-archive -- \
  query="Daoud Khan Seguinoff Tabriz" size:=10 2>&1 | python3 -c "
import sys, json
d = json.loads(sys.stdin.read())
print('TOTAL:', d.get('total', 0))
for h in d.get('hits', [])[:8]:
    yr = h.get('year')
    ident = h.get('identifier')
    pg = h.get('page_num')
    hl = (h.get('highlight') or '').replace(chr(10), ' ')[:280]
    print(f'  [{yr}] {ident} p.{pg}')
    print(f'    {hl}')
"
```

Hit fields to record:

| Field | Use |
|-------|-----|
| `identifier` | IA item id → download URL, corpus `source.yaml` |
| `page_num` | OCR page index; verify against PDF after download |
| `highlight` | Snippet with `{{{term}}}` markers — triage only, not evidence |
| `year` | Often from item metadata; may be null |

### Query tactics for family history

| Pattern | Example |
|---------|---------|
| Scoped book | `identifier:proche-orient-chretien_1972_22 AND Saginian` |
| Person + place | `O'Byrne White Madras` |
| Newspaper run | `Il Piccolo Zerauschek` then narrow by identifier from hits |
| Parish / place | `Llanfairarybryn Morgan` |
| Avoid noise | Add place or institution; bare surnames return thousands |

Worked examples by cluster: [reference.md](reference.md).

## Metadata search (find the item first)

When you need the **identifier** before full-text scoping:

```bash
mcpbundles call archive-metadata-search-015 --server internet-archive -- \
  query='title:(Guida Trieste) AND year:1925' rows:=10
```

Use Lucene-style fields: `title:`, `creator:`, `collection:`, `mediatype:texts`,
`identifier:`, `year:`.

## Item metadata and PDF URLs

After you have an `identifier`, list files and sizes:

```bash
mcpbundles call archive-get-item-015 --server internet-archive -- \
  identifier=proche-orient-chretien_1972_22
```

Standard download URLs (try in order):

```text
https://archive.org/download/{identifier}/{identifier}.pdf
https://archive.org/download/{identifier}/{identifier}_text.pdf   # text layer (common for Guida)
```

Download with curl (repo pattern):

```bash
curl -fsSL -o /tmp/item.pdf \
  "https://archive.org/download/proche-orient-chretien_1972_22/proche-orient-chretien_1972_22.pdf"
```

Human viewer (page deep-link when `page_num` known):

```text
https://archive.org/details/{identifier}/page/{n}/mode/1up
```

## PDF → page image / excerpt (vault)

Repo helper: `scripts/ia_zerauschek_ingest_batch.py` — download + PyMuPDF page find + PNG.

Minimal pattern for a new hit:

```python
import fitz  # pymupdf — repo .venv has it

doc = fitz.open("item.pdf")
needle = "Zerauschek"
for i in range(doc.page_count):
    if needle.lower() in doc.load_page(i).get_text("text").lower():
        page = doc.load_page(i)
        pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
        pix.save("page.png")
        break
```

For multi-page excerpts (trade directories), save a small PDF with `insert_pdf` over a
`page_range` instead of the full volume.

**Storage layout** (this repo):

```text
media/docs/internet-archive/{topic}/     # PDFs, PNGs, excerpt PDFs
sources/corpus/{slug}/                   # reference.md, transcription, source.yaml
sources/{slug}.md                        # thin citation card
```

`source.yaml` uses `files.media_reference` pointing at `media/...` — corpus does not
duplicate bytes. See `AGENTS.md` corpus bundle section.

After new bundles: `.venv/bin/python scripts/generate_corpus_bibliography.py`

## Wayback (web history)

Check if a URL was captured:

```bash
mcpbundles call get-wayback-available-015 --server internet-archive -- \
  url="https://www.familysearch.org/en/search/"
```

CDX search (authoritative when availability is empty):

```bash
mcpbundles call wayback-cdx-search-015 --server internet-archive -- \
  url="https://example.com/path" match_type="prefix" limit:=20
```

Retrieve archived HTML:

```bash
mcpbundles call wayback-get-content-015 --server internet-archive -- \
  url="https://example.com/" timestamp="20200101120000" mode="raw"
```

Wayback is for **websites**, not scanned books. Use IA full-text for books/newspapers.

## End-to-end workflow

```
1. Full-text or metadata search (one query)
2. Triage hits → note identifier + page_num + highlight
3. archive-get-item-015 → confirm PDF filename and size
4. curl download → media/docs/internet-archive/{topic}/
5. PyMuPDF → PNG and/or excerpt PDF for cited pages
6. Hand transcription → sources/corpus/{slug}/transcription*.md
7. Thin card sources/{slug}.md + links from people/topics/stories
8. Regenerate corpus bibliography
```

**Read before writing prose** — OCR highlights are triage, not evidence. Transcribe
from PNG/PDF facsimile.

## When NOT to use IA CLI

| Situation | Instead |
|-----------|---------|
| FamilySearch records | `scripts/fs_search.py` — see [chilean-civil-records](../chilean-civil-records/SKILL.md) |
| PDF already in `media/` or corpus | Read existing bundle |
| TNA / FO file numbers from an index line | Order file at Kew; IA index is the pointer only |
| Borrow-only IA items | Note in wishlist; may need manual capture |

## Additional resources

- Family-cluster query log and hit notes: [reference.md](reference.md)
- Existing IA intake folders: `media/docs/internet-archive/zerauschek/`, `.../saginian/`
- Batch download script: `scripts/ia_zerauschek_ingest_batch.py`
