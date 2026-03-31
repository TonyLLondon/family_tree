# The Lewis Line — site

Next.js App Router app that statically renders the vault: Markdown (with repo-relative links rewritten), structured tree vitals (`family-tree.json` at repo root), ancestor fan chart, and file serving for `media/` and corpus bundles copied at build time (not the local `archive/` inbox).

## Commands

```bash
cd web
npm install
npm run dev
```

Production build:

```bash
npm run build
npm start
```

## Layout

| Route | Source |
|-------|--------|
| `/` | `../index.md` |
| `/people`, `/people/[slug]` | `../people/*.md` |
| `/stories/[slug]` | `../stories/*.md` |
| `/topics` | `../topics/index.md` · `/topics/[slug]` other topic files |
| `/sources`, `/sources/...` | `../sources/**/*.md` (excluding `corpus/`) |
| `/corpus`, `/corpus/[slug]` | Corpus bundle file listings + links via `/files/...` |
| `/vault/research/...`, `/vault/manual/...` | `../research/**`, `../manual/**` |
| `/chart` | Fan chart from structured tree data at `../family-tree.json` (root **I1**) |
| `/files/...` | Prebuild copy: `media/`, `sources/corpus/`, structured tree file → static CDN on Vercel; local dev reads from repo via route |

## Photos

Edit **`photo-map.json`** in this folder:

```json
{
  "I1": "media/docs/Young man black shirt arms crossed purple studio portrait.jpg"
}
```

Paths are **relative to the repository root** (parent of `web/`). Missing files are ignored.

## Vercel

Create a project with **Root Directory** `web` (the Git repo root stays the `family_tree` folder so `..` resolves to the vault during `next build`). Use the default Next.js framework preset; no extra `vercel.json` is required.
