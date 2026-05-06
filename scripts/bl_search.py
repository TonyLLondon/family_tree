#!/usr/bin/env python3
"""
Query the British Library catalogue (Primo NDE) from the CLI.

Uses the signed-in JSON endpoint (same Bearer as the catalogue web app).

Token refresh:
    Open catalogue.bl.uk in Chrome → DevTools → Network → a primaws request →
    copy the Authorization header value (after ``Bearer ``).
    Paste into BL_BEARER_TOKEN below (same pattern as FS_BEARER_TOKEN in fs_search.py).

Examples:
    python scripts/bl_search.py search "English amongst the Persians Qajar"
    python scripts/bl_search.py search Denis Wright Persians --limit 5
    python scripts/bl_search.py search "Dr John Cormick" --offset 10 --json
    python scripts/bl_search.py search "IOR/L/PS" --local-first
    python scripts/bl_search.py resolve Denis Wright English amongst Persians 1977
    python scripts/bl_search.py check

Fielded queries (same syntax as Primo):
    python scripts/bl_search.py search --raw-q "creator,contains,Wright Denis"
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import textwrap
import time
from typing import Any
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

# ── Rate limiting ────────────────────────────────────────────────────────────
MIN_REQUEST_INTERVAL = 1.0
_last_request_time: float = 0.0

BL_PRIMO_PNX = "https://catalogue.bl.uk/primaws/rest/pub/pnxs"

BL_INST = "44BL_MAIN"
BL_VID = "44BL_MAIN:BLL01_NDE"


def catalogue_fulldisplay_url(record_id: str, *, context: str, search_scope: str = "MyInst_and_CI") -> str:
    """Canonical catalogue record URL (same screen the short `/permalink/` redirect opens).

    BL short permalinks look like::
        /permalink/44BL_MAIN/<opaque-key>/<alma991...>

    The middle segment is **a hash of view + scope + tab** (cannot be regenerated
    from MMS id alone via the REST API — see Ex Libris “short permalink” docs).
    The permalink chain ends on ``nde/fulldisplay`` with ``docid=`` … which we link
    directly so links work without guessing the opaque key.
    """
    base = "https://catalogue.bl.uk/nde/fulldisplay"
    qs = urlencode(
        {
            "context": context.strip().upper(),
            "vid": BL_VID,
            "search_scope": search_scope,
            "lang": "en",
            "docid": record_id.strip(),
        },
        safe=":+",
    )
    return f"{base}?{qs}"


_BROWSER_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/131.0.0.0 Safari/537.36"
)

BL_BEARER_TOKEN = (
    "eyJraWQiOiJwcmltYVByaXZhdGVLZXktNDRCTF9NQUlOIiwiYWxnIjoiRVMyNTYifQ."
    "eyJpc3MiOiJQcmltYSIsImp0aSI6IjA4NkVFOTQxMzYyRTkxNzJGMEU2NjJERDk3MzlGRjNCLmFw"
    "ZDAyLmV1MDYucHJvZC5hbG1hLmRjMDYuaG9zdGVkLmV4bGlicmlzZ3JvdXAuY29tOjE4MDEiLCJl"
    "eHAiOjE3NzgxNjQ1ODQsImlhdCI6MTc3ODA3ODE4NCwidXNlck5hbWUiOiI3NjYyMTAxIiwiZGlzcGx"
    "heU5hbWUiOiJBbnRob255IExld2lzIiwidXNlciI6IjQwNjY0NjQ5NDYwMDA5MjUxIiwidXNlckdy"
    "b3VwIjoiUmVhZGVyIiwiaW5zdGl0dXRpb24iOiI0NEJMX01BSU4iLCJ1c2VySXAiOiIyMTIuMzYu"
    "MzUuMTEwIiwiYXV0aGVudGljYXRpb25Qcm9maWxlIjoiNDRCTF9TQU1MMl9CMkMiLCJhdXRoZW50"
    "aWNhdGlvblN5c3RlbSI6IlNBTUwiLCJsYW5ndWFnZSI6ImVuIiwic2FtbFNlc3Npb25JbmRleCI6Il"
    "9hZGY5MTdiYy1lZTBjLTQ1ZDQtOTc0Mi1hY2JjYzkwYjAzMDAiLCJzYW1sTmFtZUlkIjoiRU5BUk"
    "JaeldxRUNhNmlPcUp5Z2NTOU1qVnE0dkJXS2dsbFVKeVdzdXZ2TT0iLCJvbmNhbXB1cyI6ImZhbHNl"
    "Iiwic2lnbmVkSW4iOiJ0cnVlIiwidmlld0lkIjoiNDRCTF9NQUlOOkJMTDAxX05ERSIsInNlbGZSZ"
    "Wdpc3RlcmVkIjoiZmFsc2UiLCJyZXN0cmljdGVkVXNlciI6ImZhbHNlIn0."
    "YecyktyXjFZeQlkq8Aw-vJHq6aloqo8W6Zklxtp6OhmVbjf6rkuTRY4Adr7AAW8urUkhu6ezOkm"
    "63dHfcPPjrQ"
)


def _bl_token() -> str:
    return BL_BEARER_TOKEN.replace(" ", "").strip()


def _rate_limit() -> None:
    global _last_request_time
    elapsed = time.monotonic() - _last_request_time
    if _last_request_time and elapsed < MIN_REQUEST_INTERVAL:
        time.sleep(MIN_REQUEST_INTERVAL - elapsed)
    _last_request_time = time.monotonic()


def _bl_headers() -> dict[str, str]:
    return {
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "User-Agent": _BROWSER_UA,
        "Referer": f"https://catalogue.bl.uk/nde/search?vid={quote(BL_VID, safe=':')}&lang=en",
        "Authorization": f"Bearer {_bl_token()}",
    }


def _merge_query_param(
    *,
    scope: str,
    newspapers_active: bool,
    newspapers_search: bool,
    pc_availability: bool,
) -> str:
    """Default Primo blends local + NZ; adjust scope / flags for locality preference.

    NOTE: BL's primaws `/pnxs` returns HTTP 400 for ``scope=MyInst`` alone; keep
    ``MyInst_and_CI`` if you wanted the API to constrain to holdings — filter to
    ``context == \"L\"`` in the CLI instead (--local-first).
    """
    if scope != "MyInst_and_CI":
        return scope
    if newspapers_search:
        return "MyInst_and_CI"
    if not newspapers_active and not pc_availability:
        # Was ``MyInst`` here, but BL rejects it; Primo blend still queries local Alma.
        return "MyInst_and_CI"
    return scope


def build_search_url(
    *,
    query: str,
    limit: int = 25,
    offset: int = 0,
    tab: str = "Everything",
    scope: str = "MyInst_and_CI",
    sort: str = "rank",
    lang: str = "en",
    newspapers_active: bool = True,
    newspapers_search: bool = False,
    pc_availability: bool = False,
    citation_trail_filter: bool = True,
    skip_delivery: str = "Y",
) -> str:
    effective_scope = _merge_query_param(
        scope=scope,
        newspapers_active=newspapers_active,
        newspapers_search=newspapers_search,
        pc_availability=pc_availability,
    )
    params: dict[str, str | int | bool] = {
        "citationTrailFilterByAvailability": str(citation_trail_filter).lower(),
        "disableCache": "false",
        "explain": "",
        "featuredNewspapersIssnList": "",
        "inst": BL_INST,
        "isCDSearch": "false",
        "isRelatedItems": "false",
        "lang": lang,
        "limit": limit,
        "multiFacets": "",
        "newspapersActive": str(newspapers_active).lower(),
        "newspapersSearch": str(newspapers_search).lower(),
        "offset": offset,
        "otbRanking": "",
        "pcAvailability": str(pc_availability).lower(),
        "q": query,
        "qExclude": "",
        "qInclude": "",
        "rapido": "false",
        "refEntryActive": "false",
        "rtaLinks": "true",
        "scope": effective_scope,
        "searchInFulltextUserSelection": "false",
        "skipDelivery": skip_delivery,
        "sort": sort,
        "tab": tab,
        "vid": BL_VID,
    }
    return f"{BL_PRIMO_PNX}?{urlencode(params, safe='', quote_via=quote)}"


def _api_get(url: str) -> dict[str, Any]:
    _rate_limit()
    req = Request(url, headers=_bl_headers())
    try:
        with urlopen(req, timeout=45) as resp:
            raw = resp.read().decode(errors="replace")
            if not raw.strip():
                print(f"ERROR: Empty response from {url[:120]}...", file=sys.stderr)
                sys.exit(1)
            try:
                return json.loads(raw)
            except json.JSONDecodeError:
                print(f"ERROR: Non-JSON:\n{raw[:800]}", file=sys.stderr)
                sys.exit(1)
    except HTTPError as exc:
        body = exc.read().decode(errors="replace")[:2000]
        print(f"ERROR: HTTP {exc.code} — {body}", file=sys.stderr)
        sys.exit(1)
    except URLError as exc:
        print(f"ERROR: Network — {exc}", file=sys.stderr)
        sys.exit(1)


_GOAL_STOP = frozenset(
    {"a", "an", "the", "and", "or", "of", "for", "to", "in", "on", "at", "by", "from", "with"}
)


def pick_record_pair(doc: dict[str, Any]) -> tuple[str | None, str]:
    rid = (((doc.get("pnx") or {}).get("control") or {}).get("recordid"))
    if isinstance(rid, list) and rid:
        rid_s = str(rid[0])
    elif isinstance(rid, str):
        rid_s = rid
    else:
        rid_s = None
    ctx = str(doc.get("context") or "?")
    return rid_s, ctx


def _join_display(pnx_block: dict[str, Any], key: str) -> str:
    disp = pnx_block.get("display") or {}
    parts = disp.get(key) or []
    if isinstance(parts, list):
        return " ".join(str(p) for p in parts).strip()
    return str(parts)


def collect_isbn_digit_runs(goal: str) -> list[str]:
    """Return plausible ISBN digit strings (strip punctuation / X handled elsewhere)."""
    found: list[str] = []
    for m in re.finditer(r"(?:ISBN[- ]*)?(\d{9}[\dXx]|\d{13})\b", goal):
        cand = re.sub(r"[^0-9Xx]", "", m.group(1))
        if len(cand) == 13 or len(cand) == 10:
            found.append(cand.upper())
    # raw long digit runs inside text
    for m in re.finditer(r"\d[\d\s-]{8,}", goal):
        d = re.sub(r"\D", "", m.group(0))
        if len(d) in (10, 13):
            found.append(d)
    out: list[str] = []
    seen: set[str] = set()
    for item in found:
        if item not in seen:
            seen.add(item)
            out.append(item)
    return out


def tokenize_goal(goal: str) -> list[str]:
    words = re.findall(r"[a-zA-Z][a-zA-Z0-9'-]*", goal.lower())
    return [w for w in words if w not in _GOAL_STOP and len(w) >= 3]


def build_resolve_strategies(
    *,
    goal: str,
    creator_opt: str | None,
    title_opt: str | None,
) -> list[tuple[str, str]]:
    """(label, full Primo `q=` value without URL encoding).

    Dedupes identical query strings while preserving coarse-to-fine-ish order."""
    uniq: dict[str, str] = {}

    def add(label: str, q: str) -> None:
        q = q.strip()
        if not q or "," not in q:
            return
        if q not in uniq:
            uniq[q] = label

    g = " ".join(goal.split())
    if g:
        add("any/full-phrase", f"any,contains,{g}")

    for isbn_digits in collect_isbn_digit_runs(goal):
        add("any/isbn", f"any,contains,{isbn_digits}")

    if creator_opt:
        c = creator_opt.strip()
        if c:
            add("creator/explicit-arg", f"creator,contains,{c}")

    if title_opt:
        t = title_opt.strip()
        if t:
            add("title/explicit-arg", f"title,contains,{t}")

    toks = tokenize_goal(goal)
    if len(toks) >= 2:
        add("title/keyword-span", f"title,contains,{' '.join(toks[:min(6, len(toks))])}")
    if len(toks) >= 3:
        # Drop the last token (often a year surrogate) once and retry narrower title.
        add("title/keyword-span-trimmed", f"title,contains,{' '.join(toks[:-1][:6])}")

    rare = sorted({w for w in toks if len(w) >= 6}, key=len, reverse=True)
    for rw in rare[:2]:
        add(f"title/rare-{rw}", f"title,contains,{rw}")

    # First two plausible person-name tokens in reading order (“Denis Wright …”).
    _name_scrub = frozenset(
        {
            "amongst",
            "english",
            "persians",
            "during",
            "period",
            "history",
            "journal",
            "review",
            "introduction",
            "edition",
            "press",
            "london",
            "tehran",
            "persia",
            "iran",
        }
    )
    pro_name = [w for w in toks if w not in _name_scrub and w.isalpha() and len(w) >= 4]
    if len(pro_name) >= 2 and not creator_opt:
        a0, a1 = pro_name[0], pro_name[1]
        add("creator/from-leading-name-hypothesis", f"creator,contains,{a1.title()} {a0.title()}")
        add("creator/surname-hypothesis-second-token", f"creator,contains,{a1.title()}")

    compact = " ".join(toks[:8])
    if compact and compact.lower() != g.lower():
        add("any/compacted-keywords", f"any,contains,{compact}")

    # Stable order following dict insertion Py3.7+
    out: list[tuple[str, str]] = [(uniq[q], q) for q in uniq]
    return out


def _doc_search_blob_lower(doc: dict[str, Any]) -> str:
    pnx = doc.get("pnx") or {}
    parts: list[str] = []
    for key in (
        "title",
        "creator",
        "subject",
        "ispartof",
        "publisher",
        "creationdate",
        "addtitle",
        "general",
        "source",
        "abstract",
        "snippet",
    ):
        parts.append(_strip_primo_subfields(_join_display(pnx, key)))
    return _one_line_rr(" ".join(parts)).lower()


def relevance_score(doc: dict[str, Any], goal_lower: str, tokens: list[str], *, penalise_pc_when_prefer_local: bool) -> float:
    blob = _doc_search_blob_lower(doc)
    ctx = doc.get("context") or ""

    meaningful = sorted(set(tokens), key=lambda w: (-len(w), w))
    if not meaningful:
        meaningful = [_one_line_rr(goal_lower)[:40]]

    hit = 0.0
    for w in meaningful:
        if len(w) < 3:
            continue
        if w in blob:
            hit += 3.8 + min(6.0, len(w)) * 0.15

    # Long-substring overlap with full goal phrase.
    phrase = goal_lower.strip()
    if len(phrase) >= 14 and phrase in blob:
        hit += 16.0
    elif len(phrase) >= 10:
        overlap = False
        for i in range(0, len(phrase) - 9):
            slab = phrase[i : i + 10]
            if slab in blob:
                overlap = True
                break
        if overlap:
            hit += 6.0

    if penalise_pc_when_prefer_local and ctx == "PC":
        hit *= 0.55
    if ctx == "L":
        hit += 2.8

    return hit


def run_resolve(args: argparse.Namespace) -> None:
    goal = " ".join(args.goal_parts).strip()
    if not goal:
        print("ERROR: provide goal words after `resolve`", file=sys.stderr)
        sys.exit(2)

    prefer_local = not args.pc_ok
    penalise_pc = prefer_local

    max_strategies = args.max_strategies
    all_strategies = build_resolve_strategies(
        goal=goal,
        creator_opt=args.creator_hint,
        title_opt=args.title_hint,
    )
    strat = all_strategies[:max_strategies]

    tokens = tokenize_goal(goal)

    trials: list[dict[str, Any]] = []

    sep = args.min_separation
    min_soft = args.min_score
    min_hard = args.min_score_hard
    min_floor = args.min_pick_score

    best_overall: tuple[float, dict[str, Any], str, str] | None = None
    chosen: tuple[float, dict[str, Any], str, str] | None = None

    for label, primq in strat:
        url = build_search_url(
            query=primq,
            limit=min(40, args.resolve_limit),
            offset=0,
            scope="MyInst_and_CI",
            newspapers_active=True,
            newspapers_search=False,
            pc_availability=False,
            skip_delivery="Y",
        )
        data = _api_get(url)
        docs_raw = list(data.get("docs") or [])

        docs = docs_raw[:] if not prefer_local else (
            ([d for d in docs_raw if d.get("context") == "L"] or docs_raw[:])
            + ([d for d in docs_raw if d.get("context") != "L"][: max(8, args.resolve_limit // 3)])
        )

        ranked: list[tuple[float, dict[str, Any]]] = []
        g_low = goal.lower()
        for d in docs:
            ranked.append((relevance_score(d, g_low, tokens, penalise_pc_when_prefer_local=penalise_pc), d))
        ranked.sort(key=lambda t: (-t[0], str(t[1])))

        trials.append(
            {
                "label": label,
                "primq": primq,
                "prim_total": (data.get("info") or {}).get("total"),
                "ranked": ranked[: min(15, len(ranked))],
            }
        )

        if not ranked:
            continue

        top_s, top_d = ranked[0]
        second_s = ranked[1][0] if len(ranked) > 1 else 0.0

        if best_overall is None or top_s > best_overall[0]:
            best_overall = (top_s, top_d, label, primq)

        if chosen is None:
            strong = False
            if top_s >= min_hard:
                strong = True
            elif top_s >= min_soft and (top_s - second_s) >= sep:
                strong = True
            if strong:
                chosen = (top_s, top_d, label, primq)
                break

    final_pick = chosen or best_overall

    if args.json:
        out: dict[str, Any] = {
            "goal": goal,
            "trials": [
                {
                    "label": t["label"],
                    "primq": t["primq"],
                    "prim_total_approx": t.get("prim_total"),
                    "shortlist": [
                        {
                            "score": sc,
                            "context": bd.get("context"),
                            "recordid": pick_record_pair(bd)[0],
                            "title": summarize_doc_header_only(bd),
                        }
                        for sc, bd in t["ranked"][:15]
                    ],
                }
                for t in trials
            ],
        }
        if final_pick and final_pick[0] >= min_floor:
            wrid, wctx = pick_record_pair(final_pick[1])
            out["chosen"] = {
                "strategy": final_pick[2],
                "primq": final_pick[3],
                "score": final_pick[0],
                "recordid": wrid,
                "context": wctx,
                "catalogue_record_url": catalogue_fulldisplay_url(wrid, context=wctx) if wrid else None,
            }
        elif final_pick:
            wrid2, _wctx2 = pick_record_pair(final_pick[1])
            out["chosen"] = {
                "rejected_below_min_pick_score": min_floor,
                "best_score_seen": final_pick[0],
                "recordid_guess": wrid2,
            }
        print(json.dumps(out, indent=2, ensure_ascii=False))
        return

    for t in trials:
        print(f"try [{t['label']}] primq={t['primq']!r}")
        tops = t["ranked"][: min(8, len(t["ranked"]))]
        if not tops:
            print(f"       (empty page; catalogue total≈{t.get('prim_total')})\n")
            continue
        for sc, bd in tops:
            rid0, cx0 = pick_record_pair(bd)
            ttl = summarize_doc_header_only(bd)
            ln = catalogue_fulldisplay_url(rid0, context=cx0) if rid0 else "(missing record id)"
            print(f"       {sc:6.1f}  ({cx0})  {ttl}\n               {ln}")
        print()

    if not final_pick:
        print("FAILED: zero candidates across all PrimWS pulls.", file=sys.stderr)
        sys.exit(4)

    pick_s = final_pick[0]
    if pick_s < min_floor:
        print(
            f"FAILED: best score {pick_s:.2f} stays below refusal floor ({min_floor:.2f}); refine goal / flags.",
            file=sys.stderr,
        )
        sys.exit(5)

    sc, wd, strat_label, primq = final_pick
    wrid, wctx = pick_record_pair(wd)
    if not wrid:
        print("ERROR: top document missing Alma/CDI identifier", file=sys.stderr)
        sys.exit(3)

    title = summarize_doc_header_only(wd)
    meta = summarize_doc_pick_brief(wd)
    print(f"=== PICK [{strat_label}] score={sc:.2f}")
    print(f"    primq={primq!r}")
    print(title)
    if meta:
        print(meta)
    print(catalogue_fulldisplay_url(wrid, context=wctx))


def summarize_doc_header_only(doc: dict[str, Any]) -> str:
    pnx_root = doc.get("pnx") or {}
    title = _one_line_rr(_strip_primo_subfields(_join_display(pnx_root, "title"))) or "(no title)"
    return title


def summarize_doc_pick_brief(doc: dict[str, Any]) -> str:
    pnx_root = doc.get("pnx") or {}
    creator = _one_line_rr(_strip_primo_subfields(_join_display(pnx_root, "creator")))
    publisher = _one_line_rr(_strip_primo_subfields(_join_display(pnx_root, "publisher")))
    dates = _one_line_rr(_strip_primo_subfields(_join_display(pnx_root, "creationdate")))
    parts = []
    if creator:
        parts.append(creator)
    blob = " · ".join(p for p in (dates, publisher) if p)
    if blob:
        parts.append(blob)
    return " · ".join(parts)


def _one_line_rr(s: str) -> str:
    return " ".join(s.split())


def _strip_primo_subfields(s: str) -> str:
    """Remove Primo/internal $$V / $$Q control subfields from display strings."""
    if "$$" not in s:
        return s.strip()
    out: list[str] = []
    for part in re.split(r"\$\$[^$]*", s):
        t = part.strip()
        if t:
            out.append(t)
    return " ".join(out) if out else s.strip()


def summarize_doc(rank: int, doc: dict[str, Any], *, verbose: bool) -> str:
    ctx = doc.get("context", "?")
    pnx_root = doc.get("pnx") or {}
    title = _one_line_rr(_strip_primo_subfields(_join_display(pnx_root, "title"))) or "(no title)"
    typ = _one_line_rr(_strip_primo_subfields(_join_display(pnx_root, "type")))
    creator = _one_line_rr(_strip_primo_subfields(_join_display(pnx_root, "creator")))
    publisher = _one_line_rr(_strip_primo_subfields(_join_display(pnx_root, "publisher")))
    dates = _one_line_rr(_strip_primo_subfields(_join_display(pnx_root, "creationdate")))
    mms_list = (pnx_root.get("display") or {}).get("mms") or []
    recordid = (pnx_root.get("control") or {}).get("recordid")
    sid = ""
    if isinstance(recordid, list) and recordid:
        sid = str(recordid[0])
    elif isinstance(recordid, str):
        sid = recordid

    bits = [
        f"[{rank:3d}] ({ctx}) {title}",
    ]
    if creator:
        bits.append(f"      by {creator}")
    line_meta = []
    if typ:
        line_meta.append(typ)
    if dates:
        line_meta.append(dates)
    if publisher:
        line_meta.append(publisher)
    if line_meta:
        bits.append("      " + " · ".join(line_meta))

    identifiers = []
    if isinstance(mms_list, list) and mms_list:
        identifiers.append(f"mms:{mms_list[0]}")
    if sid:
        identifiers.append(f"record:{sid}")
    if identifiers:
        bits.append("      " + " ".join(identifiers))
    if sid:
        bits.append(catalogue_fulldisplay_url(sid, context=str(ctx)))

    if verbose:
        isp = _one_line_rr(_strip_primo_subfields(_join_display(pnx_root, "ispartof")))
        src = _one_line_rr(_strip_primo_subfields(_join_display(pnx_root, "source")))
        doi = ""
        ids = (pnx_root.get("display") or {}).get("identifier") or []
        if isinstance(ids, list):
            for part in ids:
                if isinstance(part, str) and part.upper().startswith("DOI:"):
                    doi = part
                    break
        if isp:
            bits.append(f"      partof: {isp}")
        if src and ctx == "PC":
            bits.append(f"      via: {src}")
        if doi:
            bits.append(f"      {doi}")
    return "\n".join(bits)


def format_info(info: dict[str, Any]) -> str:
    loc = info.get("totalResultsLocal")
    pc = info.get("totalResultsPC")
    tot = info.get("total")
    first = info.get("first")
    last = info.get("last")
    pc_s = "" if pc in (None, -1) else f", primo_central:{pc}"
    return (
        f"results: total={tot} local={loc}{pc_s} "
        f"window={first}-{last}"
    )


def run_search(args: argparse.Namespace) -> None:
    if args.raw_q:
        q_value = args.raw_q
    else:
        q_value = args.query_str or " ".join(args.query_parts)
        q_value = q_value.strip()
        if not q_value:
            print("ERROR: provide a query string or use --raw-q", file=sys.stderr)
            sys.exit(2)
        q_value = f"any,contains,{q_value}"

    url = build_search_url(
        query=q_value,
        limit=args.limit,
        offset=args.offset,
        tab=args.tab,
        scope=args.scope,
        sort=args.sort,
        newspapers_active=not args.no_newspapers_boost,
        newspapers_search=args.newspapers_search,
        pc_availability=args.pc_availability,
    )
    data = _api_get(url)

    docs = list(data.get("docs") or [])
    if getattr(args, "prefer_local_inst", False):
        docs = [d for d in docs if d.get("context") == "L"]

    if args.json:
        out = dict(data)
        out["docs"] = docs
        print(json.dumps(out, indent=2, ensure_ascii=False))
        return

    info = data.get("info") or {}
    print(format_info(info))
    if getattr(args, "prefer_local_inst", False):
        print("(filtered to British Library holdings: context L)")
    print()
    for i, doc in enumerate(docs, start=1):
        rank = args.offset + i
        print(summarize_doc(rank, doc, verbose=args.verbose))
        print()


def run_check(_args: argparse.Namespace) -> None:
    url = build_search_url(
        query="any,contains,Wright Persians",
        limit=1,
        offset=0,
    )
    data = _api_get(url)
    tot = (data.get("info") or {}).get("total")
    print(f"OK — Primo endpoint reachable (sample total≈{tot}).")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="British Library catalogue search (Primo NDE API)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=textwrap.dedent(f"""\
            Query string is sent as Primo `any,contains,<text>` unless you pass --raw-q.
            Bearer token: edit BL_BEARER_TOKEN in this file when sessions expire.

            Web UI: https://catalogue.bl.uk/nde/search?vid={BL_VID}&lang=en

            examples:
              %(prog)s search "English Amongst the Persians"
              %(prog)s search --raw-q "creator,contains,Wright Denis" --limit 10
              %(prog)s resolve Denis Wright English amongst the Persians 1977
              %(prog)s resolve 0434878200 --creator \"Wright, Denis\"
        """),
    )
    sub = parser.add_subparsers(dest="command", required=True)

    sr = sub.add_parser("search", help="Search the BL catalogue")
    sr.add_argument(
        "query_parts",
        nargs="*",
        help="Words (joined with spaces); use --raw-q instead for fielded queries",
    )
    sr.add_argument("-q", "--query", dest="query_str", help="Whole query string (same as positional words)")
    sr.add_argument(
        "--raw-q",
        help="Pass through full Primo q= value e.g. creator,contains,Surname",
    )
    sr.add_argument("--limit", type=int, default=25, help="Page size (default 25)")
    sr.add_argument("--offset", type=int, default=0, help="Skip first N hits")
    sr.add_argument(
        "--tab",
        default="Everything",
        help="Search tab name (default Everything)",
    )
    sr.add_argument(
        "--scope",
        default="MyInst_and_CI",
        help="Primo scope (default MyInst_and_CI = BL + aggregated)",
    )
    sr.add_argument(
        "--local-first",
        action="store_true",
        dest="prefer_local_inst",
        help="Show only BL holdings (filters results to catalogue context L)",
    )
    sr.add_argument(
        "--newspapers-search",
        action="store_true",
        help="Set newspapersSearch=true on the wire",
    )
    sr.add_argument(
        "--pc-availability",
        action="store_true",
        help="Ask Primo Central for parallel availability snippets",
    )
    sr.add_argument(
        "--no-newspapers-boost",
        action="store_true",
        help="Disable newspapersActive (narrower relevance)",
    )
    sr.add_argument(
        "--sort",
        default="rank",
        help="Sort key (default rank)",
    )
    sr.add_argument(
        "--json",
        action="store_true",
        help="Print raw JSON response (same idea as fs_search.py --json)",
    )
    sr.add_argument("-v", "--verbose", action="store_true", help="Extra fields for remote hits")
    sr.set_defaults(func=run_search)

    rs = sub.add_parser(
        "resolve",
        help="Try serial PrimWS strategies, heuristic-rank docs, emit nde/fulldisplay URLs",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Output links use catalogue record pages (nde/fulldisplay) — the landing target of "
            "short /permalink/<inst>/<key>/alma… embeds whose middle key hashes view+scope+tab."
        ),
    )
    rs.add_argument(
        "goal_parts",
        nargs="+",
        metavar="WORDS",
        help='Ambiguous citation prose (joined); digits trigger ISBN-ish strategies',
    )
    rs.add_argument("--creator", dest="creator_hint", default=None, help="Extra creator clause")
    rs.add_argument("--title", dest="title_hint", default=None, metavar="TITLE", help="Forced title substring")
    rs.add_argument(
        "--pc-ok",
        dest="pc_ok",
        action="store_true",
        help="Treat Primo Central hits like BL-local metadata (no score penalty)",
    )
    rs.add_argument("--max-strategies", dest="max_strategies", type=int, default=16)
    rs.add_argument("--resolve-limit", dest="resolve_limit", type=int, default=25)
    rs.add_argument("--min-score", dest="min_score", type=float, default=18.0)
    rs.add_argument("--min-score-hard", dest="min_score_hard", type=float, default=24.8)
    rs.add_argument("--min-separation", dest="min_separation", type=float, default=3.35)
    rs.add_argument(
        "--min-pick-score",
        dest="min_pick_score",
        type=float,
        default=12.8,
        help="Refuse to commit if no trial exceeds this floor",
    )
    rs.add_argument("--json", action="store_true")
    rs.set_defaults(func=run_resolve)

    ck = sub.add_parser("check", help="Smoke-test the catalogue API")
    ck.set_defaults(func=run_check)

    args = parser.parse_args()

    if getattr(args, "prefer_local_inst", False):
        args.pc_availability = False

    args.func(args)


if __name__ == "__main__":
    main()
