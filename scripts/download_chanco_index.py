#!/usr/bin/env python3
"""
Download Chanco birth/marriage/death index images (DGS 004702560, 714 pages).

Images are downloaded in randomized order via the deepzoom endpoint using
predictable DGS locators (no enumeration needed). Existing files are skipped.

Usage:
  python3 scripts/download_chanco_index.py download
  python3 scripts/download_chanco_index.py download --width 2000
  python3 scripts/download_chanco_index.py status
"""

import argparse
import os
import random
import sys
import time
from urllib.error import HTTPError
from urllib.request import Request, urlopen

FS_BEARER_TOKEN = "p0-C_oROgeTjPg.aTGTHMs0L8y"

DGS_NUMBER = "004702560"
TOTAL_IMAGES = 714

DEEPZOOM_URL = (
    "https://sg30p0.familysearch.org/service/records/storage/deepzoomcloud/dz/v1"
)
OUTPUT_DIR = "media/docs/chile-chanco/index-nacimientos-1885-1932"

BROWSER_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
)

DOWNLOAD_SLEEP = 2.0
RETRY_SLEEP = 30.0
MAX_RETRIES = 3


def _print(msg=""):
    print(msg, flush=True)


def _dgs_locator(page_num: int) -> str:
    return f"dgs:{DGS_NUMBER}.{DGS_NUMBER}_{page_num:05d}"


def _headers():
    return {
        "Authorization": f"Bearer {FS_BEARER_TOKEN}",
        "User-Agent": BROWSER_UA,
        "Accept": "image/jpeg",
        "Referer": "https://www.familysearch.org/",
    }


def cmd_download(args):
    width = args.width
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    pages = list(range(1, TOTAL_IMAGES + 1))
    random.shuffle(pages)

    downloaded = 0
    skipped = 0
    failed = 0

    for i, page in enumerate(pages):
        filename = f"page-{page:04d}.jpg"
        filepath = os.path.join(OUTPUT_DIR, filename)

        if os.path.exists(filepath) and os.path.getsize(filepath) > 1000:
            skipped += 1
            continue

        locator = _dgs_locator(page)
        url = f"{DEEPZOOM_URL}/{locator}/scale?width={width}"
        req = Request(url, headers=_headers())

        success = False
        for attempt in range(1, MAX_RETRIES + 1):
            try:
                with urlopen(req, timeout=30) as resp:
                    img_data = resp.read()

                if len(img_data) < 1000:
                    _print(
                        f"  WARNING: page {page} only {len(img_data)} bytes "
                        f"— may be restricted"
                    )

                with open(filepath, "wb") as f:
                    f.write(img_data)

                size_kb = len(img_data) / 1024
                downloaded += 1
                done = downloaded + skipped + failed
                _print(
                    f"  [{done}/{TOTAL_IMAGES}] page-{page:04d}.jpg "
                    f"({size_kb:.0f} KB)"
                )
                success = True
                break

            except HTTPError as e:
                if e.code in (403, 429):
                    _print(
                        f"  page {page}: HTTP {e.code} "
                        f"(attempt {attempt}/{MAX_RETRIES}) "
                        f"— waiting {RETRY_SLEEP}s"
                    )
                    time.sleep(RETRY_SLEEP)
                else:
                    _print(f"  page {page}: HTTP {e.code} — skipping")
                    break
            except Exception as e:
                _print(
                    f"  page {page}: {e} "
                    f"(attempt {attempt}/{MAX_RETRIES})"
                )
                time.sleep(RETRY_SLEEP)

        if not success:
            failed += 1

        time.sleep(DOWNLOAD_SLEEP)

    _print(
        f"\nDone. Downloaded: {downloaded}, "
        f"Skipped (exist): {skipped}, Failed: {failed}"
    )


def cmd_status(_args):
    if not os.path.isdir(OUTPUT_DIR):
        _print("Output directory does not exist yet.")
        return

    files = [
        f
        for f in os.listdir(OUTPUT_DIR)
        if f.startswith("page-") and f.endswith(".jpg")
    ]
    total_bytes = sum(
        os.path.getsize(os.path.join(OUTPUT_DIR, f)) for f in files
    )
    _print(f"Downloaded: {len(files)} / {TOTAL_IMAGES} images "
           f"({total_bytes / 1024 / 1024:.1f} MB)")
    _print(f"Remaining: {TOTAL_IMAGES - len(files)}")


def main():
    parser = argparse.ArgumentParser(
        description="Download Chanco index images"
    )
    sub = parser.add_subparsers(dest="command")

    dl = sub.add_parser("download", help="Download images (random order)")
    dl.add_argument(
        "--width", type=int, default=3000,
        help="Image width in pixels (default: 3000)",
    )

    sub.add_parser("status", help="Show download progress")

    args = parser.parse_args()
    if args.command == "download":
        cmd_download(args)
    elif args.command == "status":
        cmd_status(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
