# Edward Burgess ↔ Tehran Gazette — crosswalk

How Edward’s **own words** (Burgess Persian Letters) map onto **this facsimile** and what to hunt for in the lithographed run. The gazette rarely names him; the letters are the biography of his editorial work.

## Edward on the job (primary — already in vault)

| Date | Letter | What it tells you | Corpus |
|------|--------|-------------------|--------|
| **22 Apr 1851** | To George | Appointed **editor** when gazette started; **no extra pay**; **issue 1 = 5 Feb 1851**; **400 tomans** (~£180); ~**40 pages Persian/month** of European news for King + PM; **whole management** on his shoulders; **Mirza Hussein Quli** (British mission) criticised his **Persian style** in an article — Edward rebutted | [Burgess letters p.115](../burgess-persian-letters-full-volume/transcription.md) |
| **16 Jun 1851** | To George | Moved publication **Friday → Thursday**; threat to printer **Hadji Abdul Muhammad** (*paper out by 12 o’clock or I complain to Govt*); printer **best in Persia** but slow | same |
| **19 Feb 1852** | To Henry | **“Government Gazette managed by me”**; caution on **foreign news** (England/Russia/Turkey); **Amir-i-Nizam** already **late** PM | same |
| **22 Jun 1852** | To George | Summer at **Niavaran** — edits gazette near PM/Shah; **printing still in Tehran** | same |
| **22 Sep 1852** | To George | **Peak autonomy under Amir Kabir** (“act according to your own judgment”); after fall: **only foreign news** without PM pre-check; **premature general’s appointment** published → near disaster for Edward | same |
| **21 Feb 1854** | To George | King ordered him to **publish cotton cultivation** (American mission seed) **in the paper** | same |
| **8 Nov 1854** | Archbishop to Edward | Asks Edward for **extra copies** of issues with **court notifications** about Armenian affairs | same |
| **26 Feb 1855** | To Henry | **Leave to England** — not secure until **published in the Gazette**; PM’s joke about paying Burgess “for sitting in his house” | same |

Secondary corroboration: [London *Evening Standard*, Dec 1853](../1853-london-evening-standard-persia-burgess-gazette/transcription.md) — **fever** → substitute editor; [Lady Sheil](../lady-sheil-glimpses-persia-ch13/extracted.web.md) — unnamed Englishman, **confidential bulletin**.

## What in *this* PDF is “Edward’s product”

| Gazette content | Edward’s role | Example in vol. 1 facsimile |
|-----------------|---------------|-----------------------------|
| **اخبار خارجه — انگلیس** (foreign news — England) | Translation/summary from European papers | [PDF p.19](pages-png/p019.png) — London/India shipping, British policy |
| **احوال متفرقه** | Often foreign curiosities / misc. | [PDF p.21](pages-png/p021.png) — e.g. California gold report (1851) |
| **Domestic appointments / ashraf** | Usually PM/Shah line; Edward **published** what ministers sent | Search issues **~Sep 1852** for **premature general** (letter above) |
| **Official notifications** (اشتهارنامه) | Edward as pipeline to press | Archbishop **1854** wanted copies — not yet located in bundle |
| **Masthead / founding decree** | Edward managed production; **text credits Shah**, not editor | [PDF p.17](pages-png/p017.png) issue **1** |

## Named in the volume (not in lithograph)

| PDF p. | Text |
|--------|------|
| **14** | NLIR preface: **«برجیس صاحب، مترجم روزنامه»** — [snippets](transcription.snippets.fa.md) |

## Named in lithograph (NLIR vol. 2)

| Issue / date / PDF | Text |
|--------------------|------|
| **156** / **≈ 26 Jan 1854 CE** · [scrolly](../../../stories/burgess-gazette-khilat.md) (masthead **Thu 28 Rabīʿ II 1270**; **25** issues after **131**) / [vol. 2 pp. 185–186](../tehran-gazette-nlir1373-vol02/burgess-p186-royal-reward.md) | Court notice: **برجیس صاحب، مباشر روزنامه و مترجم دیوان** — stayed in capital during **ناخوشی و وبا** (same **1853–early 1854** season as issue **131**, Aug 1853), kept gazette running; **خلعت** (Kashmiri shawl). **After** [Oct 1853 fever](../1853-london-evening-standard-persia-burgess-gazette/transcription.md), not a separate epidemic year. Fa + En: [burgess-p186-royal-reward.md](../tehran-gazette-nlir1373-vol02/burgess-p186-royal-reward.md) · [masthead](../tehran-gazette-nlir1373-vol02/pages-png/p185-masthead.png) · [reward page](../tehran-gazette-nlir1373-vol02/pages-png/p186.png). **Secondary:** Etemad al-Saltanah *Montaẓam* **p. 1756** / *Morāʾat al-Bildān* **p. 1179** — same titles + **میرزا عبد‌الله** in **خلعت همایون** list ([chronicle excerpts](../etemad-saltanah-chronicles-burgess-khilat/reference.md)). |
| **~219** / **≈ Mar 1855 CE** · [scrolly](../../../stories/burgess-gazette-khilat.md) (**63** issues after **156**) / [vol. 2 p. 581](../tehran-gazette-nlir1373-vol02/burgess-p581-sick-leave.md) | **اذن مریض** — **برجیس صاحب**, **مترجم** + **مباشر روزنامه**; physicians prescribe **change of climate**; **father and relatives** petition; **sent to England / London** by royal command. Matches letter **26 Feb 1855** (*leave not secure until published in the Gazette*). Fa + En: [burgess-p581-sick-leave.md](../tehran-gazette-nlir1373-vol02/burgess-p581-sick-leave.md) · [p. 581](../tehran-gazette-nlir1373-vol02/pages-png/p581.png) · [masthead spread p. 580](../tehran-gazette-nlir1373-vol02/pages-png/p580-masthead.png). |

## Search checklist (Marker lithograph + snippets)

Grep lithograph transcriptions as they land (`scripts/grep_tehran_gazette_marker.py` → [transcription.marker-lithograph.md](transcription.marker-lithograph.md)). Surya `_ocr_index/` is optional page-finder only (`scripts/grep_tehran_gazette_ocr.py`):

- **Names:** `برجیس`, `برجيس`, `Burgess`, `Edward`
- **Roles:** `مترجم`, `مباشر`, `محرر`, `سردبیر`
- **Printer:** `عبد`, `چاپ`, `حاجی`
- **Leave / illness (1853–55):** `اجازه`, `مریض`, `تب`
- **Issue map:** `نمره` on mastheads → build page ↔ issue table

**Priority issues to align with letters:** **1** (start), **~3** (classic “Shah’s fortune” weather prose), **~41** (Amir Kabir end), **late 1853** (Standard fever episode), **early 1855** (leave in gazette).

## Leave, illness, death — will the gazette write about him?

| Expectation | Evidence so far |
|-------------|-----------------|
| **Leave to England (Feb 1855)** | Edward: not secure until **published in the Gazette** ([letter 26 Feb 1855](../../burgess-persian-letters-full-volume/transcription.md)). **Found:** [issue ~219, vol. 2 p. 581](../tehran-gazette-nlir1373-vol02/burgess-p581-sick-leave.md) — **اذن مریض** to **England / London**. |
| **Illness (late 1853)** | London press: substitute editor while **Mr. Burgess** had **fever** — [1853 Standard](../../1853-london-evening-standard-persia-burgess-gazette/transcription.md). May appear as routine news **without** naming him. |
| **Death (12 Jun 1855, Tabriz)** | **No obituary found yet** in vol. 1 preface or early issues. Qajar state papers rarely eulogise foreign staff; **Anna** and **letters** are primary for death. Still grep full run for **برجیس**, **وفات**, **مرگ**, **تسلیت**. |
| **Named as staff** | NLIR **1373 preface p.4** only (modern typeset), not 1850s columns. |

IA bundle mapping: [INVENTORY.md](../../../media/docs/internet-archive/tehran-gazette/INVENTORY.md) — `vagaye-2` opens **~issue 70**; **1855** material probably **not** in vol. 1 PDF.

## Coverage gap

This PDF is **issues 1–130** only (**200** scan pages). Edward’s **Feb–Jun 1855** window likely sits in **issues 131+** — mapped after **fleet OCR** (`tehran-gazette-full-ocr-fleet.yaml`, **3,448** pages) greps `_ocr_index/` on all nine PDFs.
