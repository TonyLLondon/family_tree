# Master source list (inventory)

One map of **where evidence lives** in this vault. Per-topic shopping lists live under [wishlist/](wishlist/).

## Ingested corpus

Bundles under `sources/corpus/<slug>/` — provenance (`source.yaml`), extracts (`extracted.pdf.md` / `extracted.web.md`), optional mirrors. **Authoritative slug table:** [corpus/README.md](corpus/README.md). **Alphabetical / themed index (one link per slug):** [corpus-bibliography.md](corpus-bibliography.md) — regenerate with `scripts/generate_corpus_bibliography.py`.

## Citation cards

Thin topical cards in **`sources/*.md`** (work- or site-oriented filenames). Line hubs (`lines/*.md`) and [topics/index.md](../topics/index.md) also aggregate links.

**Cluster hubs** (many `corpus/<slug>/` on one page): [nypl-burgess-corpus-cluster.md](nypl-burgess-corpus-cluster.md), [lewis-white-roche-ireland-corpus-cluster.md](lewis-white-roche-ireland-corpus-cluster.md), [missions-bahai-babi-corpus-cluster.md](missions-bahai-babi-corpus-cluster.md), [persia-modern-scholarship-corpus-cluster.md](persia-modern-scholarship-corpus-cluster.md), [baltic-erbe-stump-corpus-cluster.md](baltic-erbe-stump-corpus-cluster.md), [wright-burials-persia-corpus.md](wright-burials-persia-corpus.md).

## Manual / working extracts

Working translations alongside corpus bundles: e.g. Beytoote article — [annotated English](../sources/corpus/beytoote-stump-dentist-atabak-ahmadshah/translation.en.md) (lives under `corpus/…/` with the web capture).

## Structured tree and people

| Asset | Role |
|-------|------|
| [family-tree.json](../family-tree.json) | Canonical structured tree (web app); schema 2 — sync from vault via [../scripts/sync_family_tree_json.py](../scripts/sync_family_tree_json.py) (GEDCOM optional gap-fill) |
| [people/](../people/) | Person pages → sources, corpus, media |

## Media and archive

| Asset | Role |
|-------|------|
| [media/](../media/) | Scans, albums, PDFs — layout in [index.md](../index.md) |
| [archive/](../archive/) | GEDCOM, exports, non-canonical bundles — [archive/index.md](../archive/index.md) |

## Wishlist (sources to obtain)

Planned purchases, free URLs to mine, archive leads: **[wishlist/README.md](wishlist/README.md)**.
