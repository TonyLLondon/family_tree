---
name: chilean-civil-records
description: >-
  Navigate Chilean civil registry records on FamilySearch for the Cerpa/Pérez
  family line. Use when searching Chilean births, marriages, deaths, downloading
  FamilySearch images via DGS locators, enhancing scanned register pages, or
  reading handwritten index entries from Chanco or other Maule-region
  circunscripciones.
---

# Chilean Civil Records on FamilySearch

## Authentication

FamilySearch requires a bearer token extracted from a logged-in browser session.
**Never use environment variables** — the token is pasted inline in each script.

```
Token source: familysearch.org → DevTools → Network → any XHR →
  copy "Authorization: Bearer <token>" value (after "Bearer ").
```

Tokens expire every ~30 minutes. When a 401 is returned, ask Tony to refresh
the token from the browser.

## Key API endpoints

| Endpoint | Purpose |
|----------|---------|
| `CATALOG_SEARCH_URL` = `familysearch.org/service/search/catalog/v3/search` | Search the catalog by surname, place, subject |
| `RECORDS_SEARCH_URL` = `familysearch.org/service/search/hr/v2/personas` | Search indexed historical records (GedcomX) |
| `DEEPZOOM_URL` = `sg30p0.familysearch.org/service/records/storage/deepzoomcloud/dz/v1` | Download images by DGS locator or ARK |
| `WAYPOINT_URL` = `familysearch.org/platform/records/waypoints` | Navigate film structure (waypoints → children) |

All requests require headers:

```python
headers = {
    "Authorization": f"Bearer {TOKEN}",
    "User-Agent": "<Chrome UA string>",
    "Accept": "application/json",  # or "image/jpeg" for images
    "Referer": "https://www.familysearch.org/",
    "Accept-Language": "en",
}
```

## Rate limiting

FamilySearch uses Imperva WAF. Aggressive requests trigger 403 blocks.

| Context | Minimum delay |
|---------|---------------|
| API queries (catalog, records) | 1.5 s between requests |
| Image downloads | 2.0 s between requests |
| After 403/429 | 30 s backoff, max 3 retries |

Always use `time.sleep` between requests. For bulk downloads, randomize
request order to avoid sequential-scan detection.

## DGS locators

DGS (Digital Genealogical System) numbers identify microfilm groups.
Each page within a DGS has a predictable locator:

```
dgs:{DGS_NUMBER}.{DGS_NUMBER}_{PAGE:05d}
```

Example for DGS 004702560, page 42:

```
dgs:004702560.004702560_00042
```

To download an image at a given width:

```
GET {DEEPZOOM_URL}/{locator}/scale?width=3000
Accept: image/jpeg
```

The total page count for a DGS is NOT returned by the API. Determine it
by binary search: request increasing page numbers until you get a 404.

## Existing scripts

| Script | Purpose |
|--------|---------|
| `scripts/fs_search.py` | CLI for catalog search, records search, image browse/fetch, film listing. See docstring for subcommands. |
| `scripts/download_chanco_index.py` | Bulk download of Chanco index film (DGS 004702560, 714 pages). Randomized order, resume-capable. |

## Chilean civil registry structure

Chilean civil registration began **1885**. Records are organised by
**circunscripción** (registration district, typically a town). Each
circunscripción maintains separate books for:

- **Nacimientos** (births)
- **Matrimonios** (marriages)
- **Defunciones** (deaths)

Each book is numbered sequentially per year. A large circunscripción may have
two or more volumes per year (noted as "vol 1", "vol 2" in indexes).

### Index format

Civil registry indexes are handwritten ledgers, typically one book per letter
of the alphabet, covering a span of years. Entries are structured:

```
Paternal-Surname [Maternal-Surname], Given-Name(s), Entry-Number, [Volume]
```

Example: `Cerpa González, Manuel Antonio, 65, 1` means:
- Paternal surname: **Cerpa**
- Maternal surname: **González**
- Given name(s): **Manuel Antonio**
- Entry 65 in the birth register
- Volume 1

Entries are grouped **alphabetically by paternal surname**, then within each
letter section, grouped **by year in reverse chronological order** (most
recent year first). Within a year, entries are in rough alphabetical order
by paternal surname.

### Naming conventions

Registered names often differ from use names. The family may know someone by
a completely different first name:

| Registered | Known as |
|------------|----------|
| Manuel Antonio Cerpa González | Miguel Luis Cerpa González |

When searching indexes, look for the **paternal surname + maternal surname**
pair, not the given name. A "Cerpa González" entry is far more diagnostic
than matching a first name.

Some entries omit the maternal surname — the indexer sometimes wrote only
the paternal surname. These entries are ambiguous when multiple Cerpa families
exist in the same district.

## Chanco index (DGS 004702560)

This is the master **combined index** for the Circunscripción de Chanco,
Maule. It covers births, marriages, and deaths on a single film, organized
by letter and record type. The film has **714 pages** total.

### Film structure

The film interleaves record types. Each letter section appears in this order:
births first, then marriages, then deaths (approximately — the exact page
ranges vary by letter).

For **letter C births**, the index is split across two physical albums:

| Album | Film pages | Internal pages | Years covered |
|-------|-----------|----------------|---------------|
| Album 1 | 5–8 | 5–10 | ~1928 → 1922 |
| Album 2 | 518–522 | 9–17+ | 1918 → 1905 |

**Gap: years 1919–1921 are missing** from the C births section. Other letters
(J, D) cover these years without gaps on single pages, so this is specific to
the C section's higher volume of entries. The missing years may be in a third
physical book that was not filmed or is on pages not yet identified.

For **letter C marriages**: pages ~360–370 area.

For **letter C deaths**: pages ~480–490 area.

### Known Cerpa González births found

| Given name | Entry | Vol | Year | Film page | Notes |
|------------|-------|-----|------|-----------|-------|
| Manuel Antonio | 65 | 1 | 1912 | 520 | = Miguel in family |
| Juana de Dios | 82 | 1 | 1912 | 520 | Previously unknown |
| Ramón de la Rosa | 198 | 2 | 1917 | 518 | Previously unknown |

### Known Cerpa González marriage

| Groom | Bride | Entry | Year | Film page |
|-------|-------|-------|------|-----------|
| Francisco Cerpa | Ana Delia González | 59 | 1909 | ~365 |

### Bare "Cerpa" entries (no maternal surname — possibly González)

| Given name | Entry | Vol | Year | Film page |
|------------|-------|-----|------|-----------|
| Francisco | 119 | 1 | 1917 | 518 |
| Juana María | 93 | 1 | ~1915 | 519 |
| Homero del Carmen | 195 | 1 | ~1915 | 519 |

### Other Cerpa branches in Chanco (not González)

Cerpa Sánchez, Cerpa Arcan, Cerpa Alvear, Cerpa Garrido, Cerpa Orellana —
these have different maternal surnames and belong to other Chanco Cerpa
families (see [reference.md](reference.md) for full list).

## Image enhancement for scanned registers

Scanned microfilm images have faded ink on yellowed paper. Standard
autocontrast makes things worse (brightens paper, washes out ink).

Use a **piecewise linear tone curve** that darkens mid-tones without
blowing out highlights:

```python
from PIL import Image, ImageFilter

points = [
    (0, 0), (60, 15), (130, 55), (175, 90),
    (195, 140), (210, 230), (230, 248), (255, 255),
]

def interp(x, pts):
    for i in range(len(pts) - 1):
        x0, y0 = pts[i]
        x1, y1 = pts[i + 1]
        if x0 <= x <= x1:
            t = (x - x0) / (x1 - x0) if x1 != x0 else 0
            return int(y0 + t * (y1 - y0))
    return pts[-1][1]

lut = [interp(i, points) for i in range(256)]

img = Image.open("page.jpg")
img = img.point(lut)
img = img.filter(ImageFilter.UnsharpMask(radius=1.5, percent=60, threshold=4))
img.save("page-enhanced.jpg", quality=95)
```

Key principle: **darken the ink, don't lighten the paper**. The tone curve
above compresses the light grays (paper) into a narrow bright band while
stretching the dark range (ink) for better contrast.

Always save enhanced copies alongside originals (`page-NNNN-enhanced.jpg`),
never overwrite. Crop specific entries for close reading
(`page-NNNN-cerpa-crop.jpg`).

## Workflow for searching a new circunscripción

1. **Find the catalog entry** — `fs_search.py catalog --place "Chanco" --subject "Civil registration"` or browse the FamilySearch catalog.

2. **Identify the DGS number** — from the catalog or film listing. Use `fs_search.py films <catalog_id>` to list available films/DGS numbers.

3. **Determine page count** — binary search: try page 500 (200→ if 404, 700→ if 200, etc.) until you bracket the last valid page.

4. **Download images** — adapt `download_chanco_index.py` for the new DGS. Use randomised order, 2 s delays, resume-capable (skip existing files >1 KB).

5. **Identify the letter section** — sample pages at intervals (every ~50 pages) to find where each letter begins. Birth/marriage/death sections interleave.

6. **Read the index** — enhance pages with the tone curve, crop specific entries. Index entries are reverse-chronological within each letter section.

7. **Record findings** — update `people/*.md` files and `family-tree.json`. Save evidence crops with descriptive filenames. Run `sync_family_tree_json.py`.

## File layout for downloaded images

```
media/docs/chile-{town}/{record-type}-index/
  page-0001.jpg          # original download
  page-0001-enhanced.jpg # tone-curve + unsharp mask
  page-0001-cerpa-crop.jpg # cropped detail for evidence
```

Example: `media/docs/chile-chanco/index-nacimientos-1885-1932/`

## Additional resources

- Full list of all Cerpa entries found: [reference.md](reference.md)
- FamilySearch catalog for Chanco: catalog ID via `fs_search.py catalog --place Chanco`
- Chilean civil registration overview: records begin 1885, maintained by Servicio de Registro Civil e Identificación
