#!/usr/bin/env python3
"""
Query FamilySearch from the command line.

Catalog search:
    python scripts/fs_search.py catalog --surname stump
    python scripts/fs_search.py catalog --place Pag --subject "Church records"

Records search (historical records):
    python scripts/fs_search.py records --surname addobati --place zadar
    python scripts/fs_search.py records --surname Guerino --given Antonio --place Venice --birth-year 1800 --birth-range 15

Browse image collections (unindexed registers):
    python scripts/fs_search.py browse 9R2H-K61:391644801,392276701       # list register groups under Sv. Stošija
    python scripts/fs_search.py browse 9R2H-K61:391644801,392276701 --filter marriage
    python scripts/fs_search.py browse <waypoint> --pos 50                 # get image ARK at position 50
    python scripts/fs_search.py browse <waypoint> --pos 50 --width 1600 -o /tmp/img.jpg

Fetch image by ARK:
    python scripts/fs_search.py fetch 3:1:3QSQ-G99X-PLW3 --width 2000 -o marriage.jpg

Discover waypoint context from an image ARK:
    python scripts/fs_search.py discover 3:1:3QSQ-G99X-26RK

List films for a catalog:
    python scripts/fs_search.py films 674321            # garrison Zara 1814-1913
    python scripts/fs_search.py films 664761            # Sv. Stošija Zadar

Record detail & image (indexed records only):
    python scripts/fs_search.py detail 6YBR-461D
    python scripts/fs_search.py image  6YBR-461D --width 3000 -o baptism.jpg

Token health check:
    python scripts/fs_search.py check

Token refresh:
    Open familysearch.org in Chrome → DevTools → Network → any XHR request →
    copy the Authorization header value (after "Bearer ").
    Paste into FS_BEARER_TOKEN below.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import textwrap
import time
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from urllib.error import HTTPError

# ── Rate limiting ────────────────────────────────────────────────────────────
MIN_REQUEST_INTERVAL = 1.5
_last_request_time: float = 0.0

# ── Endpoints ────────────────────────────────────────────────────────────────
CATALOG_SEARCH_URL = "https://www.familysearch.org/service/search/catalog/v3/search"
RECORDS_SEARCH_URL = "https://www.familysearch.org/service/search/hr/v2/personas"
PLATFORM_RECORDS_URL = "https://www.familysearch.org/platform/records/personas"
WAYPOINT_URL = "https://www.familysearch.org/platform/records/waypoints"
DEEPZOOM_URL = "https://sg30p0.familysearch.org/service/records/storage/deepzoomcloud/dz/v1"

# ── Paste fresh token here ───────────────────────────────────────────────────
FS_BEARER_TOKEN = "p0-rV8j5~axoCt.0JMDHeJ_slO"

_BROWSER_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/146.0.0.0 Safari/537.36"
)

_FS_HEADERS_BASE = {
    "Accept-Language": "en",
    "User-Agent": _BROWSER_UA,
    "x-fs-feature-tag": (
        "das.prod.proxy,dz.prod.proxy, "
        "search.original.gedcomx,search.default.facet.includ"
    ),
}


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
    return FS_BEARER_TOKEN.strip()


def _handle_http_error(exc: HTTPError) -> None:
    err_body = exc.read().decode(errors="replace")[:2000]
    if exc.code == 401:
        print(
            "ERROR: 401 Unauthorized — token has expired.\n"
            "  Copy a fresh Bearer token from FamilySearch DevTools.",
            file=sys.stderr,
        )
        sys.exit(1)
    if exc.code == 403:
        if "blocked by our security service" in err_body.lower() or "errorCode" in err_body:
            print(
                "ERROR: 403 — request blocked by FamilySearch WAF (rate limit).\n"
                "  Wait a minute and try again, or reduce request frequency.",
                file=sys.stderr,
            )
        else:
            print(
                "ERROR: 403 Forbidden — session may have expired or IP blocked.\n"
                "  Try copying a fresh Bearer token.",
                file=sys.stderr,
            )
        sys.exit(1)
    print(f"ERROR: HTTP {exc.code} — {err_body}", file=sys.stderr)
    sys.exit(1)


def _api_get(url: str, *, accept: str = "application/json", referer: str = "") -> dict:
    """GET from a FamilySearch API endpoint."""
    _rate_limit()
    headers = {
        **_FS_HEADERS_BASE,
        "Accept": accept,
        "Authorization": f"Bearer {_token()}",
    }
    if referer:
        headers["Referer"] = referer
    req = Request(url, headers=headers)
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
        _handle_http_error(exc)
        return {}


# ══════════════════════════════════════════════════════════════════════════════
#  CATALOG SEARCH
# ══════════════════════════════════════════════════════════════════════════════

def _build_catalog_params(
    *,
    surname: str | None = None,
    given: str | None = None,
    title: str | None = None,
    author: str | None = None,
    subject: str | None = None,
    place: str | None = None,
    call_number: str | None = None,
    year: int | None = None,
    language: str | None = None,
    fmt: str | None = None,
    availability: str | None = None,
    count: int = 20,
    offset: int = 0,
) -> dict:
    params: dict[str, str | list[str]] = {
        "count": str(count),
        "m.defaultFacets": "on",
        "m.queryRequireDefault": "on",
        "offset": str(offset),
    }
    if surname:
        params["q.surname"] = surname
    if given:
        params["q.givenName"] = given
    if title:
        params["q.title"] = title
    if author:
        params["q.author"] = author
    if subject:
        params["q.subject"] = subject
    if place:
        params["q.place"] = place
    if call_number:
        params["q.callNumber"] = call_number
    if year:
        century = (year // 100) * 100
        params["c.year1"] = "on"
        params["f.year0"] = str(century)
    if language:
        params["c.language1"] = "on"
        params["f.language0"] = language
    if fmt:
        params["c.format_facet"] = "on"
        params["f.format_facet"] = fmt
    if availability:
        params["c.availability"] = "on"
        params["f.availability"] = availability
    return params


def _extract_props(properties: list[dict], prop_type: str) -> list[str]:
    return [p["value"] for p in properties if p.get("type") == prop_type]


def _format_catalog_hit(hit: dict, *, verbose: bool = False) -> str:
    meta = hit.get("metadataHit", {}).get("metadata", {})
    score = hit.get("metadataHit", {}).get("score", 0)

    titles = meta.get("title", [])
    title = titles[0]["value"] if titles else "(untitled)"

    creators = meta.get("creator", [])
    creator_str = "; ".join(creators) if creators else ""

    identifier = meta.get("identifier", {}).get("value", "")
    koha_id = identifier.split("/")[-1] if identifier else ""
    catalog_url = (
        f"https://www.familysearch.org/search/catalog/{koha_id.replace('koha:', '')}"
        if koha_id.startswith("koha:")
        else identifier
    )

    props = meta.get("properties", [])
    matching = _extract_props(props, "org.familysearch.www.catalog.matching_surname")
    surnames = _extract_props(props, "org.familysearch.www.catalog.surname")
    other_surnames = [s for s in surnames if s not in matching]

    repos = meta.get("repositoryCalls", [])
    repo_names = sorted(set(r.get("title", "") for r in repos if r.get("title")))

    lines: list[str] = []
    lines.append(f"  {title}")
    if creator_str:
        lines.append(f"    Author: {creator_str}")
    if matching:
        lines.append(f"    Matched surname: {', '.join(matching)}")
    if other_surnames and verbose:
        display = other_surnames[:10]
        suffix = f" (+{len(other_surnames) - 10} more)" if len(other_surnames) > 10 else ""
        lines.append(f"    Other surnames: {', '.join(display)}{suffix}")
    if repo_names:
        lines.append(f"    Available: {' · '.join(repo_names)}")
    lines.append(f"    {catalog_url}")
    if verbose:
        lines.append(f"    Score: {score}")
    return "\n".join(lines)


def _format_catalog_facets(facets: list[dict]) -> str:
    lines: list[str] = []
    for fg in facets:
        name = fg.get("displayName", "")
        sub = fg.get("facets", [])
        if not sub:
            continue
        lines.append(f"  {name}:")
        for f in sub:
            lines.append(f"    {f['displayName']:30s}  {f['displayCount']}")
    return "\n".join(lines)


def run_catalog(args: argparse.Namespace) -> None:
    has_query = any([
        args.surname, args.given, args.title,
        args.author, args.subject, args.place, args.call_number,
    ])
    if not has_query:
        print("ERROR: Provide at least one search field (--surname, --title, etc.)", file=sys.stderr)
        sys.exit(1)

    count = 20
    offset = (args.page - 1) * count
    shown = 0

    while True:
        params = _build_catalog_params(
            surname=args.surname, given=args.given,
            title=args.title, author=args.author,
            subject=args.subject, place=args.place,
            call_number=args.call_number,
            year=getattr(args, "year", None),
            language=getattr(args, "language", None),
            fmt=getattr(args, "format", None),
            availability=getattr(args, "availability", None),
            count=count, offset=offset,
        )
        url = f"{CATALOG_SEARCH_URL}?{urlencode(params, doseq=True)}"
        data = _api_get(
            url, referer="https://www.familysearch.org/en/search/catalog/results",
        )

        total = data.get("totalHits", 0)
        hits = data.get("searchHits", [])

        if offset == 0:
            print(f"── {total} catalog results ──\n")

        for hit in hits:
            print(_format_catalog_hit(hit, verbose=getattr(args, "verbose", False)))
            print()
            shown += 1

        if not hits or not args.all_pages:
            break
        offset += count
        if offset >= total:
            break

    if shown < total and not args.all_pages:
        print(f"  … showing {shown} of {total} (use --all-pages for all)\n")

    if getattr(args, "facets_summary", False):
        facets = data.get("facets", [])
        if facets:
            print("── Facets ──\n")
            print(_format_catalog_facets(facets))
            print()

    if args.json:
        json.dump(data, sys.stdout, indent=2)
        print()


# ══════════════════════════════════════════════════════════════════════════════
#  RECORDS SEARCH  (historical records — GedcomX)
# ══════════════════════════════════════════════════════════════════════════════

def _build_records_params(
    *,
    surname: str | None = None,
    given: str | None = None,
    place: str | None = None,
    birth_year: int | None = None,
    birth_range: int = 2,
    birth_place: str | None = None,
    death_year: int | None = None,
    death_place: str | None = None,
    marriage_year: int | None = None,
    marriage_place: str | None = None,
    residence_place: str | None = None,
    father_surname: str | None = None,
    father_given: str | None = None,
    mother_surname: str | None = None,
    mother_given: str | None = None,
    spouse_surname: str | None = None,
    spouse_given: str | None = None,
    event_type: str | None = None,
    collection: str | None = None,
    count: int = 20,
    offset: int = 0,
) -> dict:
    params: dict[str, str] = {
        "count": str(count),
        "offset": str(offset),
        "m.defaultFacets": "on",
        "m.facetNestCollectionInCategory": "on",
        "m.queryRequireDefault": "on",
    }
    if surname:
        params["q.surname"] = surname
    if given:
        params["q.givenName"] = given
    if place:
        params["q.anyPlace"] = place
    if birth_year:
        params["q.birthLikeDate.from"] = str(birth_year - birth_range)
        params["q.birthLikeDate.to"] = str(birth_year + birth_range)
    if birth_place:
        params["q.birthLikePlace"] = birth_place
    if death_year:
        params["q.deathLikeDate.from"] = str(death_year - 2)
        params["q.deathLikeDate.to"] = str(death_year + 2)
    if death_place:
        params["q.deathLikePlace"] = death_place
    if marriage_year:
        params["q.marriageLikeDate.from"] = str(marriage_year - 2)
        params["q.marriageLikeDate.to"] = str(marriage_year + 2)
    if marriage_place:
        params["q.marriageLikePlace"] = marriage_place
    if residence_place:
        params["q.residencePlace"] = residence_place
    if father_surname:
        params["q.fatherSurname"] = father_surname
    if father_given:
        params["q.fatherGivenName"] = father_given
    if mother_surname:
        params["q.motherSurname"] = mother_surname
    if mother_given:
        params["q.motherGivenName"] = mother_given
    if spouse_surname:
        params["q.spouseSurname"] = spouse_surname
    if spouse_given:
        params["q.spouseGivenName"] = spouse_given
    if event_type:
        # Collection category IDs used by the FS facet system
        _CATEGORY_MAP = {
            "birth":          "6",   # Birth, Marriage, & Death
            "christening":    "6",
            "baptism":        "6",
            "death":          "6",
            "burial":         "6",
            "marriage":       "6",
            "census":         "1",   # Census & Lists
            "immigration":    "4",   # Immigration & Emigration
            "emigration":     "4",
            "military":       "5",   # Military
            "court":          "2",   # Court, Land, Financial, …
            "probate":        "2",
        }
        cat_id = _CATEGORY_MAP.get(event_type.lower())
        if cat_id:
            params["c.collectionType"] = "on"
            params["f.collectionType"] = cat_id
    if collection:
        params["q.collectionId"] = collection
    return params


# ── GedcomX parsing helpers ──────────────────────────────────────────────────

_TYPE_RE = re.compile(r"(?:http://gedcomx\.org/|http://familysearch\.org/types/facts/)(\w+)")


def _short_type(uri: str) -> str:
    m = _TYPE_RE.search(uri)
    return m.group(1) if m else uri


def _extract_person_summary(person: dict) -> dict:
    """Pull name, facts, and gender from a GedcomX person object."""
    name = ""
    names = person.get("names", [])
    if names:
        forms = names[0].get("nameForms", [])
        if forms:
            name = forms[0].get("fullText", "")

    facts: list[dict[str, str]] = []
    for fact in person.get("facts", []):
        f: dict[str, str] = {"type": _short_type(fact.get("type", ""))}
        date_obj = fact.get("date")
        if date_obj:
            normalized = date_obj.get("normalized", [])
            f["date"] = normalized[0]["value"] if normalized else date_obj.get("original", "")
        place_obj = fact.get("place")
        if place_obj:
            normalized = place_obj.get("normalized", [])
            f["place"] = normalized[0]["value"] if normalized else place_obj.get("original", "")
        if fact.get("primary"):
            f["primary"] = "true"
        facts.append(f)

    gender = ""
    g = person.get("gender")
    if g:
        gender = _short_type(g.get("type", ""))

    return {"name": name, "facts": facts, "gender": gender, "id": person.get("id", "")}


def _extract_collection_info(source_descs: list[dict]) -> dict:
    """Pull collection title and record ARK from sourceDescriptions."""
    collection_title = ""
    record_ark = ""
    person_ark = ""
    collection_id = ""

    for sd in source_descs:
        rt = sd.get("resourceType", "")
        if rt == "http://gedcomx.org/Collection":
            titles = sd.get("titles", [])
            if titles:
                collection_title = titles[0].get("value", "")
            ids = sd.get("identifiers", {}).get("http://gedcomx.org/Primary", [])
            if ids:
                coll_url = ids[0]
                parts = coll_url.rstrip("/").split("/")
                if parts:
                    collection_id = parts[-1]
        elif rt == "http://gedcomx.org/Record":
            ids = sd.get("identifiers", {}).get("http://gedcomx.org/Persistent", [])
            if ids:
                record_ark = ids[0]
        elif rt == "http://gedcomx.org/Person":
            ids = sd.get("identifiers", {}).get("http://gedcomx.org/Persistent", [])
            if ids:
                person_ark = ids[0]

    return {
        "collection": collection_title,
        "collection_id": collection_id,
        "record_ark": record_ark,
        "person_ark": person_ark,
    }


def _format_record_hit(entry: dict, *, verbose: bool = False) -> str:
    entry_id = entry.get("id", "")
    score = entry.get("score", 0)
    gedcomx = entry.get("content", {}).get("gedcomx", {})

    persons = gedcomx.get("persons", [])
    source_descs = gedcomx.get("sourceDescriptions", [])
    relationships = gedcomx.get("relationships", [])

    coll = _extract_collection_info(source_descs)

    principal = None
    others: list[dict] = []
    for p in persons:
        summary = _extract_person_summary(p)
        if p.get("principal"):
            principal = summary
        else:
            others.append(summary)

    if not principal and persons:
        principal = _extract_person_summary(persons[0])

    lines: list[str] = []
    if principal:
        lines.append(f"  {entry_id}  {principal['name']}")

        for fact in principal["facts"]:
            parts = [fact["type"]]
            if fact.get("date"):
                parts.append(fact["date"])
            if fact.get("place"):
                parts.append(fact["place"])
            marker = " *" if fact.get("primary") else ""
            lines.append(f"    {' · '.join(parts)}{marker}")

        if principal["gender"]:
            lines.append(f"    Gender: {principal['gender']}")
    else:
        lines.append(f"  {entry_id}  (no person data)")

    # Relationship context (parents, spouse)
    rel_lines: list[str] = []
    for rel in relationships:
        rel_type = _short_type(rel.get("type", ""))
        p1_ref = rel.get("person1", {}).get("resourceId", "")
        p2_ref = rel.get("person2", {}).get("resourceId", "")
        other_ref = p2_ref if principal and p1_ref == principal["id"] else p1_ref
        other_person = next((o for o in others if o["id"] == other_ref), None)
        if other_person:
            rel_lines.append(f"    {rel_type}: {other_person['name']}")
    if rel_lines:
        for rl in rel_lines:
            lines.append(rl)

    if coll["collection"]:
        lines.append(f"    Collection: {coll['collection']}")

    ark = coll.get("person_ark") or coll.get("record_ark")
    if ark:
        web_url = ark.replace("https://familysearch.org/ark:", "https://www.familysearch.org/ark:")
        lines.append(f"    {web_url}")

    if verbose:
        lines.append(f"    Score: {score:.2f}  |  Collection ID: {coll['collection_id']}")
        if coll["record_ark"]:
            lines.append(f"    Record ARK: {coll['record_ark']}")

    return "\n".join(lines)


def _format_records_facets(facets: list[dict], *, max_items: int = 15, indent: int = 2) -> str:
    lines: list[str] = []
    prefix = " " * indent
    for fg in facets:
        name = fg.get("displayName", "")
        if not name:
            continue
        total = fg.get("displayCount", "")
        lines.append(f"{prefix}{name} ({total}):")
        sub = fg.get("facets", [])
        for f in sub[:max_items]:
            label = f.get("displayName", "")
            cnt = f.get("displayCount", "")
            lines.append(f"{prefix}  {label:45s}  {cnt}")
            nested = f.get("facets", [])
            for nf in nested[:max_items]:
                nlabel = nf.get("displayName", "")
                ncnt = nf.get("displayCount", "")
                lines.append(f"{prefix}    {nlabel:43s}  {ncnt}")
            if len(nested) > max_items:
                lines.append(f"{prefix}    … and {len(nested) - max_items} more")
        if len(sub) > max_items:
            lines.append(f"{prefix}  … and {len(sub) - max_items} more")
    return "\n".join(lines)


def run_records(args: argparse.Namespace) -> None:
    has_query = any([
        args.surname, args.given, args.place,
        getattr(args, "birth_year", None), getattr(args, "birth_place", None),
        getattr(args, "death_year", None), getattr(args, "death_place", None),
        getattr(args, "father_surname", None), getattr(args, "mother_surname", None),
        getattr(args, "spouse_surname", None), getattr(args, "collection", None),
    ])
    if not has_query:
        print("ERROR: Provide at least one search field (--surname, --place, etc.)", file=sys.stderr)
        sys.exit(1)

    count = 20
    offset = (args.page - 1) * count
    shown = 0

    while True:
        params = _build_records_params(
            surname=args.surname, given=args.given, place=args.place,
            birth_year=getattr(args, "birth_year", None),
            birth_range=getattr(args, "birth_range", 2) or 2,
            birth_place=getattr(args, "birth_place", None),
            death_year=getattr(args, "death_year", None),
            death_place=getattr(args, "death_place", None),
            marriage_year=getattr(args, "marriage_year", None),
            marriage_place=getattr(args, "marriage_place", None),
            residence_place=getattr(args, "residence_place", None),
            father_surname=getattr(args, "father_surname", None),
            father_given=getattr(args, "father_given", None),
            mother_surname=getattr(args, "mother_surname", None),
            mother_given=getattr(args, "mother_given", None),
            spouse_surname=getattr(args, "spouse_surname", None),
            spouse_given=getattr(args, "spouse_given", None),
            event_type=getattr(args, "event_type", None),
            collection=getattr(args, "collection", None),
            count=count, offset=offset,
        )
        url = f"{RECORDS_SEARCH_URL}?{urlencode(params)}"
        data = _api_get(
            url,
            accept="application/x-gedcomx-v1+json, application/json",
            referer="https://www.familysearch.org/en/search/record/results",
        )

        total = data.get("results", 0)
        entries = data.get("entries", [])

        if offset == 0:
            print(f"── {total} record results ──\n")

        for entry in entries:
            print(_format_record_hit(entry, verbose=getattr(args, "verbose", False)))
            print()
            shown += 1

        if not entries or not args.all_pages:
            break
        offset += count
        if offset >= total:
            break

    if shown < total and not args.all_pages:
        print(f"  … showing {shown} of {total} (use --all-pages for all)\n")

    if getattr(args, "facets_summary", False):
        facets = data.get("facets", [])
        if facets:
            print("── Facets ──\n")
            print(_format_records_facets(facets))
            print()

    if args.json:
        json.dump(data, sys.stdout, indent=2)
        print()


# ══════════════════════════════════════════════════════════════════════════════
#  RECORD DETAIL  (platform API → full transcript)
# ══════════════════════════════════════════════════════════════════════════════

def _fetch_record_detail(person_id: str) -> dict:
    url = f"{PLATFORM_RECORDS_URL}/{person_id}"
    return _api_get(
        url,
        accept="application/x-gedcomx-v1+json, application/json",
        referer=f"https://www.familysearch.org/ark:/61903/1:1:{person_id}",
    )


def _find_image_ark(data: dict) -> str | None:
    for sd in data.get("sourceDescriptions", []):
        if sd.get("resourceType") == "http://gedcomx.org/DigitalArtifact":
            about = sd.get("about", "")
            if "/ark:/61903/" in about:
                return about.split("/ark:/61903/")[-1]
    return None


def _format_detail(data: dict, person_id: str) -> str:
    persons = data.get("persons", [])
    relationships = data.get("relationships", [])
    source_descs = data.get("sourceDescriptions", [])

    coll = _extract_collection_info(source_descs)
    image_ark = _find_image_ark(data)

    summaries: list[dict] = []
    for p in persons:
        summaries.append(_extract_person_summary(p))

    lines: list[str] = []
    for i, s in enumerate(summaries):
        if i == 0:
            lines.append(f"── {s['name']} [{person_id}] ──\n")
        else:
            lines.append(f"\n  ── {s['name']} ──")

        if s["gender"]:
            lines.append(f"    {'Gender':25s}  {s['gender']}")
        for fact in s["facts"]:
            label = fact["type"]
            parts: list[str] = []
            if fact.get("date"):
                parts.append(fact["date"])
            if fact.get("place"):
                parts.append(fact["place"])
            val = " · ".join(parts) if parts else ""
            marker = " *" if fact.get("primary") else ""
            lines.append(f"    {label:25s}  {val}{marker}")

    for rel in relationships:
        rel_type = _short_type(rel.get("type", ""))
        p1_ref = rel.get("person1", {}).get("resourceId", "")
        p2_ref = rel.get("person2", {}).get("resourceId", "")
        p1_name = next((s["name"] for s in summaries if s["id"] == p1_ref), p1_ref)
        p2_name = next((s["name"] for s in summaries if s["id"] == p2_ref), p2_ref)
        lines.append(f"    {rel_type:25s}  {p1_name} → {p2_name}")

    if coll["collection"]:
        lines.append(f"\n    {'Collection':25s}  {coll['collection']}")
    if coll["collection_id"]:
        lines.append(f"    {'Collection ID':25s}  {coll['collection_id']}")
    if image_ark:
        lines.append(f"    {'Image ARK':25s}  {image_ark}")

    citations = []
    for sd in source_descs:
        for c in sd.get("citations", []):
            if c.get("value"):
                citations.append(c["value"])
    if citations:
        lines.append(f"\n    Citation:")
        for cit in citations[:1]:
            clean = re.sub(r"</?i>", "", cit)
            lines.append(f"      {clean}")

    person_url = f"https://www.familysearch.org/ark:/61903/1:1:{person_id}"
    lines.append(f"\n    {person_url}")
    lines.append("")
    return "\n".join(lines)


def run_detail(args: argparse.Namespace) -> None:
    person_id = args.person_id
    data = _fetch_record_detail(person_id)

    if args.json:
        json.dump(data, sys.stdout, indent=2)
        print()
        return

    if not data.get("persons"):
        print(f"No data returned for {person_id}", file=sys.stderr)
        sys.exit(1)

    print(_format_detail(data, person_id))


# ══════════════════════════════════════════════════════════════════════════════
#  IMAGE DOWNLOAD  (deepzoom scaled JPEG)
# ══════════════════════════════════════════════════════════════════════════════

def _check_image_access(image_ark: str) -> bool:
    """Return True if the image is downloadable (not restricted to FHC)."""
    _rate_limit()
    url = f"https://www.familysearch.org/platform/records/images/{image_ark}"
    req = Request(url, headers={
        **_FS_HEADERS_BASE,
        "Accept": "application/json",
        "Authorization": f"Bearer {_token()}",
    })
    try:
        with urlopen(req) as resp:
            data = json.loads(resp.read())
            rights = (data.get("sourceDescriptions") or [{}])[0].get("rights", [])
            if rights and "restricted=true" in rights[0] and "authorized=false" in rights[0]:
                print(
                    "WARNING: Image restricted to FamilySearch Centers / affiliate libraries.\n"
                    "  Download may fail or return a placeholder.",
                    file=sys.stderr,
                )
                return False
            return True
    except HTTPError:
        return True


def _download_fs_image(image_ark: str, output_path: str, width: int = 2000) -> str:
    _check_image_access(image_ark)

    _rate_limit()
    url = f"{DEEPZOOM_URL}/{image_ark}/scale?width={width}"
    req = Request(
        url,
        headers={
            "Authorization": f"Bearer {_token()}",
            "User-Agent": _BROWSER_UA,
            "Referer": "https://www.familysearch.org/",
        },
    )
    try:
        with urlopen(req) as resp:
            img_data = resp.read()
            if len(img_data) < 1000:
                print(
                    f"WARNING: Image is only {len(img_data)} bytes — may be restricted.",
                    file=sys.stderr,
                )
            os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
            with open(output_path, "wb") as f:
                f.write(img_data)
        return output_path
    except HTTPError as exc:
        _handle_http_error(exc)
        return ""


def run_image(args: argparse.Namespace) -> None:
    person_id = args.person_id
    width = getattr(args, "width", 2000) or 2000

    print(f"Fetching record detail for {person_id}…")
    data = _fetch_record_detail(person_id)

    image_ark = _find_image_ark(data)
    if not image_ark:
        print(f"No image found for record {person_id}", file=sys.stderr)
        sys.exit(1)

    out = getattr(args, "output", None)
    if not out:
        out = f"fs_{person_id}.jpg"

    print(f"Downloading image {image_ark} ({width}px wide) → {out}")
    _download_fs_image(image_ark, out, width=width)
    size_kb = os.path.getsize(out) / 1024
    print(f"  Saved {size_kb:.0f} KB → {out}")


# ══════════════════════════════════════════════════════════════════════════════
#  BROWSE  (waypoint hierarchy navigation)
# ══════════════════════════════════════════════════════════════════════════════

def _get_waypoints(wc: str, cc: str, start: int = 0, count: int = 100) -> dict:
    url = f"{WAYPOINT_URL}/{wc}?cc={cc}&start={start}&count={count}"
    return _api_get(url, referer="https://www.familysearch.org/")


def _parse_waypoint_children(data: dict) -> list[dict]:
    children = []
    for sd in data.get("sourceDescriptions", []):
        title = ""
        for t in sd.get("titles", []):
            title = t.get("value", "")
        wc_child = ""
        child_count = 0
        for ext_val in sd.get("extensions", {}).values():
            if isinstance(ext_val, dict):
                wc_child = ext_val.get("waypointContext", wc_child)
                child_count = ext_val.get("count", child_count)
        about = sd.get("about", "")
        ark = ""
        if "ark:/61903/" in about:
            ark = about.split("ark:/61903/")[1].split("?")[0]
        if title or ark:
            children.append({
                "title": title,
                "wc": wc_child,
                "count": child_count,
                "ark": ark,
            })
    return children


def run_browse(args: argparse.Namespace) -> None:
    wc = args.waypoint
    cc = args.collection

    pos = getattr(args, "pos", None)
    if pos is not None:
        data = _get_waypoints(wc, cc, start=pos, count=1)
        children = _parse_waypoint_children(data)
        ark = None
        for child in children:
            if child["ark"]:
                ark = child["ark"]
                break
        if not ark:
            for sd in data.get("sourceDescriptions", []):
                about = sd.get("about", "")
                if "3:1:" in about:
                    ark = about.split("ark:/61903/")[1].split("?")[0]
                    break
        if ark:
            cat = getattr(args, "catalog", None) or "664761"
            fs_url = f"https://www.familysearch.org/ark:/61903/{ark}?cat={cat}&i={pos}&lang=en"
            print(f"Position {pos}")
            print(f"  ARK: {ark}")
            print(f"  URL: {fs_url}")
            width = getattr(args, "width", None)
            out = getattr(args, "output", None)
            if out or width:
                width = width or 1600
                out = out or f"/tmp/fs_browse/pos{pos}.jpg"
                _download_fs_image(ark, out, width=width)
                size_kb = os.path.getsize(out) / 1024
                print(f"  Downloaded: {out} ({size_kb:.0f} KB)")
        else:
            print("No image found at this position.", file=sys.stderr)
            sys.exit(1)
        return

    data = _get_waypoints(wc, cc, start=0, count=200)
    children = _parse_waypoint_children(data)

    filt = getattr(args, "filter", None)
    shown = 0
    for i, child in enumerate(children):
        if filt and filt.lower() not in child["title"].lower():
            continue
        title = child["title"] or "(image)"
        parts = [f"  [{i:3d}] {title}"]
        if child["count"]:
            parts.append(f"({child['count']} images)")
        if child["wc"]:
            parts.append(f"\n        WC: {child['wc']}")
        if child["ark"]:
            parts.append(f"\n        ARK: {child['ark']}")
        print(" ".join(parts))
        shown += 1

    if shown == 0 and filt:
        print(f"No results matching '{filt}'.", file=sys.stderr)
    elif shown == 0:
        print("No children found at this waypoint level.", file=sys.stderr)
        if args.json:
            json.dump(data, sys.stdout, indent=2)
            print()


# ══════════════════════════════════════════════════════════════════════════════
#  FETCH  (download image by ARK directly)
# ══════════════════════════════════════════════════════════════════════════════

def _discover_waypoint_from_ark(image_ark: str) -> dict:
    """Given an image ARK, return its waypoint context, offset, and total count."""
    url = f"https://www.familysearch.org/platform/records/images/{image_ark}"
    data = _api_get(url, referer="https://www.familysearch.org/")
    links = data.get("links", {})
    self_link = links.get("self", {})
    href = self_link.get("href", "")
    offset = self_link.get("offset", 0)
    results = self_link.get("results", 0)

    wc = ""
    if "wc=" in href:
        import urllib.parse as _up
        parsed = _up.urlparse(href)
        qs = _up.parse_qs(parsed.query)
        wc_list = qs.get("wc", [])
        if wc_list:
            wc = _up.unquote(wc_list[0])

    prev_ark = ""
    prev_href = links.get("prev", {}).get("href", "")
    if prev_href and "ark:/61903/" in prev_href:
        prev_ark = prev_href.split("ark:/61903/")[1].split("?")[0]

    next_ark = ""
    next_href = links.get("next", {}).get("href", "")
    if next_href and "ark:/61903/" in next_href:
        next_ark = next_href.split("ark:/61903/")[1].split("?")[0]

    return {
        "wc": wc, "offset": offset, "results": results,
        "prev_ark": prev_ark, "next_ark": next_ark,
    }


def run_discover(args: argparse.Namespace) -> None:
    ark = args.ark
    info = _discover_waypoint_from_ark(ark)
    print(f"Image: {ark}")
    print(f"  Waypoint context: {info['wc']}")
    print(f"  Position: {info['offset']} of {info['results']}")
    if info["prev_ark"]:
        print(f"  Prev: {info['prev_ark']}")
    if info["next_ark"]:
        print(f"  Next: {info['next_ark']}")

    if info["wc"]:
        data = _get_waypoints(info["wc"], "2040054", start=0, count=5)
        children = _parse_waypoint_children(data)
        for child in children:
            if child["title"]:
                print(f"  Group: {child['title']}")
                break


def run_fetch(args: argparse.Namespace) -> None:
    ark = args.ark
    width = getattr(args, "width", 2000) or 2000
    out = getattr(args, "output", None) or f"fs_{ark.replace(':', '_').replace('-', '')}.jpg"

    print(f"Downloading {ark} ({width}px)…")
    _download_fs_image(ark, out, width=width)
    size_kb = os.path.getsize(out) / 1024
    print(f"  Saved {size_kb:.0f} KB → {out}")


# ══════════════════════════════════════════════════════════════════════════════
#  CHECK  (token health)
# ══════════════════════════════════════════════════════════════════════════════

def run_check(args: argparse.Namespace) -> None:
    url = "https://www.familysearch.org/platform/users/current"
    try:
        data = _api_get(url, referer="https://www.familysearch.org/")
        users = data.get("users", [])
        if users:
            user = users[0]
            name = user.get("contactName", user.get("displayName", "unknown"))
            uid = user.get("id", "")
            print(f"Token OK — logged in as: {name} (id: {uid})")
        else:
            print("Token OK — authenticated (no user details returned)")
    except SystemExit:
        pass


# ══════════════════════════════════════════════════════════════════════════════
#  FILMS  (catalog → film list → waypoint contexts)
# ══════════════════════════════════════════════════════════════════════════════

CATALOG_DETAIL_URLS = [
    "https://www.familysearch.org/service/search/catalog/v4/catalogRecord",
    "https://www.familysearch.org/service/search/catalog/v3/catalogRecord",
]


def _fetch_catalog_detail(catalog_id: str) -> dict:
    """Fetch catalog record detail by ID, including film/item list.

    Tries multiple API versions since FamilySearch retires endpoints without
    notice.  Falls back to scraping embedded JSON from the catalog web page.
    """
    referer = f"https://www.familysearch.org/search/catalog/{catalog_id}"

    for base in CATALOG_DETAIL_URLS:
        _rate_limit()
        url = f"{base}/{catalog_id}"
        headers = {
            **_FS_HEADERS_BASE,
            "Accept": "application/json",
            "Authorization": f"Bearer {_token()}",
            "Referer": referer,
        }
        req = Request(url, headers=headers)
        try:
            with urlopen(req) as resp:
                return json.loads(resp.read())
        except HTTPError as exc:
            if exc.code == 404:
                continue
            _handle_http_error(exc)
            return {}

    # All versioned endpoints failed — try the web page for embedded JSON
    _rate_limit()
    web_url = f"https://www.familysearch.org/search/catalog/{catalog_id}"
    web_req = Request(web_url, headers={
        **_FS_HEADERS_BASE,
        "Accept": "text/html",
        "Authorization": f"Bearer {_token()}",
    })
    try:
        with urlopen(web_req) as resp:
            html = resp.read().decode(errors="replace")
        m = re.search(r'window\.__INITIAL_STATE__\s*=\s*({.+?});', html)
        if m:
            state = json.loads(m.group(1))
            record = state.get("catalogRecord", state)
            if isinstance(record, dict) and ("repositoryCalls" in record or "title" in record):
                return record
    except (HTTPError, json.JSONDecodeError):
        pass

    print(
        f"ERROR: Could not fetch catalog detail for {catalog_id}.\n"
        f"  The FamilySearch catalog detail API has changed.\n"
        f"  Try browsing https://www.familysearch.org/search/catalog/{catalog_id}\n"
        f"  and use 'browse' with the waypoint context shown on that page.",
        file=sys.stderr,
    )
    sys.exit(1)


def _parse_catalog_films(data: dict) -> list[dict]:
    """Extract browsable films/items from a catalog detail response."""
    films: list[dict] = []
    for repo in data.get("repositoryCalls", []):
        repo_name = repo.get("title", "")
        for item in repo.get("items", []):
            title = item.get("title", "")
            call_number = item.get("callNumber", "")
            notes = item.get("notes", [])
            note_text = "; ".join(n.get("value", "") for n in notes) if notes else ""
            dgs = item.get("dgsNumber", "") or item.get("digitalGroupSetNumber", "")
            film_number = item.get("filmNumber", "") or call_number
            online = item.get("isOnline", False)
            wc = ""
            for wp in item.get("waypoints", []):
                wc = wp.get("waypointContext", "")
                break
            cc = ""
            for wp in item.get("waypoints", []):
                cc = wp.get("collectionContext", "") or wp.get("collectionId", "")
                break
            image_count = item.get("imageCount", 0)
            films.append({
                "title": title,
                "callNumber": call_number,
                "dgs": dgs,
                "filmNumber": film_number,
                "online": online,
                "wc": wc,
                "cc": cc,
                "imageCount": image_count,
                "note": note_text,
                "repo": repo_name,
            })
    return films


def run_films(args: argparse.Namespace) -> None:
    catalog_id = args.catalog_id
    print(f"Fetching catalog detail for {catalog_id}…")
    data = _fetch_catalog_detail(catalog_id)

    if args.json:
        json.dump(data, sys.stdout, indent=2)
        print()
        return

    title = data.get("title", "(unknown)")
    print(f"\n  {title}")
    authors = data.get("creator", [])
    if authors:
        print(f"  Author: {'; '.join(authors)}")
    print()

    films = _parse_catalog_films(data)
    if not films:
        print("No films/items found. Dumping raw keys for inspection:")
        print(f"  Top-level keys: {list(data.keys())}")
        if "repositoryCalls" in data:
            for i, repo in enumerate(data["repositoryCalls"]):
                print(f"  repo[{i}] keys: {list(repo.keys())}")
                for j, item in enumerate(repo.get("items", [])[:3]):
                    print(f"    item[{j}] keys: {list(item.keys())}")
        return

    for i, film in enumerate(films):
        status = "ONLINE" if film["online"] else "offline"
        parts = [f"  [{i:2d}] {film['title'] or '(untitled)'}  [{status}]"]
        if film["callNumber"]:
            parts.append(f"\n       Call#: {film['callNumber']}")
        if film["dgs"]:
            parts.append(f"  DGS: {film['dgs']}")
        if film["filmNumber"] and film["filmNumber"] != film["callNumber"]:
            parts.append(f"  Film: {film['filmNumber']}")
        if film["imageCount"]:
            parts.append(f"  ({film['imageCount']} images)")
        if film["wc"]:
            parts.append(f"\n       WC: {film['wc']}")
        if film["cc"]:
            parts.append(f"  CC: {film['cc']}")
        if film["note"]:
            parts.append(f"\n       Note: {film['note']}")
        print("".join(parts))
        print()


# ══════════════════════════════════════════════════════════════════════════════
#  CLI
# ══════════════════════════════════════════════════════════════════════════════

def _add_common_args(sp: argparse.ArgumentParser) -> None:
    sp.add_argument("--page", type=int, default=1, help="Start page (default 1)")
    sp.add_argument("--all-pages", action="store_true", help="Fetch all pages")
    sp.add_argument("--facets", dest="facets_summary", action="store_true",
                     help="Show facet summary")
    sp.add_argument("-v", "--verbose", action="store_true", help="Show extra detail")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Query FamilySearch APIs",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=textwrap.dedent("""\
            examples:
              %(prog)s catalog --surname stump
              %(prog)s catalog --title "parish registers" --place limerick
              %(prog)s records --surname addobati --place zadar
              %(prog)s records --surname lewis --given david --birth-place "merthyr tydfil"
              %(prog)s records --surname roche --place limerick --event-type birth --facets
              %(prog)s detail  6YBR-461D
              %(prog)s image   6YBR-461D --width 3000 -o baptism.jpg
        """),
    )
    parser.add_argument("--json", action="store_true", help="Dump raw JSON response")
    sub = parser.add_subparsers(dest="command", required=True)

    # ── catalog ──────────────────────────────────────────────────────────────
    cat = sub.add_parser("catalog", help="Search the FamilySearch library catalog")
    cat.add_argument("--surname", help="Surname to search")
    cat.add_argument("--given", help="Given / first name")
    cat.add_argument("--title", help="Title of publication or record set")
    cat.add_argument("--author", help="Author / creator name")
    cat.add_argument("--subject", help="Subject heading")
    cat.add_argument("--place", help="Place name filter")
    cat.add_argument("--call-number", help="Film / fiche / call number")
    cat.add_argument("--year", type=int, help="Filter by century (e.g. 1800 → 1800s)")
    cat.add_argument("--language", help="Language filter (e.g. English, German)")
    cat.add_argument("--format", help="Format filter (e.g. Book, 'Microfilm 35mm')")
    cat.add_argument("--availability",
                      help="Availability filter (e.g. Online, 'FamilySearch Library')")
    _add_common_args(cat)
    cat.set_defaults(func=run_catalog)

    # ── records ──────────────────────────────────────────────────────────────
    rec = sub.add_parser("records", help="Search historical records (GedcomX)")
    rec.add_argument("--surname", help="Surname")
    rec.add_argument("--given", help="Given / first name")
    rec.add_argument("--place", help="Any place (event, birth, death, residence)")
    rec.add_argument("--birth-year", type=int, help="Birth year (±range)")
    rec.add_argument("--birth-range", type=int, default=2,
                      help="Years ± around birth year (default 2)")
    rec.add_argument("--birth-place", help="Birth place")
    rec.add_argument("--death-year", type=int, help="Death year (±2)")
    rec.add_argument("--death-place", help="Death place")
    rec.add_argument("--marriage-year", type=int, help="Marriage year (±2)")
    rec.add_argument("--marriage-place", help="Marriage place")
    rec.add_argument("--residence-place", help="Residence place")
    rec.add_argument("--father-surname", help="Father's surname")
    rec.add_argument("--father-given", help="Father's given name")
    rec.add_argument("--mother-surname", help="Mother's surname")
    rec.add_argument("--mother-given", help="Mother's given name")
    rec.add_argument("--spouse-surname", help="Spouse's surname")
    rec.add_argument("--spouse-given", help="Spouse's given name")
    rec.add_argument("--event-type",
                      help="Record type: birth, christening, death, burial, "
                           "marriage, census, immigration, military, naturalization")
    rec.add_argument("--collection", help="FamilySearch collection ID (e.g. 1803754)")
    _add_common_args(rec)
    rec.set_defaults(func=run_records)

    # ── detail ───────────────────────────────────────────────────────────────
    det = sub.add_parser("detail", help="Fetch full record detail by person ID")
    det.add_argument("person_id", help="Person ID from search results (e.g. 6YBR-461D)")
    det.set_defaults(func=run_detail)

    # ── image ────────────────────────────────────────────────────────────────
    img = sub.add_parser("image", help="Download the source image for a record")
    img.add_argument("person_id", help="Person ID from search results (e.g. 6YBR-461D)")
    img.add_argument("--width", type=int, default=2000,
                      help="Image width in px (default 2000)")
    img.add_argument("-o", "--output", help="Output file path (default: fs_<id>.jpg)")
    img.set_defaults(func=run_image)

    # ── browse ─────────────────────────────────────────────────────────────
    brw = sub.add_parser("browse", help="Browse image collections via waypoint hierarchy",
                          formatter_class=argparse.RawDescriptionHelpFormatter,
                          epilog=textwrap.dedent("""\
        examples:
          %(prog)s browse 9R2H-K61:391644801,392276701              # list register groups
          %(prog)s browse 9R2H-K61:391644801,392276701 --filter mar  # filter by keyword
          %(prog)s browse <wc> --pos 50                              # get image at position
          %(prog)s browse <wc> --pos 50 --width 1600 -o img.jpg      # download it too
    """))
    brw.add_argument("waypoint", help="Waypoint context (e.g. 9R2H-K61:391644801,392276701)")
    brw.add_argument("--collection", default="2040054",
                      help="Collection ID (default: 2040054 = Croatia Church Books)")
    brw.add_argument("--catalog", help="Catalog ID for URL construction (default: 664761)")
    brw.add_argument("--filter", help="Filter results by keyword (case-insensitive)")
    brw.add_argument("--pos", type=int, help="Fetch image at this position (0-based)")
    brw.add_argument("--width", type=int, help="Download width in px (triggers download)")
    brw.add_argument("-o", "--output", help="Output file path for downloaded image")
    brw.set_defaults(func=run_browse)

    # ── discover ───────────────────────────────────────────────────────────
    disc = sub.add_parser("discover", help="Discover waypoint context from an image ARK")
    disc.add_argument("ark", help="Image ARK (e.g. 3:1:3QSQ-G99X-26RK)")
    disc.set_defaults(func=run_discover)

    # ── fetch ──────────────────────────────────────────────────────────────
    ftch = sub.add_parser("fetch", help="Download an image directly by ARK")
    ftch.add_argument("ark", help="Image ARK (e.g. 3:1:3QSQ-G99X-PLW3)")
    ftch.add_argument("--width", type=int, default=2000,
                       help="Image width in px (default 2000)")
    ftch.add_argument("-o", "--output", help="Output file path (default: fs_<ark>.jpg)")
    ftch.set_defaults(func=run_fetch)

    # ── films ──────────────────────────────────────────────────────────────
    flm = sub.add_parser("films", help="List films / DGS numbers for a catalog ID",
                          formatter_class=argparse.RawDescriptionHelpFormatter,
                          epilog=textwrap.dedent("""\
        examples:
          %(prog)s films 674321                  # list films for Austrian garrison Zara
          %(prog)s films 664761                  # list films for Sv. Stošija Zadar
          %(prog)s films 674321 --json           # dump raw catalog detail JSON
    """))
    flm.add_argument("catalog_id", help="FamilySearch catalog number (from catalog URL)")
    flm.set_defaults(func=run_films)

    # ── check ──────────────────────────────────────────────────────────────
    chk = sub.add_parser("check", help="Verify bearer token is still valid")
    chk.set_defaults(func=run_check)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
