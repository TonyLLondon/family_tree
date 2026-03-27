# Story-building agent guide

How to produce a scrollytelling story for the family history web app.

## Deliverables per story

| File | Location | Purpose |
|------|----------|---------|
| `<slug>.md` | `stories/` | Vault markdown: `# Title`, then `## Section` headings. Each `##` becomes one scrolly step (full-viewport background image + frosted text card). Sections after `scrollyStepCount` render as plain appendix. `###` subsections render inside the same step card. |
| `<slug>.scrolly.json` | `stories/` | Sidecar: `hero` (title, subtitle, era), `scrollyStepCount`, `steps[]` (one per scrolly `##`, each with `era` + `media: { src, alt, caption? }`). |
| Link from line hub | `topics/<relevant-hub>.md` | Add the story to the **Narratives** table in the correct line hub. Evans stories → `evans-cerpa-perez-london-chile.md`; Persia → `persia.md`; Zara → `zara-italy-dalmatia.md`; Lewis/Stump → `lewis-wales-stump-europe.md`. |

## Process

### 1. Read the evidence

Before writing a single sentence:

- Read the **person page(s)** in `people/` — every `## Life`, `## Evidence`, `## Open questions` section.
- Read any **research memos** in `research/` touching the subject.
- Read the **source cards** in `sources/*.md` and the **corpus extracts** they link to (`sources/corpus/<slug>/extracted.pdf.md`, `transcription*.md`, `translation*.md`, `reference.md`).
- Read the **line hub** section covering this person/arc.
- Open any **media** referenced (images in `media/docs/`, `media/collections/`, `media/albums/`, `media/images/portraits/`).
- **Do not invent.** Every factual claim must trace to a vault source. Flag gaps as open questions in the appendix, not as narrative assertions.

### 2. Outline the arc

Draft the `##` section list. Each section is one visual beat — a moment, a place, a turning point. Aim for 6–10 scrolly sections plus 1–3 appendix sections (`## Evidence`, `## Related`, `## Sources`).

Good section beats:
- A birth or origin scene (place + era context)
- A migration or departure
- A career milestone or crisis
- A war, political event, or upheaval
- A marriage, alliance, or family formation
- A death, exile, or legacy moment

### 3. Gather images

Each scrolly step needs one background image. Three sources, in order of preference:

1. **Family photographs** — `media/docs/`, `media/albums/`, `media/images/portraits/`, `media/collections/`. These are the strongest images because they are real.
2. **Context images** — `media/context/<topic>/`. CC-licensed or public-domain scenes, maps, period art that set the visual atmosphere. Every `media/context/<topic>/` directory **must** include a `CREDITS.md` listing source and licence for every image.
3. **Document scans** — parish registers, gazettes, census pages, correspondence. These work well for "evidence" beats.

**If context images are needed for a new topic**, create the directory `media/context/<topic>/`, source CC0/CC-BY/public-domain images (Wikimedia Commons, Library of Congress, Rijksmuseum, Internet Archive, etc.), save them there, and write the `CREDITS.md`.

Image paths in `steps[].media.src` are **repo-relative** (e.g. `media/docs/Alfred Evans.jpg`). The web app resolves them to `/files/…` URLs.

### 4. Write the narrative markdown

- **Style:** Third-person past tense. Literary non-fiction, not Wikipedia. Quotations from primary sources (letters, memoirs, interviews, registers) are the heart of every section.
- **Length:** Each `##` section: 150–400 words. Long enough to fill a frosted card while a user scrolls; short enough that it doesn't require its own scroll.
- **Links:** Repo-relative from `stories/` (e.g. `../people/x.md`, `../sources/...`).
- **Citations:** Inline links to source cards or corpus bundles. Never footnotes.
- **No invented dialogue.** Quote what exists; contextualise what doesn't.

### 5. Build the scrolly.json

```json
{
  "hero": { "title": "…", "subtitle": "…", "era": "1860 – 1940" },
  "scrollyStepCount": 7,
  "steps": [
    {
      "era": "1860 – 1880",
      "media": {
        "src": "media/context/some-topic/image.jpg",
        "alt": "Accessibility description of the image",
        "caption": "Caption shown bottom-right over the image"
      }
    }
  ]
}
```

- `scrollyStepCount` = number of `##` sections that get scrolly treatment. Remaining `##` sections render as plain article below.
- `steps[]` length must equal `scrollyStepCount`.
- `alt` must describe the image for screen readers.
- `caption` is optional but strongly recommended — it anchors the reader in time and place.

### 6. Link from the hub

Add a row to the **Narratives** table in the correct `topics/*.md` hub.

### 7. Test locally

```bash
cd web && npm run dev
```

Visit `/stories/<slug>` and scroll through every step. The hero should fade out on first step entry. Images should crossfade. Text cards should be readable against every background.

## Quality bar

- Every factual statement traceable to a vault source.
- Every image either a family original or has a `CREDITS.md` entry with licence.
- No speculation presented as fact; open questions in the appendix.
- The story should make a reader who knows nothing about the family care about these people.
