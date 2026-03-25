#!/usr/bin/env python3
"""
One-shot geocoding of every unique place string in family-tree.json.

Reads birthPlace, deathPlace, burialPlace from family-tree.json, geocodes each
unique string via OpenStreetMap Nominatim (free, 1 req/sec), and writes
web/place-geo.json — a static lookup checked into the repo.

Usage:
    .venv/bin/python scripts/geocode_places.py [--force]

    --force   Re-geocode even if web/place-geo.json already exists
              (existing manual overrides are preserved).
"""

import argparse
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
TREE_PATH = REPO_ROOT / "family-tree.json"
OUT_PATH = REPO_ROOT / "web" / "place-geo.json"

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
USER_AGENT = "family-tree-geocoder/1.0 (private genealogy project)"
RATE_LIMIT_SEC = 1.1

NON_PLACE_RE = re.compile(r"^(before|after|about)\s", re.IGNORECASE)

MANUAL_OVERRIDES: dict[str, dict] = {
    "Zara, Dalmatia": {"lat": 44.1194, "lng": 15.2314},
    "Reval": {"lat": 59.4370, "lng": 24.7536},
    "Reval (Tallinn), Harjumaa": {"lat": 59.4370, "lng": 24.7536},
    "Talinn, Estonia": {"lat": 59.4370, "lng": 24.7536},
    "Kirbla Parish, Lääne County, Estonia": {"lat": 58.7833, "lng": 23.7500},
    "Kirrefer, Livland, Estonia": {"lat": 58.4667, "lng": 25.5833},
    "Clerkenwell, Holborn, London & Middlesex, England, London, Middlesex": {
        "lat": 51.5246, "lng": -0.1050,
    },
    "Hammersmith, Fulham, London & Middlesex, England, London, Middlesex": {
        "lat": 51.4927, "lng": -0.2248,
    },
    "St Andrew's, Middlesex, England, United Kingdom": {
        "lat": 51.5246, "lng": -0.1050,
    },
    "Haggers, Estonia": {"lat": 59.2833, "lng": 24.8500},
    "Fellin, Estonia": {"lat": 58.3597, "lng": 25.5900},
    "Leal, Estonia": {"lat": 58.7441, "lng": 23.4147},
    "Parnu, Estonia": {"lat": 58.3859, "lng": 24.4971},
    # Nominatim failures — manually resolved
    "Ballynastra, Ireland": {"lat": 52.1800, "lng": -7.5000},
    "Bicester, Oxfordshire, England, Great Britain": {"lat": 51.9003, "lng": -1.1517},
    "Burneshead, Westmorland, England": {"lat": 54.3400, "lng": -2.7600},
    "Cattaro, Dalmatia": {"lat": 42.4247, "lng": 18.7712},
    "Cattaro, Dalmatia, Austria": {"lat": 42.4247, "lng": 18.7712},
    "Charterhouse St Thomas, Middlesex, England, United Kingdom": {
        "lat": 51.5230, "lng": -0.0990,
    },
    "Curwarragher, County Cork, Ireland": {"lat": 51.8500, "lng": -8.5500},
    "East Sheen Cemetery, London SW14": {"lat": 51.4600, "lng": -0.2700},
    "Great Honeyborough, Essex": {"lat": 51.7000, "lng": 0.7000},
    "Haiba'scher Krug, Haggers, Livland, Estonia": {"lat": 59.2833, "lng": 24.8500},
    "Hailston, Westmorland, England": {"lat": 54.3600, "lng": -2.7500},
    "Hailweston, Hunts, England": {"lat": 52.2400, "lng": -0.2900},
    "Kirbla kirikumõis (Pastorat Kirrefer), Kirbla Parish, Lääne County, Estonia": {
        "lat": 58.7833, "lng": 23.7500,
    },
    "Kirkenewton, Fowberry, Northumberland, England": {"lat": 55.5700, "lng": -2.0900},
    "Kirrefer": {"lat": 58.7833, "lng": 23.7500},
    "Moyvanine and Clounties, Limerick, Ireland": {"lat": 52.5000, "lng": -8.7500},
    "Orest Head, Westmorland, England": {"lat": 54.3700, "lng": -2.9100},
    "Pernau, Kreis Pernau, Livland, Russiches": {"lat": 58.3859, "lng": 24.4971},
    "Stevington, Bedfordshire, England, Great Britain": {"lat": 52.1689, "lng": -0.5554},
    "Surrey North Eastern, Surrey, England": {"lat": 51.3500, "lng": -0.1500},
    "Tehran Protestant Cemetery": {"lat": 35.7060, "lng": 51.4230},
    "Tolleshunt Knight, Essex, England": {"lat": 51.7941, "lng": 0.7911},
    "Võnnu Parish, Tartu County, Estonia": {"lat": 58.2200, "lng": 26.9700},
    # Lived places — historical names that Nominatim won't resolve
    "Fort Jameson, Northern Rhodesia": {"lat": -13.6391, "lng": 32.6458},
    "Chinsali, Northern Rhodesia": {"lat": -10.5563, "lng": 32.0817},
    "Livingstone, Northern Rhodesia": {"lat": -17.8419, "lng": 25.8544},
    "Ndola, Northern Rhodesia": {"lat": -12.9587, "lng": 28.6366},
    "Sirmione, Lake Garda, Italy": {"lat": 45.4688, "lng": 10.6078},
    # Nominatim misidentifications — wrong country
    "Georgia": {"lat": 41.7151, "lng": 44.8271},
    "UK": {"lat": 54.0000, "lng": -2.0000},
    "Brighton, Sussex": {"lat": 50.8229, "lng": -0.1363},
    "Leal": {"lat": 58.6846, "lng": 23.8324},
    "Pago, Zara, Dalmatia, Austria": {"lat": 44.4400, "lng": 15.0500},
    "Maesyffynnon, Aberaman, Glamorganshire, Wales": {"lat": 51.7139, "lng": -3.4300},
    "Richmond, Surrey, England": {"lat": 51.4613, "lng": -0.3037},
}

SEARCH_REWRITES: dict[str, str] = {
    "Zara, Dalmatia": "Zadar, Croatia",
    "Reval": "Tallinn, Estonia",
    "England": "England, United Kingdom",
    "Ireland": "Ireland",
    "France": "France",
    "Chile": "Chile",
    "Talinn, Estonia": "Tallinn, Estonia",
}


def extract_unique_places(tree: dict) -> set[str]:
    places: set[str] = set()
    for person in tree["people"].values():
        for key in ("birthPlace", "deathPlace", "burialPlace"):
            val = (person.get(key) or "").strip()
            if val and not NON_PLACE_RE.match(val):
                places.add(val)

    lived_path = REPO_ROOT / "web" / "lived-places.json"
    if lived_path.exists():
        lived = json.loads(lived_path.read_text())
        for person_data in lived.values():
            for lp in person_data.get("livedPlaces", []):
                val = (lp.get("place") or "").strip()
                if val:
                    places.add(val)

    return places


def geocode_nominatim(query: str) -> dict | None:
    params = urllib.parse.urlencode({
        "q": query, "format": "json", "limit": 1,
    })
    url = f"{NOMINATIM_URL}?{params}"
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read())
        if data:
            return {"lat": float(data[0]["lat"]), "lng": float(data[0]["lon"])}
    except Exception as exc:
        print(f"  ERROR: {exc}", file=sys.stderr)
    return None


def geocode_place(place: str) -> dict | None:
    if place in MANUAL_OVERRIDES:
        return MANUAL_OVERRIDES[place]

    query = SEARCH_REWRITES.get(place, place)
    result = geocode_nominatim(query)
    if result:
        return result

    parts = [p.strip() for p in place.split(",")]
    if len(parts) >= 3:
        short_query = ", ".join([parts[0], parts[-1]])
        result = geocode_nominatim(short_query)
        if result:
            return result

    return None


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    existing: dict[str, dict] = {}
    if OUT_PATH.exists():
        existing = json.loads(OUT_PATH.read_text())
        if not args.force:
            print(f"place-geo.json exists with {len(existing)} entries. Use --force to re-geocode.")

    tree = json.loads(TREE_PATH.read_text())
    places = sorted(extract_unique_places(tree))
    print(f"Found {len(places)} unique place strings to geocode.")

    geo: dict[str, dict] = {}
    failed: list[str] = []
    skipped = 0
    overridden = 0

    for i, place in enumerate(places):
        if place in MANUAL_OVERRIDES:
            geo[place] = MANUAL_OVERRIDES[place]
            overridden += 1
            continue

        if not args.force and place in existing:
            geo[place] = existing[place]
            skipped += 1
            continue

        print(f"  [{i + 1}/{len(places)}] {place} ... ", end="", flush=True)
        result = geocode_place(place)
        if result:
            geo[place] = result
            print(f"({result['lat']:.4f}, {result['lng']:.4f})")
        else:
            failed.append(place)
            print("FAILED")

        time.sleep(RATE_LIMIT_SEC)

    OUT_PATH.write_text(json.dumps(geo, indent=2, ensure_ascii=False) + "\n")
    print(f"\nWrote {len(geo)} entries to {OUT_PATH.relative_to(REPO_ROOT)}")
    if overridden:
        print(f"  ({overridden} from manual overrides)")
    if skipped:
        print(f"  ({skipped} reused from existing file)")
    if failed:
        print(f"\n{len(failed)} places could not be geocoded:")
        for p in failed:
            print(f"  - {p}")
        print("\nAdd manual overrides in MANUAL_OVERRIDES dict and re-run with --force.")


if __name__ == "__main__":
    main()
