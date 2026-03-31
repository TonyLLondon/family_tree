#!/usr/bin/env python3
"""
Query FindMyPast from the command line.

Usage:
    python scripts/fmp_search.py census   --first george --last coolbear --year 1841
    python scripts/fmp_search.py births   --first samuel --last lewis --year 1887 --place "merthyr tydfil"
    python scripts/fmp_search.py marriages --first catherine --last griffiths --year 1884 --place merthyr
    python scripts/fmp_search.py deaths   --first david --last lewis --year 1925
    python scripts/fmp_search.py search   --first peter --last martin --year 1857
    python scripts/fmp_search.py detail   GBC/1861/0001222452
    python scripts/fmp_search.py newspapers --names "fulvia lewis"
    python scripts/fmp_search.py newspapers --names "thomas cushen" --from 1860 --to 1890 --facets

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
    Application → Cookies and replace FMP_ACCESS_TOKEN below.
    Tokens last ~30 min.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import textwrap
import time
from urllib.request import Request, urlopen
from urllib.error import HTTPError

# ── Rate limiting ────────────────────────────────────────────────────────────
MIN_REQUEST_INTERVAL = 3.0
_last_request_time: float = 0.0

# ── Endpoints ────────────────────────────────────────────────────────────────
GRAPHQL_URL = "https://www.findmypast.co.uk/titan/marshal/graphql"
IIIF_BASE = "https://www.findmypast.co.uk/titan/marshal/obscura/api/image"

# ── Paste fresh tokens here (or export in your shell) ──────
FMP_TILE_SESSION = "12067ec6a8e46100"

FMP_ACCESS_TOKEN = (
    "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImowV2dNN2cyQnUxT0Y4YjBpT3RTZyJ9.eyJodHRwczovL3d3dy5maW5kbXlwYXN0LmNvbS9tZW1iZXJfaWQiOjQxMTI4NDgxOCwiaHR0cHM6Ly93d3cuZmluZG15cGFzdC5jb20vY29ubmVjdGlvbiI6ImFjY291bnQiLCJodHRwczovL3d3dy5maW5kbXlwYXN0LmNvbS9nbG9iYWxfbWVtYmVyX2lkIjoiRk1QfDQxMTI4NDgxOCIsImh0dHBzOi8vd3d3LmZpbmRteXBhc3QuY29tL2V4cGVyaW1lbnRhdGlvbl90cmFja2luZ19rZXkiOiIyNzU5MTQwZS1mNTU0LTRkM2UtOThiYS0xNjU0NmFiMjZlMmQiLCJodHRwczovL3d3dy5maW5kbXlwYXN0LmNvbS9wdWJsaWNfaWQiOiJlYjQ1NDAzZS1hY2ExLTRjOGEtOWExZS00MjQ3ODg5MmE1Y2YiLCJodHRwczovL3d3dy5maW5kbXlwYXN0LmNvbS9zdWJfcGxhbl9pZCI6IjExNjciLCJodHRwczovL3d3dy5maW5kbXlwYXN0LmNvbS9zdWJfcGxhbl9ncm91cCI6IkV2ZXJ5dGhpbmciLCJodHRwczovL3d3dy5maW5kbXlwYXN0LmNvbS9zdWJfcGxhbl9tb250aHMiOjEsImh0dHBzOi8vd3d3LmZpbmRteXBhc3QuY29tL3N1Yl9zdGF0ZSI6IkFDVElWRSIsImh0dHBzOi8vd3d3LmZpbmRteXBhc3QuY29tL3N1Yl90eXBlIjoiRlJFRV9UUklBTCIsImh0dHBzOi8vd3d3LmZpbmRteXBhc3QuY29tL3N1Yl9zdG9yZSI6IlJFQ1VSTFkiLCJpc3MiOiJodHRwczovL2F1dGguZmluZG15cGFzdC5jb20vIiwic3ViIjoiYXV0aDB8YWNjb3VudHw0MTEyODQ4MTgiLCJhdWQiOlsiaHR0cHM6Ly93d3cuZmluZG15cGFzdC5jb20vYXBpIiwiaHR0cHM6Ly9mbXAtcHJvZHVjdGlvbi5ldS5hdXRoMC5jb20vdXNlcmluZm8iXSwiaWF0IjoxNzc0OTUwNDg4LCJleHAiOjE3NzQ5NTIyODgsInNjb3BlIjoib3BlbmlkIHByb2ZpbGUgZW1haWwgb2ZmbGluZV9hY2Nlc3MiLCJhenAiOiJ0WVk2TmZxckQ2WkhIUm1uUlNZazFLcFlJMDV2R25ScCJ9.VI4EPjUv7yozqnv8jmFJKoDJW-1ynMJ-NOw99ZnRCqT7Es-2sWzG5V2dLL8DAPPLQIcE50X9joDkMXnGNi9xMM61dCtUXExV2NpCDbksVwc9YvAZcDjVHxrithnRkGcHOi3Y3jUuSgqHJZiIIaFi-mdEHSzMvhDSzQFX6MeCP3x2E-VzS_Oh5DwX_tjqB3s36-gEdJZ4lpfpPcoY9XhO5ZiOyNGcJ-Ddn24s2EXJhmTj9FsOAKvCsj_vi-cuNbhAa__aSS_lgzESDsLCetEXZMdEZ1YAM4MJOioSSOrlu7-HDoRAyX_gbmKvqSnzRYgRXlp0mVGtP67CeG5fD8YHgQ"
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

NEWSPAPER_SEARCH_QUERY = textwrap.dedent("""\
    query searchNewspaperArticles(
        $filters: ArticleSearchFiltersInput!,
        $pagination: NewspaperSearchPaginationInput!,
        $ordering: NewspaperSearchOrderingInput!,
        $facets: [ArticleSearchExclusiveFacetEnum!]
    ) {
        articleSearch(
            filters: $filters
            pagination: $pagination
            ordering: $ordering
            facets: $facets
        ) {
            id
            numberOfResults
            articles {
                id
                articleId
                title
                textSnippet
                articleMetadata {
                    wordCount
                    type
                    score
                    availableSince
                    freeToView
                    __typename
                }
                newspaperPages {
                    id
                    thumbnailUri
                    __typename
                }
                newspaperIssue {
                    id
                    title
                    publicationPlace
                    publicationCounty
                    publicationRegion
                    publicationDate
                    __typename
                }
                __typename
            }
            facets {
                name
                facetCounts {
                    value
                    numberOfResults
                    __typename
                }
                __typename
            }
            __typename
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
    tok = FMP_ACCESS_TOKEN
    if ";" in tok:
        tok = tok.split(";")[0].strip()
    return tok


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
        err_body = exc.read().decode(errors="replace")[:4000]
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
    keywords: str | None = None,
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
    if keywords:
        filters.append({"values": [keywords], "field": "Keywords"})
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
        keywords=getattr(args, "keywords", None),
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
        if "errors" in data:
            msgs = "; ".join(e.get("message", "") for e in data["errors"])
            print(f"GraphQL errors: {msgs}", file=sys.stderr)
            sys.exit(1)
        rs = data["data"]["root"]["search"]["recordSearch"]
        if rs is None:
            print("No recordSearch in response (bad filter field name?)", file=sys.stderr)
            json.dump(data, sys.stderr, indent=2)
            sys.exit(1)
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


# ── Newspaper search ─────────────────────────────────────────────────────────

_HIGHLIGHT_RE = re.compile(r"<span class=['\"]highlight['\"]>(.*?)</span>")
_NEWSPAPER_FACETS = [
    "NEWSPAPER_TITLE", "COUNTY", "ARTICLE_TYPE", "COVERAGE_COUNTRY",
    "PLACE", "COVERAGE", "ACCESS_TYPE", "COUNTRY",
]


def _strip_highlights(text: str) -> str:
    return _HIGHLIGHT_RE.sub(r"\1", text)


def _format_article(art: dict, *, verbose: bool = False) -> str:
    issue = art.get("newspaperIssue") or {}
    meta = art.get("articleMetadata") or {}
    title = _strip_highlights(art.get("title", "")).strip()
    snippet = _strip_highlights(art.get("textSnippet", "")).strip()
    newspaper = issue.get("title", "")
    place = issue.get("publicationPlace", "")
    date = issue.get("publicationDate", "")
    art_type = ", ".join(meta.get("type", []))
    words = meta.get("wordCount", "")
    article_id = art.get("articleId", "")
    url = f"https://www.findmypast.co.uk/search-newspapers/article/{article_id}" if article_id else ""

    lines = [f"  {newspaper} — {date}"]
    lines.append(f"    \"{title}\"")
    if snippet:
        lines.append(f"    …{snippet[:200]}{'…' if len(snippet) > 200 else ''}")
    lines.append(f"    {place}  |  {art_type}  |  {words} words")
    if url:
        lines.append(f"    {url}")
    if verbose:
        lines.append(f"    Score: {meta.get('score', '?')}  |  ID: {art.get('id', '')}")
        pages = art.get("newspaperPages") or []
        for pg in pages:
            lines.append(f"    Thumb: {pg.get('thumbnailUri', '')}")
    return "\n".join(lines)


def run_newspaper_search(args: argparse.Namespace) -> None:
    pub_date: dict | None = None
    if getattr(args, "from_year", None) or getattr(args, "to_year", None):
        pub_date = {
            "from": f"{args.from_year}-01-01" if getattr(args, "from_year", None) else None,
            "to": f"{args.to_year}-12-31" if getattr(args, "to_year", None) else None,
        }

    filter_query: dict = {
        "consumer": "FMP",
        "publicationPlace": [],
        "newspaperTitle": [],
        "articleType": [],
        "coverage": [],
        "coverageCountry": [],
        "addedDate": None,
        "publicationDate": pub_date,
        "accessType": None,
        "archiveTag": [],
        "dayOfYear": None,
        "filterByPerpetualAccess": False,
        "frontPageOnly": False,
    }
    if getattr(args, "newspaper", None):
        filter_query["newspaperTitle"] = [args.newspaper]
    if getattr(args, "place", None):
        filter_query["publicationPlace"] = [args.place]
    if getattr(args, "county", None):
        filter_query["coverageCountry"] = [args.county]

    filters: dict = {
        "namesFilter": [args.names] if args.names else [],
        "exactNames": True,
        "keywordsFilter": getattr(args, "keywords", None) or "",
        "exactKeywords": False,
        "filterQuery": filter_query,
    }

    rows = 20
    start_from = (args.page - 1) * rows
    shown = 0

    while True:
        payload = {
            "operationName": "searchNewspaperArticles",
            "query": NEWSPAPER_SEARCH_QUERY,
            "variables": {
                "filters": filters,
                "pagination": {"startFrom": start_from, "rows": rows},
                "ordering": {"by": "RELEVANCE", "direction": "DESC"},
                "facets": _NEWSPAPER_FACETS,
            },
        }
        data = _graphql_post(payload)

        if "errors" in data:
            msgs = "; ".join(e.get("message", "") for e in data["errors"])
            print(f"GraphQL errors: {msgs}", file=sys.stderr)
            if args.json:
                json.dump(data, sys.stdout, indent=2)
                print()
            sys.exit(1)

        search = data["data"]["articleSearch"]
        total = search["numberOfResults"]
        articles = search["articles"]

        if start_from == 0:
            print(f"── {total} newspaper results for \"{args.names}\" ──\n")

        for art in articles:
            print(_format_article(art, verbose=getattr(args, "verbose", False)))
            print()
            shown += 1

        if not articles or not args.all_pages:
            break
        start_from += rows

    if shown < total and not args.all_pages:
        print(f"  … showing {shown} of {total} (use --all-pages for all)\n")

    if getattr(args, "facets_summary", False):
        facets = search.get("facets") or []
        for f in facets:
            name = f["name"]
            counts = f.get("facetCounts", [])
            top = sorted(counts, key=lambda c: c["numberOfResults"], reverse=True)[:5]
            if top:
                print(f"  {name}:")
                for c in top:
                    print(f"    {c['value']}: {c['numberOfResults']}")
        print()

    if args.json:
        json.dump(data, sys.stdout, indent=2)
        print()


# ── Newspaper IIIF image download ────────────────────────────────────────────

def _page_id_to_iiif_path(page_id: str) -> str:
    """Convert page ID like 'BL/0005200/19830901/0001' to IIIF image path."""
    parts = page_id.split("/")
    if parts[0] == "BL":
        parts = parts[1:]
    newspaper_id, date_str, page_num = parts[0], parts[1], parts[2]
    year = date_str[:4]
    monthday = date_str[4:]
    jp2_name = f"{newspaper_id}_{date_str}_{page_num}.jp2"
    return f"{newspaper_id}/{year}/{monthday}/{jp2_name}"


def _iiif_image_url(page_id: str, width: int | None = None) -> str:
    """Build IIIF Image API 2.0 URL for a newspaper page."""
    from urllib.parse import quote
    path = _page_id_to_iiif_path(page_id)
    encoded_path = quote(path, safe="")
    size = f"{width}," if width else "full"
    return f"{IIIF_BASE}/{encoded_path}/full/{size}/0/default.jpg"


def _tile_session() -> str:
    return FMP_TILE_SESSION


def _download_iiif_image(page_id: str, output_path: str, width: int | None = 1772) -> str:
    """Download a newspaper page image via IIIF. Returns the output path."""
    _rate_limit()
    url = _iiif_image_url(page_id, width=width) + f"?_t={int(time.time())}"
    req = Request(
        url,
        headers={
            "Cookie": f"fmp_access_token={_token()}; tile_session={_tile_session()}",
            "Referer": "https://www.findmypast.co.uk/image-viewer",
            "Origin": "https://www.findmypast.co.uk",
            "User-Agent": _BROWSER_UA,
            "Cache-Control": "no-cache",
        },
    )
    try:
        with urlopen(req) as resp:
            data = resp.read()
            if len(data) < 10_000:
                print(
                    f"WARNING: Image is only {len(data)} bytes — token has likely expired.\n"
                    "  Paste a fresh fmp_access_token from browser DevTools.",
                    file=sys.stderr,
                )
                sys.exit(1)
            with open(output_path, "wb") as f:
                f.write(data)
        return output_path
    except HTTPError as exc:
        err_body = exc.read().decode(errors="replace")[:500]
        print(f"ERROR: HTTP {exc.code} downloading image — {err_body}", file=sys.stderr)
        sys.exit(1)


def run_newspaper_image(args: argparse.Namespace) -> None:
    """Download a newspaper page image by page ID."""
    page_id = args.page_id
    width = getattr(args, "width", 1772) or 1772
    out = getattr(args, "output", None)
    if not out:
        safe_id = page_id.replace("/", "_")
        out = f"{safe_id}.jpg"
    print(f"Downloading {page_id} ({width}px wide) → {out}")
    _download_iiif_image(page_id, out, width=width)
    size_kb = os.path.getsize(out) / 1024
    print(f"  Saved {size_kb:.0f} KB → {out}")


# ── Record detail (GraphQL fulfillTranscript) ────────────────────────────────

FULFILL_TRANSCRIPT_QUERY = textwrap.dedent("""\
    mutation fulfillTranscript($recordId: String!, $confirmedPurchase: Boolean, $showCorrected: Boolean = false) {
      fulfillTranscript(recordId: $recordId, confirmedPurchase: $confirmedPurchase) {
        fulfillmentTypeKey
        suitablePlans
        action
        actionCode
        transcript {
          id
          contextualContent
          contextualContentData {
            id
            recordMetadataId
            geocode { latitude level longitude mapLayer __typename }
            address { place county district __typename }
            entities { code type value __typename }
            __typename
          }
          fields { fieldId value __typename }
          recordSet {
            id
            fields {
              fieldId displayLabel displayOnSite hideEmpty
              transcriptionDisplayOrder relatedRecordDisplayOrder __typename
            }
            canReportError __typename
          }
          transcriptFulfillableItem { id recordMetadataId isPurchased isNationalTrust __typename }
          imageFulfillableItem { id recordMetadataId mediaSource __typename }
          otherPeopleRelatedRecords {
            title
            records {
              id
              fields { value fieldId __typename }
              __typename
            }
            __typename
          }
          lastCorrectedBy @include(if: $showCorrected) {
            ... on TranscriptLastCorrectedData {
              __typename dateCorrected
              userProfile {
                id
                ... on ActiveUserProfile { username profilePicture __typename }
                ... on GDPRDeletedUserProfile { username __typename }
                __typename
              }
            }
            __typename
          }
          __typename
        }
        record {
          id
          transcript { id recordMetadataId __typename }
          pdf { id __typename }
          image { id recordMetadataId __typename }
          __typename
        }
        __typename
      }
    }""")


def _format_transcript_fields(fields: list[dict], field_meta: dict[str, str] | None = None) -> list[str]:
    """Format transcript fields into readable lines, using display labels when available."""
    lines: list[str] = []
    skip = {"Id", "SynthYOB", "SynthGenderFlag", "RecordMetadataId"}
    for f in fields:
        fid = f["fieldId"]
        if fid in skip:
            continue
        val = f["value"]
        if not val or not val.strip():
            continue
        label = (field_meta or {}).get(fid, fid)
        lines.append(f"    {label:30s}  {val}")
    return lines


def run_detail(args: argparse.Namespace) -> None:
    """Fetch full transcript for a record by its ID."""
    record_id = args.record_id
    payload = {
        "operationName": "fulfillTranscript",
        "query": FULFILL_TRANSCRIPT_QUERY,
        "variables": {"recordId": record_id, "showCorrected": False},
    }
    data = _graphql_post(payload)

    if args.json:
        json.dump(data, sys.stdout, indent=2)
        print()
        return

    ft = data.get("data", {}).get("fulfillTranscript")
    if not ft:
        print(f"No data returned for {record_id}", file=sys.stderr)
        sys.exit(1)

    action = ft.get("action", "")
    if action != "SUCCESS_USING_SUBSCRIPTION":
        print(f"Fulfillment action: {action} (code {ft.get('actionCode', '?')})", file=sys.stderr)
        if ft.get("suitablePlans"):
            print("  This record requires a subscription plan.", file=sys.stderr)
            sys.exit(1)

    transcript = ft.get("transcript")
    if not transcript:
        print(f"No transcript available for {record_id}", file=sys.stderr)
        sys.exit(1)

    field_meta: dict[str, str] = {}
    rs = transcript.get("recordSet")
    if rs and rs.get("fields"):
        for fm in rs["fields"]:
            if fm.get("displayLabel"):
                field_meta[fm["fieldId"]] = fm["displayLabel"]

    fields = transcript.get("fields", [])
    field_map = {f["fieldId"]: f["value"] for f in fields}
    name = f"{field_map.get('FirstName', '')} {field_map.get('LastName', '')}".strip() or record_id

    print(f"── {name} [{record_id}] ──\n")
    for line in _format_transcript_fields(fields, field_meta):
        print(line)

    ctx = transcript.get("contextualContentData")
    if ctx:
        addr = ctx.get("address")
        if addr:
            parts = [addr.get("place", ""), addr.get("district", ""), addr.get("county", "")]
            loc = ", ".join(p for p in parts if p)
            if loc:
                print(f"\n    {'Location':30s}  {loc}")

    img_item = transcript.get("imageFulfillableItem")
    if img_item and img_item.get("id"):
        print(f"\n    {'Image ID':30s}  {img_item['id']}")

    related = transcript.get("otherPeopleRelatedRecords") or []
    for group in related:
        if not isinstance(group, dict):
            continue
        title = group.get("title", "Related records")
        records = group.get("records", [])
        if records:
            print(f"\n  ── {title} ({len(records)} people) ──")
            for rec in records:
                if not isinstance(rec, dict):
                    continue
                rf = {f["fieldId"]: f["value"] for f in rec.get("fields", [])}
                rname = f"{rf.get('FirstName', '')} {rf.get('LastName', '')}".strip()
                extra_parts = []
                for k in ("Age", "RelationToHead", "Occupation", "BirthPlace", "MaritalStatus",
                          "YearOfBirth", "Sex", "BurialDate", "BaptismDate", "EventDate"):
                    if rf.get(k):
                        extra_parts.append(f"{k}={rf[k]}")
                extra = ", ".join(extra_parts)
                print(f"    {rname:30s}  {extra}  [{rec.get('id', '')}]")

    fmp_url = f"https://www.findmypast.co.uk/transcript?id={record_id}"
    print(f"\n    FMP URL: {fmp_url}")
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
    sp.add_argument("--keywords", help="Address/keyword filter (e.g. 'milner square')")
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

    np = sub.add_parser("newspapers", help="Search British Newspaper Archive via FMP")
    np.add_argument("--names", required=True, help="Name(s) to search for in articles")
    np.add_argument("--keywords", help="Additional keyword filter (e.g. 'madras', 'registrar')")
    np.add_argument("--from", dest="from_year", type=int, help="Start year")
    np.add_argument("--to", dest="to_year", type=int, help="End year")
    np.add_argument("--newspaper", help="Filter by newspaper title")
    np.add_argument("--place", help="Filter by publication place")
    np.add_argument("--county", help="Filter by county")
    np.add_argument("--page", type=int, default=1, help="Start page (default 1)")
    np.add_argument("--all-pages", action="store_true", help="Fetch all pages")
    np.add_argument("--facets", dest="facets_summary", action="store_true",
                     help="Show facet summary (top newspapers, counties, etc.)")
    np.add_argument("-v", "--verbose", action="store_true", help="Show scores, IDs, thumbnails")
    np.set_defaults(func=run_newspaper_search)

    nip = sub.add_parser("newspaper-image", help="Download a newspaper page image (IIIF)")
    nip.add_argument("page_id", help="Page ID from newspaper search (e.g. BL/0005200/19830901/0001)")
    nip.add_argument("--width", type=int, default=1772,
                      help="Image width in px (default 1772; use 3543 for full res)")
    nip.add_argument("-o", "--output", help="Output file path (default: <page_id>.jpg)")
    nip.set_defaults(func=run_newspaper_image)

    dp = sub.add_parser("detail", help="Fetch full transcript for a record ID")
    dp.add_argument("record_id", help="Record ID from search results (e.g. GBC/1861/0001222452)")
    dp.set_defaults(func=run_detail)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
