#!/usr/bin/env python3
"""
Query The National Archives (TNA) Discovery catalogue from the command line.

Search records:
    python scripts/tna_search.py search knecht
    python scripts/tna_search.py search "George Knecht" --last-name Knecht --first-name George
    python scripts/tna_search.py search knecht --department HO --date-from 1850 --date-to 1900
    python scripts/tna_search.py search "Evans Paddington" --department RG

Record detail:
    python scripts/tna_search.py detail C7313741

Browse children of a parent record:
    python scripts/tna_search.py children C4290179

Download a digitised record image:
    python scripts/tna_search.py download C7313741 -o naturalisation.pdf

API docs: https://discovery.nationalarchives.gov.uk/API
Rate limit: 1 req/sec, 3000 calls/day. No auth required.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import textwrap
import time
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from urllib.error import HTTPError

# ── Rate limiting (1 req/sec per TNA guidelines) ─────────────────────────────
MIN_REQUEST_INTERVAL = 1.1
_last_request_time: float = 0.0

BASE_URL = "https://discovery.nationalarchives.gov.uk/API"
DETAIL_URL = f"{BASE_URL}/records/v1/details"
SEARCH_URL = f"{BASE_URL}/search/v1/records"
CHILDREN_URL = f"{BASE_URL}/records/v1/children"

_BROWSER_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/146.0.0.0 Safari/537.36"
)


def _rate_limit() -> None:
    global _last_request_time
    elapsed = time.monotonic() - _last_request_time
    if _last_request_time and elapsed < MIN_REQUEST_INTERVAL:
        wait = MIN_REQUEST_INTERVAL - elapsed
        print(f"  (rate-limit: waiting {wait:.1f}s)", file=sys.stderr)
        time.sleep(wait)
    _last_request_time = time.monotonic()


def _api_get(url: str) -> dict:
    _rate_limit()
    req = Request(url, headers={
        "Accept": "application/json",
        "User-Agent": _BROWSER_UA,
    })
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
                print(f"ERROR: Non-JSON response:\n{text[:500]}", file=sys.stderr)
                sys.exit(1)
    except HTTPError as exc:
        body = exc.read().decode(errors="replace")[:2000]
        print(f"ERROR: HTTP {exc.code} — {body}", file=sys.stderr)
        sys.exit(1)
    return {}


# ── XML tag stripping for scopeContent descriptions ──────────────────────────

_DOCTYPE_RE = re.compile(r'<emph\s+altrender="doctype">[^<]*</emph>')
_TAG_RE = re.compile(r"<[^>]+>")


def _strip_xml(text: str | None) -> str:
    if not text:
        return ""
    text = _DOCTYPE_RE.sub("", text)
    return _TAG_RE.sub("", text).strip()


# ══════════════════════════════════════════════════════════════════════════════
#  SEARCH
# ══════════════════════════════════════════════════════════════════════════════

def _build_search_params(args: argparse.Namespace) -> dict[str, str]:
    params: dict[str, str] = {}
    if args.query:
        params["sps.searchQuery"] = args.query
    if getattr(args, "last_name", None):
        params["sps.lastName"] = args.last_name
    if getattr(args, "first_name", None):
        params["sps.firstName"] = args.first_name
    if getattr(args, "date_from", None):
        params["sps.dateFrom"] = f"{args.date_from}-01-01"
    if getattr(args, "date_to", None):
        params["sps.dateTo"] = f"{args.date_to}-12-31"
    if getattr(args, "department", None):
        params["sps.departments"] = args.department
    if getattr(args, "reference", None):
        params["sps.referenceQuery"] = args.reference
    if getattr(args, "place", None):
        params["sps.recordPlace"] = args.place
    if getattr(args, "occupation", None):
        params["sps.occupation"] = args.occupation
    page = getattr(args, "page", 1) or 1
    count = getattr(args, "count", 20) or 20
    params["sps.resultsPageSize"] = str(min(count, 100))
    params["sps.page"] = str(page)
    return params


def _format_search_hit(rec: dict, *, verbose: bool = False) -> str:
    rec_id = rec.get("id", "")
    ref = rec.get("reference", "")
    dates = rec.get("coveringDates", "")
    desc = rec.get("description", "") or ""
    title = rec.get("title", "") or ""
    display = desc or title
    dept = rec.get("department", "")
    held = ", ".join(rec.get("heldBy", []))
    digitised = "📄" if rec.get("digitised") else ""
    closure = rec.get("closureStatus", "")
    closure_tag = " [CLOSED]" if closure == "D" else ""

    lines: list[str] = []
    lines.append(f"  {ref}{closure_tag} {digitised}")
    lines.append(f"    {dates}")
    if display:
        wrapped = textwrap.fill(display, width=100, initial_indent="    ", subsequent_indent="    ")
        lines.append(wrapped)
    if verbose:
        lines.append(f"    ID: {rec_id}  |  Dept: {dept}")
        if held:
            lines.append(f"    Held by: {held}")
        places = rec.get("places", [])
        if places:
            lines.append(f"    Places: {', '.join(places)}")
        context = rec.get("context", "")
        if context:
            lines.append(f"    Context: {context}")
        score = rec.get("score", 0)
        lines.append(f"    Score: {score:.1f}")
    lines.append(f"    https://discovery.nationalarchives.gov.uk/details/r/{rec_id}")
    return "\n".join(lines)


def run_search(args: argparse.Namespace) -> None:
    if not args.query:
        print("ERROR: Provide a search query", file=sys.stderr)
        sys.exit(1)

    params = _build_search_params(args)
    url = f"{SEARCH_URL}?{urlencode(params)}"
    data = _api_get(url)

    total = data.get("count", 0)
    records = data.get("records", [])

    print(f"── {total} results ──\n")

    for rec in records:
        print(_format_search_hit(rec, verbose=getattr(args, "verbose", False)))
        print()

    page = getattr(args, "page", 1) or 1
    count = getattr(args, "count", 20) or 20
    shown_through = min(page * count, total)
    if shown_through < total:
        print(f"  … showing page {page} ({shown_through} of {total}; use --page {page + 1} for next)\n")

    if getattr(args, "facets", False):
        print("── Facets ──\n")
        for facet_key in ("departments", "timePeriods", "catalogueLevels", "closureStatuses", "repositories"):
            items = data.get(facet_key, [])
            if items:
                print(f"  {facet_key}:")
                for item in items[:15]:
                    print(f"    {item['code']:30s}  {item['count']}")
                print()

    if args.json:
        json.dump(data, sys.stdout, indent=2)
        print()


# ══════════════════════════════════════════════════════════════════════════════
#  DETAIL
# ══════════════════════════════════════════════════════════════════════════════

def _format_detail(data: dict) -> str:
    ref = data.get("citableReference", "")
    dates = data.get("coveringDates", "")
    scope = data.get("scopeContent", {})
    desc = _strip_xml(scope.get("description", ""))
    legal = data.get("legalStatus", "")
    digitised = data.get("digitised", False)
    closure = data.get("closureStatus", "")
    held = data.get("heldBy", [])
    held_str = ", ".join(h.get("xReferenceName", "") for h in held)
    rec_id = data.get("id", "")
    parent_id = data.get("parentId", "")

    lines: list[str] = []
    lines.append(f"── {ref} ──\n")
    lines.append(f"  {'Dates':25s}  {dates}")
    if desc:
        wrapped = textwrap.fill(desc, width=100, initial_indent="  Description              ", subsequent_indent="                             ")
        lines.append(wrapped)
    lines.append(f"  {'Digitised':25s}  {'Yes' if digitised else 'No'}")
    if closure:
        status = "Open" if closure == "O" else "Closed" if closure == "D" else closure
        lines.append(f"  {'Closure':25s}  {status}")
    if legal:
        lines.append(f"  {'Legal status':25s}  {legal}")
    if held_str:
        lines.append(f"  {'Held by':25s}  {held_str}")

    people = data.get("people", [])
    if people:
        lines.append(f"\n  People:")
        for p in people:
            lines.append(f"    {p}")

    places = scope.get("placeNames", []) or data.get("places", [])
    if places:
        place_strs = [p if isinstance(p, str) else p.get("name", str(p)) for p in places]
        lines.append(f"  {'Places':25s}  {', '.join(place_strs)}")

    copies = data.get("copiesInformation", [])
    if copies:
        lines.append(f"\n  Copies:")
        for c in copies:
            lines.append(f"    {c}")

    related = data.get("detailedRelatedMaterial", [])
    if related:
        lines.append(f"\n  Related material:")
        for r in related:
            lines.append(f"    {r}")

    lines.append(f"\n  {'ID':25s}  {rec_id}")
    if parent_id:
        lines.append(f"  {'Parent ID':25s}  {parent_id}")

    web_url = f"https://discovery.nationalarchives.gov.uk/details/r/{rec_id}"
    lines.append(f"\n  {web_url}")

    if digitised:
        download_url = f"https://discovery.nationalarchives.gov.uk/details/r/{rec_id}#imageViewerLink"
        lines.append(f"  Image viewer: {download_url}")

    lines.append("")
    return "\n".join(lines)


def run_detail(args: argparse.Namespace) -> None:
    rec_id = args.record_id
    url = f"{DETAIL_URL}/{rec_id}"
    data = _api_get(url)

    if args.json:
        json.dump(data, sys.stdout, indent=2)
        print()
        return

    print(_format_detail(data))


# ══════════════════════════════════════════════════════════════════════════════
#  CHILDREN  (browse sub-records of a parent)
# ══════════════════════════════════════════════════════════════════════════════

def run_children(args: argparse.Namespace) -> None:
    parent_id = args.parent_id
    limit = getattr(args, "limit", 40) or 40
    url = f"{CHILDREN_URL}/{parent_id}?limit={limit}"

    if getattr(args, "batch_start", None):
        url += f"&batchStartMark={args.batch_start}"

    data = _api_get(url)

    if args.json:
        json.dump(data, sys.stdout, indent=2)
        print()
        return

    assets = data.get("assets", [])
    if not assets:
        print(f"No children found for {parent_id}", file=sys.stderr)
        return

    print(f"── Children of {parent_id} ({len(assets)} shown) ──\n")
    for rec in assets:
        ref = rec.get("citableReference", "")
        dates = rec.get("coveringDates", "")
        scope = rec.get("scopeContent", {})
        desc = _strip_xml(scope.get("description", "")) if isinstance(scope, dict) else ""
        title = rec.get("title", "") or ""
        display = desc or title
        rec_id = rec.get("id", "")
        digitised = rec.get("digitised", False)
        dig_tag = " 📄" if digitised else ""

        print(f"  {ref}{dig_tag}")
        print(f"    {dates}")
        if display:
            print(f"    {display[:150]}")
        print(f"    ID: {rec_id}")
        print()

    next_mark = data.get("nextBatchMark", "")
    if next_mark:
        print(f"  … more results: use --batch-start \"{next_mark}\"\n")


# ══════════════════════════════════════════════════════════════════════════════
#  DOWNLOAD  (digitised record image via TNA viewer)
# ══════════════════════════════════════════════════════════════════════════════

def run_download(args: argparse.Namespace) -> None:
    import os

    rec_id = args.record_id
    url = f"{DETAIL_URL}/{rec_id}"
    data = _api_get(url)

    if not data.get("digitised"):
        print(f"Record {rec_id} is not digitised — no image available.", file=sys.stderr)
        sys.exit(1)

    ref = data.get("citableReference", "")
    print(f"Record {ref} ({rec_id}) is digitised.")
    print(f"  View online: https://discovery.nationalarchives.gov.uk/details/r/{rec_id}")
    print(f"\n  TNA digitised records are served via their document reader.")
    print(f"  For HO 1 (naturalisation) records, the download URL pattern is:")
    ref_clean = ref.replace(" ", "/").replace("/", "_")
    print(f"  https://www.nationalarchives.gov.uk/catalogue/download?ref={ref.replace(' ', '+')}")
    print(f"\n  Or browse directly:")
    print(f"  https://discovery.nationalarchives.gov.uk/details/r/{rec_id}#imageViewerLink")


# ══════════════════════════════════════════════════════════════════════════════
#  CLI
# ══════════════════════════════════════════════════════════════════════════════

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Query The National Archives Discovery catalogue",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=textwrap.dedent("""\
            examples:
              %(prog)s search Knecht
              %(prog)s search "George Knecht" --department HO --date-from 1850 --date-to 1900
              %(prog)s search Evans --last-name Evans --department RG -v --facets
              %(prog)s detail C7313741
              %(prog)s children C4290179
              %(prog)s download C7313741
        """),
    )
    parser.add_argument("--json", action="store_true", help="Dump raw JSON response")
    sub = parser.add_subparsers(dest="command", required=True)

    # ── search ────────────────────────────────────────────────────────────────
    srch = sub.add_parser("search", help="Search the TNA Discovery catalogue")
    srch.add_argument("query", help="Free-text search query")
    srch.add_argument("--last-name", help="Surname filter")
    srch.add_argument("--first-name", help="Given name filter")
    srch.add_argument("--date-from", type=int, help="Start year (e.g. 1850)")
    srch.add_argument("--date-to", type=int, help="End year (e.g. 1900)")
    srch.add_argument("--department", help="TNA department code (e.g. HO, RG, PROB, WO)")
    srch.add_argument("--reference", help="Reference number query")
    srch.add_argument("--place", help="Place name filter")
    srch.add_argument("--occupation", help="Occupation filter")
    srch.add_argument("--page", type=int, default=1, help="Results page (default 1)")
    srch.add_argument("--count", type=int, default=20, help="Results per page (max 100)")
    srch.add_argument("-v", "--verbose", action="store_true", help="Show extra detail")
    srch.add_argument("--facets", action="store_true", help="Show facet summary")
    srch.set_defaults(func=run_search)

    # ── detail ────────────────────────────────────────────────────────────────
    det = sub.add_parser("detail", help="Fetch full record detail by ID")
    det.add_argument("record_id", help="Record ID (e.g. C7313741)")
    det.set_defaults(func=run_detail)

    # ── children ──────────────────────────────────────────────────────────────
    ch = sub.add_parser("children", help="Browse children of a parent record")
    ch.add_argument("parent_id", help="Parent record ID")
    ch.add_argument("--limit", type=int, default=40, help="Max children to return (default 40)")
    ch.add_argument("--batch-start", help="Batch start mark for pagination")
    ch.set_defaults(func=run_children)

    # ── download ──────────────────────────────────────────────────────────────
    dl = sub.add_parser("download", help="Get download info for a digitised record")
    dl.add_argument("record_id", help="Record ID (e.g. C7313741)")
    dl.set_defaults(func=run_download)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
