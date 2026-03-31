---
name: enhance-old-records
description: >-
  Enhance legibility of photographed or scanned historical records (civil
  registrations, parish registers, census pages, old manuscripts). Use when
  the user asks to improve contrast, make an old document more readable, or
  enhance a genealogical record image. Requires Pillow.
---

# Enhance Old Record Images

Improve legibility of faded ink on old paper without destroying the image.

## Core Principle

**Darken the ink, leave the paper alone.** Never use generic auto-contrast or
gamma < 1 — both blow out the paper tones and make faded handwriting worse.

## Workflow

### 1. Always work on a copy

```python
import shutil
shutil.copy2(src_path, enhanced_path)
```

Never overwrite the original. Use suffix `-enhanced` (e.g.
`1902-birth-chanco-enhanced.jpg`).

### 2. Analyse the histogram

```python
from PIL import Image

img = Image.open(src_path)
if img.mode != 'L':
    gray = img.convert('L')
else:
    gray = img

hist = gray.histogram()
total = sum(hist)

cumulative = 0
percentiles = {}
for target in [5, 25, 50, 75, 95]:
    while cumulative / total < target / 100:
        percentiles[target] = len(percentiles)  # placeholder
        cumulative += hist[len(percentiles) - 1]
    percentiles[target] = len([h for i, h in enumerate(hist)
                               if sum(hist[:i+1]) / total <= target / 100])

dark = sum(hist[:100]) / total
mid = sum(hist[100:180]) / total
light = sum(hist[180:]) / total
```

Print the percentiles and dark/mid/light split. This tells you where the ink
and paper sit:

| Zone | Typical values | What it is |
|------|---------------|------------|
| 0–60 | Very dark | Book binding, edges, deep shadows |
| 100–140 | Dark-mid | Printed form lines, column headers |
| 150–190 | **The problem zone** | Faded handwritten ink |
| 195–220 | Light | Paper |

### 3. Apply a piecewise linear curve

Build control points that **crush the ink zone down** while **pushing paper
up**. The steep ramp between ~195 and ~210 is what separates ink from paper.

```python
from PIL import ImageFilter

# Default control points — adjust based on histogram analysis
points = [
    (0,   0),     # black stays black
    (60,  15),    # binding/edges slightly compressed
    (130, 55),    # printed form lines stay clearly dark
    (175, 90),    # faded ink mid-point pulled WAY down
    (195, 140),   # darkest paper edge
    (210, 230),   # paper pushed bright — steep ramp here is the key
    (230, 248),   # bright paper stays bright
    (255, 255),   # white stays white
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
img = img.point(lut)
```

### 4. Light sharpening (optional)

```python
img = img.filter(ImageFilter.UnsharpMask(radius=1.5, percent=60, threshold=4))
```

Keep it gentle — radius 1.5, percent 60, threshold 4. Heavy sharpening
amplifies grain and paper texture.

### 5. Save and verify

```python
img.save(enhanced_path, quality=92)
```

Read the enhanced image back and compare with the original. Crop individual
entries if the page has multiple records — a 2000px-wide two-page spread makes
each entry too small to read.

## Tuning the Curve

Adjust control points based on the histogram analysis:

- **Very faded ink (most pixels 170–200):** Pull the (175, 90) point lower,
  e.g. (175, 70). Steepen the ramp at 195–210.
- **Dark ink but grey paper:** Raise the (210, 230) point, e.g. (200, 240).
  The ink is already dark enough — focus on whitening the paper.
- **Colour image:** Convert to LAB, apply the curve to the L channel only,
  then convert back. This preserves any colour in stamps or annotations.
- **High-contrast original:** The curve may over-darken. Soften by raising
  the mid-points: (130, 80), (175, 120).

## What NOT to Do

- `ImageOps.autocontrast` — stretches the full range, blows out paper
- Gamma < 1 (`t ** 0.4`) — lifts mid-tones, makes faded ink lighter
- `ImageEnhance.Contrast(img).enhance(1.6)` — symmetric, brightens lights
  as much as it darkens darks
- Modifying the original file

## Batch Processing

```python
import glob

for src in glob.glob('media/docs/chile-chanco/*.jpg'):
    if '-enhanced' in src:
        continue
    dst = src.replace('.jpg', '-enhanced.jpg')
    # apply curve + sharpen + save
```
