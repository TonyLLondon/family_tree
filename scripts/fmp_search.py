#!/usr/bin/env python3
"""
Query FindMyPast from the command line.

Usage:
    python scripts/fmp_search.py census   --first george --last coolbear --year 1841
    python scripts/fmp_search.py births   --first samuel --last lewis --year 1887 --place "merthyr tydfil"
    python scripts/fmp_search.py marriages --first catherine --last griffiths --year 1884 --place merthyr
    python scripts/fmp_search.py deaths   --first david --last lewis --year 1925
    python scripts/fmp_search.py search   --first peter --last martin --year 1857
    python scripts/fmp_search.py image    GBC/1841/0327/0574

Filters:
    --place TEXT        Place name (uses FMP KeywordsPlace field; case-insensitive)
    --place-radius N    Miles radius for place (default 5)
    --born YEAR         Birth year filter
    --born-offset N     Birth year range ± (default 3)
    --category TEXT     Raw SourceCategory override (e.g. "parish baptisms")
    --collection TEXT   Raw SourceCollection override
    --variants          Enable first/last name variant matching

Token refresh:
    Copy a fresh fmp_access_token cookie value from browser DevTools →
    Application → Cookies and replace FMP_ACCESS_TOKEN below (or export
    the env var). Tokens last ~30 min.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import textwrap
import time
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from urllib.error import HTTPError

# ── Rate limiting ────────────────────────────────────────────────────────────
MIN_REQUEST_INTERVAL = 3.0
_last_request_time: float = 0.0

# ── Endpoints ────────────────────────────────────────────────────────────────
GRAPHQL_URL = "https://www.findmypast.co.uk/titan/marshal/graphql"
SEARCH_TRANSCRIPT_URL = "https://search.findmypast.co.uk/record/GetTranscriptFromImage"

# ── Paste a fresh token here (or export FMP_ACCESS_TOKEN in your shell) ──────
FMP_ACCESS_TOKEN = (
    "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImowV2dNN2cyQnUxT0Y4YjBpT3RTZyJ9"
    ".eyJodHRwczovL3d3dy5maW5kbXlwYXN0LmNvbS9tZW1iZXJfaWQiOjQxMTI4NDgxOCwiaHR0cHM6"
    "Ly93d3cuZmluZG15cGFzdC5jb20vY29ubmVjdGlvbiI6ImFjY291bnQiLCJodHRwczovL3d3dy5maW5k"
    "bXlwYXN0LmNvbS9nbG9iYWxfbWVtYmVyX2lkIjoiRk1QfDQxMTI4NDgxOCIsImh0dHBzOi8vd3d3Lm"
    "ZpbmRteXBhc3QuY29tL2V4cGVyaW1lbnRhdGlvbl90cmFja2luZ19rZXkiOiIyNzU5MTQwZS1mNTU0LT"
    "RkM2UtOThiYS0xNjU0NmFiMjZlMmQiLCJodHRwczovL3d3dy5maW5kbXlwYXN0LmNvbS9wdWJsaWNf"
    "aWQiOiJlYjQ1NDAzZS1hY2ExLTRjOGEtOWExZS00MjQ3ODg5MmE1Y2YiLCJodHRwczovL3d3dy5maW5k"
    "bXlwYXN0LmNvbS9zdWJfcGxhbl9pZCI6IjExNjciLCJodHRwczovL3d3dy5maW5kbXlwYXN0LmNvbS9z"
    "dWJfcGxhbl9ncm91cCI6IkV2ZXJ5dGhpbmciLCJodHRwczovL3d3dy5maW5kbXlwYXN0LmNvbS9zdWJf"
    "cGxhbl9tb250aHMiOjEsImh0dHBzOi8vd3d3LmZpbmRteXBhc3QuY29tL3N1Yl9zdGF0ZSI6IkFDVElW"
    "RSIsImh0dHBzOi8vd3d3LmZpbmRteXBhc3QuY29tL3N1Yl90eXBlIjoiRlJFRV9UUklBTCIsImh0dHBz"
    "Oi8vd3d3LmZpbmRteXBhc3QuY29tL3N1Yl9zdG9yZSI6IlJFQ1VSTFkiLCJpc3MiOiJodHRwczovL2F1"
    "dGguZmluZG15cGFzdC5jb20vIiwic3ViIjoiYXV0aDB8YWNjb3VudHw0MTEyODQ4MTgiLCJhdWQiOlsi"
    "aHR0cHM6Ly93d3cuZmluZG15cGFzdC5jb20vYXBpIiwiaHR0cHM6Ly9mbXAtcHJvZHVjdGlvbi5ldS5h"
    "dXRoMC5jb20vdXNlcmluZm8iXSwiaWF0IjoxNzc0NzQyNzc5LCJleHAiOjE3NzQ3NDQ1NzksInNjb3Bl"
    "Ijoib3BlbmlkIHByb2ZpbGUgZW1haWwgb2ZmbGluZV9hY2Nlc3MiLCJhenAiOiJ0WVk2TmZxckQ2WkhI"
    "Um1uUlNZazFLcFlJMDV2R25ScCJ9.KHvjhBNPmTngH7vCpbcvwRWgJDMwR2cy5SgKvZu3qnmq109KH74h"
    "P0Zbb9O4GMyRx86aP8fiAJ1fRiUJdxnKyNY-CONI8MDwMpJfLflXWvkr-hjKC4YEcSKHNjp0MGKHMp2Gi"
    "NHQZp3jFIyt9K0utd3KRWn5yhEgQCS1SN2i23JMiJf05QiprEIjvOHQyZpoJGW9zhRcDNuFOXQIRsZ35qy"
    "nMal2Or-gee9KPu59B5La0QIiHVf0_EeSvTSBAIa9ZC46SZ9KQXq5tRHQFqj_XyDhULuyNF47ugO9Q8NCh"
    "3y7tfZ8AwuDdMWT9kcaRA2kO9EcfnS3MYKumpK5jotxDg"
)

_BROWSER_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/146.0.0.0 Safari/537.36"
)

# ── GraphQL queries ──────────────────────────────────────────────────────────

SEARCH_QUERY = textwrap.dedent("""\
    query searchResultsRecordsAndMetadata(
        $filters: [SearchFilter!], $order: RecordSearchOrder, $pageNumber: Int
    ) {
        root {
            id
            search {
                id
                recordSearch(filters: $filters, order: $order, pageNumber: $pageNumber) {
                    id
                    numberOfRecords
                    numberOfNextPages
                    records {
                        id
                        fields { fieldId value }
                        transcript { id creditCost recordMetadataId }
                        image { id creditCost recordMetadataId mediaSource }
                    }
                }
            }
        }
    }""")


# ── API transport ────────────────────────────────────────────────────────────

def _rate_limit() -> None:
    global _last_request_time
    elapsed = time.monotonic() - _last_request_time
    if _last_request_time and elapsed < MIN_REQUEST_INTERVAL:
        wait = MIN_REQUEST_INTERVAL - elapsed
        print(f"  (rate-limit: waiting {wait:.1f}s)", file=sys.stderr)
        time.sleep(wait)
    _last_request_time = time.monotonic()


def _token() -> str:
    return os.environ.get("FMP_ACCESS_TOKEN") or FMP_ACCESS_TOKEN


def _graphql_post(payload: dict) -> dict:
    """POST to the www.findmypast.co.uk GraphQL endpoint."""
    _rate_limit()
    body = json.dumps(payload).encode()
    req = Request(
        GRAPHQL_URL,
        data=body,
        headers={
            "Content-Type": "application/json",
            "Cookie": f"fmp_access_token={_token()}",
            "apollographql-client-name": "titan-client",
            "apollographql-client-app": "titan",
            "apollographql-client-version": "v65438",
            "Origin": "https://www.findmypast.co.uk",
            "Referer": "https://www.findmypast.co.uk/search/results",
            "User-Agent": _BROWSER_UA,
        },
    )
    try:
        with urlopen(req) as resp:
            result = json.loads(resp.read())
        if "errors" in result and not result.get("data"):
            msgs = "; ".join(e.get("message", "") for e in result["errors"])
            print(f"ERROR: GraphQL — {msgs}", file=sys.stderr)
            if "auth" in msgs.lower() or "token" in msgs.lower():
                print("Token has likely expired. Paste a fresh one.", file=sys.stderr)
            sys.exit(1)
        return result
    except HTTPError as exc:
        err_body = exc.read().decode(errors="replace")[:500]
        if exc.code == 401:
            print("ERROR: 401 Unauthorized — token has expired. Paste a fresh one.", file=sys.stderr)
            sys.exit(1)
        print(f"ERROR: HTTP {exc.code} — {err_body}", file=sys.stderr)
        sys.exit(1)


def _search_get(path: str, params: dict) -> list | dict:
    """GET from search.findmypast.co.uk REST API."""
    _rate_limit()
    url = f"{path}?{urlencode(params)}"
    req = Request(
        url,
        headers={
            "Cookie": f"fmp_access_token={_token()}",
            "Referer": "https://search.findmypast.co.uk/",
            "User-Agent": _BROWSER_UA,
            "X-Requested-With": "XMLHttpRequest",
        },
    )
    try:
        with urlopen(req) as resp:
            raw = resp.read()
            text = raw.decode(errors="replace")
            if not text.strip():
                print(f"ERROR: Empty response from {url}", file=sys.stderr)
                sys.exit(1)
            try:
                return json.loads(text)
            except json.JSONDecodeError:
                print(f"ERROR: Non-JSON response from {url}", file=sys.stderr)
                print(text[:500], file=sys.stderr)
                sys.exit(1)
    except HTTPError as exc:
        err_body = exc.read().decode(errors="replace")[:500]
        if exc.code == 401:
            print("ERROR: 401 Unauthorized — token has expired. Paste a fresh one.", file=sys.stderr)
            sys.exit(1)
        print(f"ERROR: HTTP {exc.code} — {err_body}", file=sys.stderr)
        sys.exit(1)


# ── Category presets ──────────────────────────────────────────────────────────

_CATEGORY_PRESETS: dict[str, tuple[str | None, str | None]] = {
    "census":    ("census, land & surveys", "census"),
    "births":    (None, "births & baptisms"),
    "marriages": (None, "marriages & divorces"),
    "deaths":    (None, "deaths & burials"),
    "search":    (None, None),
}


# ── Search builder ───────────────────────────────────────────────────────────

def _build_filters(
    *,
    first: str | None,
    last: str | None,
    year: int | None,
    year_offset: int,
    born: int | None,
    born_offset: int,
    country: str,
    collection: str | None,
    category: str | None,
    place: str | None,
    place_radius: int,
    variants: bool,
) -> list[dict]:
    filters: list[dict] = []
    if collection:
        filters.append({"values": [collection], "field": "SourceCollection"})
    if category:
        filters.append({"values": [category], "field": "SourceCategory"})
    filters.append({"values": [country], "field": "SourceCountry"})
    if year:
        filters.append({"values": [str(year)], "offset": year_offset, "field": "EventYear"})
    if born:
        filters.append({"values": [str(born)], "offset": born_offset, "field": "YearOfBirth"})
    if first:
        filters.append({"variants": variants, "values": [first], "field": "FirstName"})
    if last:
        filters.append({"variants": variants, "values": [last], "field": "LastName"})
    if place:
        filters.append({"values": [place], "proximity": place_radius, "field": "KeywordsPlace"})
    return filters


def _format_record(rec: dict, *, verbose: bool = False) -> str:
    """Format a single search result for display."""
    fields = {f["fieldId"]: f["value"] for f in rec["fields"]}
    name = f"{fields.get('FirstName', '')} {fields.get('LastName', '')}".strip()
    yob = fields.get("YearOfBirth", "?")
    addr = fields.get("DisplayAddress", "")
    others = fields.get("FirstNamesOther", "")
    ds = fields.get("DatasetName", "")
    cat = fields.get("SourceCategory", "")
    img = rec.get("image") or {}

    lines = [f"  {rec['id']}"]
    lines.append(f"    {name} (b. ~{yob}), {addr}")
    if others:
        lines.append(f"    Others in household: {others}")
    lines.append(f"    Dataset: {ds}")
    if cat:
        lines.append(f"    Category: {cat}")
    if img.get("id"):
        lines.append(f"    Image ID: {img['id']}")
    if verbose:
        for k, v in sorted(fields.items()):
            if k not in ("FirstName", "LastName", "YearOfBirth", "DisplayAddress",
                         "FirstNamesOther", "DatasetName", "Id", "SourceCategory"):
                lines.append(f"      {k}: {v}")
    return "\n".join(lines)


def run_search(args: argparse.Namespace) -> None:
    preset_collection, preset_category = _CATEGORY_PRESETS.get(args.command, (None, None))
    collection = getattr(args, "collection", None) or preset_collection
    category = getattr(args, "category", None) or preset_category

    filters = _build_filters(
        first=args.first,
        last=args.last,
        year=args.year,
        year_offset=args.year_offset,
        born=getattr(args, "born", None),
        born_offset=getattr(args, "born_offset", 3),
        country=args.country,
        collection=collection,
        category=category,
        place=getattr(args, "place", None),
        place_radius=getattr(args, "place_radius", 5),
        variants=getattr(args, "variants", False),
    )

    place_filter = getattr(args, "place", None)

    page = args.page
    shown = 0
    while True:
        payload = {
            "operationName": "searchResultsRecordsAndMetadata",
            "query": SEARCH_QUERY,
            "variables": {"filters": filters, "order": None, "pageNumber": page},
        }
        data = _graphql_post(payload)
        rs = data["data"]["root"]["search"]["recordSearch"]
        total = rs["numberOfRecords"]
        records = rs["records"]
        next_pages = rs["numberOfNextPages"]

        if page == 1:
            print(f"── {total} total results ──\n")

        for rec in records:
            print(_format_record(rec, verbose=getattr(args, "verbose", False)))
            print()
            shown += 1

        if next_pages == 0 or not args.all_pages:
            break
        page += 1

    if shown < int(total) and not args.all_pages:
        print(f"  … showing {shown} of {total} (use --all-pages for all)\n")

    if args.json:
        json.dump(data, sys.stdout, indent=2)
        print()


# ── Image transcript (REST) ─────────────────────────────────────────────────

def run_image(args: argparse.Namespace) -> None:
    """Fetch all transcribed people on a census image page."""
    image_id = args.image_id
    data = _search_get(SEARCH_TRANSCRIPT_URL, {
        "ImageId": image_id,
        "OriginalId": image_id,
    })

    if args.json:
        json.dump(data, sys.stdout, indent=2)
        print()
        return

    if not data:
        print(f"No records found for image {image_id}")
        return

    print(f"── Image {image_id} — {len(data)} people ──\n")
    for person in data:
        name = f"{person.get('FirstName', '')} {person.get('LastName', '')}".strip()
        yob = person.get("YearOfBirth", "?")
        record_id = person.get("Id", "")
        print(f"  {name:30s}  b. ~{yob:4s}  [{record_id}]")
    print()


# ── CLI ──────────────────────────────────────────────────────────────────────

def _add_search_args(sp: argparse.ArgumentParser) -> None:
    sp.add_argument("--first", help="First name")
    sp.add_argument("--last", help="Last name")
    sp.add_argument("--year", type=int, help="Event year")
    sp.add_argument("--year-offset", type=int, default=5, help="Year range ± (default 5)")
    sp.add_argument("--place", help="Place name filter (e.g. 'merthyr tydfil', 'aberdare')")
    sp.add_argument("--place-radius", type=int, default=5,
                     help="Radius in miles for place filter (default 5)")
    sp.add_argument("--born", type=int, help="Birth year filter")
    sp.add_argument("--born-offset", type=int, default=3,
                     help="Birth year range ± (default 3)")
    sp.add_argument("--country", default="great britain",
                     help="Source country (default: great britain)")
    sp.add_argument("--category", help="Override SourceCategory (e.g. 'parish baptisms')")
    sp.add_argument("--collection", help="Override SourceCollection")
    sp.add_argument("--variants", action="store_true",
                     help="Enable name variant matching (default: exact)")
    sp.add_argument("--page", type=int, default=1, help="Start page (default 1)")
    sp.add_argument("--all-pages", action="store_true", help="Fetch all pages")
    sp.add_argument("-v", "--verbose", action="store_true",
                     help="Show all record fields")
    sp.set_defaults(func=run_search)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Query FindMyPast APIs",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=textwrap.dedent("""\
            examples:
              %(prog)s census   --first george --last coolbear --year 1841
              %(prog)s births   --first samuel --last lewis --year 1887 --place "merthyr tydfil"
              %(prog)s marriages --first catherine --last griffiths --year 1884 --place merthyr
              %(prog)s deaths   --first david --last lewis --year 1925 --place merthyr
              %(prog)s census   --first david --last lewis --year 1881 --place aberdare --born 1857 --born-offset 2
              %(prog)s search   --first peter --last martin --year 1857 --variants
              %(prog)s image    GBC/1841/0327/0574
        """),
    )
    parser.add_argument("--json", action="store_true", help="Dump raw JSON response")
    sub = parser.add_subparsers(dest="command", required=True)

    for name, desc in [
        ("census",    "Census records"),
        ("births",    "Birth records & baptisms"),
        ("marriages", "Marriage records & divorces"),
        ("deaths",    "Death records & burials"),
        ("search",    "All-collection search"),
    ]:
        sp = sub.add_parser(name, help=desc)
        _add_search_args(sp)

    ip = sub.add_parser("image", help="List all people on a census image page")
    ip.add_argument("image_id", help="Image ID from search results (e.g. GBC/1841/0327/0574)")
    ip.set_defaults(func=run_image)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
