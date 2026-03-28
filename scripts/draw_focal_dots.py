#!/usr/bin/env python3
"""
Draw a bright dot on each portrait image at the current focal-point coordinates
from web/photo-map.json, and save the annotated copies to a temp directory for
visual inspection.

Usage:
    .venv/bin/python scripts/draw_focal_dots.py [--out DIR]
"""

import json
import os
import sys
import argparse
from pathlib import Path
from PIL import Image, ImageDraw

REPO = Path(__file__).resolve().parent.parent
PHOTO_MAP = REPO / "web" / "photo-map.json"
DEFAULT_OUT = REPO / "tmp" / "focal-check"

DOT_RADIUS = 18
DOT_COLOR = (255, 0, 0)           # red fill
OUTLINE_COLOR = (255, 255, 255)   # white ring for contrast
OUTLINE_WIDTH = 4


def draw_focal_dot(img: Image.Image, focal_x: float, focal_y: float) -> Image.Image:
    """Return a copy of *img* with a dot drawn at the normalised focal coords."""
    out = img.copy().convert("RGB")
    draw = ImageDraw.Draw(out)
    px = focal_x * out.width
    py = focal_y * out.height
    r = DOT_RADIUS
    bbox = [px - r, py - r, px + r, py + r]
    draw.ellipse(bbox, fill=DOT_COLOR, outline=OUTLINE_COLOR, width=OUTLINE_WIDTH)
    # crosshair lines for precision
    arm = r + 8
    draw.line([(px - arm, py), (px + arm, py)], fill=OUTLINE_COLOR, width=2)
    draw.line([(px, py - arm), (px, py + arm)], fill=OUTLINE_COLOR, width=2)
    return out


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = parser.parse_args()

    with open(PHOTO_MAP) as f:
        photo_map: dict = json.load(f)

    out_dir: Path = args.out
    out_dir.mkdir(parents=True, exist_ok=True)

    processed = 0
    for person_id, entry in sorted(photo_map.items()):
        if entry is None:
            continue
        if isinstance(entry, str):
            src = entry
            focal = [0.5, 0.5]
            zoom = 1.0
        else:
            src = entry["src"]
            focal = entry.get("focal", [0.5, 0.5])
            zoom = entry.get("zoom", 1.0)

        img_path = REPO / src
        if not img_path.exists():
            print(f"  SKIP {person_id}: {src} not found", file=sys.stderr)
            continue

        try:
            img = Image.open(img_path)
        except Exception as e:
            print(f"  SKIP {person_id}: cannot open {src}: {e}", file=sys.stderr)
            continue

        annotated = draw_focal_dot(img, focal[0], focal[1])

        safe_name = src.replace("/", "__")
        out_name = f"{person_id}__{safe_name}"
        if not out_name.lower().endswith((".jpg", ".jpeg", ".png")):
            out_name += ".jpg"
        out_path = out_dir / out_name
        annotated.save(out_path, quality=85)
        processed += 1
        print(f"  {person_id}: focal={focal} zoom={zoom} → {out_path.name}")

    print(f"\n✓ {processed} annotated images saved to {out_dir}")


if __name__ == "__main__":
    main()
