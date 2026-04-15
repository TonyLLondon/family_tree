"use client";

/**
 * Pedigree chart — behaviours requested for this view (see also `web/lib/pedigreeLayout.ts`):
 *
 * - Close (×): remove that person from the chart (URL `dismissed`), not only clear their expansion toggles;
 *   if they are the focus, only collapse descendant-side expansions from that card (cannot remove focus).
 * - Parent / children / siblings / spouse toggles and ×: do not change `focus` in the URL (unlike “Focus here”
 *   and “Line ↓”, which intentionally move focus).
 * - On those control clicks (toggles, ×): avoid a jarring jump — adjust pan (`x`/`y`) so the clicked card’s
 *   centre stays in the same screen position while `k` is unchanged (anchored camera).
 * - “Focus here” and “Line ↓”: set a new focus with a clean branch state (default ancestor depth, no side
 *   branches, cleared dismissed), keep scale, and anchor pan to the target card so the view stays stable.
 * - Pan/zoom (`k`, `x`, `y`) live in the URL for back/forward; any query change reapplies the transform so
 *   layout/framing (`ox`/`oy`) changes cannot desync the camera from the URL.
 * - Reset (zoom controls): reset `k`/`x`/`y` in the URL, clear `dismissed`, apply identity transform immediately.
 */

import * as d3 from "d3";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { FamilyTree } from "@/lib/genealogy";
import {
  collectDirectAncestorIds,
  getChildren,
  getParents,
  lineageChildTowardFocus,
  personSlugFromPage,
  getSiblings,
  getSpouses,
} from "@/lib/genealogy";
import type { PhotoInfo } from "@/lib/photos";
import {
  chartFillFromBirthPlace,
  chartNameFillForSegmentFill,
  chartYearsFillForSegmentFill,
} from "@/lib/birthPlaceChartColors";
import {
  anchoredPedigreePan,
  buildPedigreeScene,
  clonePedigreeUrlState,
  defaultParentsExpansionForFocus,
  recenterPedigreeCameraOnPerson,
  serializePedigreeSearchParams,
  parsePedigreeSearchParams,
  yearRange,
  CARD_H,
  CARD_W,
  DEFAULT_PEDIGREE_ANCESTOR_GENERATIONS,
  DEFAULT_PEDIGREE_FOCUS,
  visibleParentsOfChild,
  type PedigreeUrlState,
} from "@/lib/pedigreeLayout";

const VIEW_W = 1600;
const VIEW_H = 960;
const PAD = 80;
const DRAG_THRESHOLD_PX = 5;
const ZOOM_URL_DEBOUNCE_MS = 200;

const cloneUrlState = clonePedigreeUrlState;

/**
 * Toggle a branch control; when turning **on**, clear `dismissed` for people that expansion would reveal
 * (otherwise spouse/child toggles look like no-ops after that person was closed with ×).
 */
function applyExpansionToggle(
  tree: FamilyTree,
  state: PedigreeUrlState,
  key: "parents" | "children" | "siblings" | "spouses",
  id: string,
): PedigreeUrlState {
  const next = clonePedigreeUrlState(state);
  const set = next[key];
  if (set.has(id)) {
    set.delete(id);
    return next;
  }
  set.add(id);
  if (key === "spouses") {
    for (const sp of getSpouses(tree, id)) next.dismissed.delete(sp.id);
  } else if (key === "children") {
    for (const c of getChildren(tree, id)) next.dismissed.delete(c.id);
  } else if (key === "siblings") {
    for (const s of getSiblings(tree, id)) next.dismissed.delete(s.id);
  } else {
    const [f, m] = getParents(tree, id);
    if (f) next.dismissed.delete(f.id);
    if (m) next.dismissed.delete(m.id);
  }
  return next;
}

/**
 * Clear URL toggles for this person and anyone reached by following **original** child / sibling /
 * spouse expansions from them (does not walk “parents” links, i.e. not toward ancestors).
 */
function collapseExpansionsFromCard(tree: FamilyTree, state: PedigreeUrlState, startId: string): PedigreeUrlState {
  const next = clonePedigreeUrlState(state);
  const queue: string[] = [startId];
  const seen = new Set<string>();
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    next.parents.delete(id);
    next.children.delete(id);
    next.siblings.delete(id);
    next.spouses.delete(id);

    if (state.children.has(id)) {
      for (const c of getChildren(tree, id)) queue.push(c.id);
    }
    if (state.siblings.has(id)) {
      for (const s of getSiblings(tree, id)) queue.push(s.id);
    }
    if (state.spouses.has(id)) {
      for (const sp of getSpouses(tree, id)) queue.push(sp.id);
    }
  }
  return next;
}

/** Collapse descendant-side expansions from this card and remove the card from the graph (unless it is the focus). */
function closeCard(tree: FamilyTree, state: PedigreeUrlState, cardId: string): PedigreeUrlState {
  const next = collapseExpansionsFromCard(tree, state, cardId);
  if (cardId !== state.focus) next.dismissed.add(cardId);
  return next;
}

/** New chart focus: default ancestor depth, no side branches, no dismissed cards; keep pan/zoom. */
function pedigreeStateForNewFocus(tree: FamilyTree, current: PedigreeUrlState, newFocusId: string): PedigreeUrlState {
  return {
    focus: newFocusId,
    parents: defaultParentsExpansionForFocus(tree, newFocusId, DEFAULT_PEDIGREE_ANCESTOR_GENERATIONS),
    children: new Set(),
    siblings: new Set(),
    spouses: new Set(),
    dismissed: new Set(),
    k: current.k,
    x: current.x,
    y: current.y,
  };
}

/** First name next to the line-descent icon; title / aria-label carry full wording. */
function lineChildButtonLabel(child: { displayName?: string; id: string }): string {
  const first = child.displayName?.trim().split(/\s+/)[0] ?? "";
  if (!first) return "Line";
  return first.length > 10 ? `${first.slice(0, 9)}…` : first;
}

function PedigreeZoomControls({
  onZoomIn,
  onZoomOut,
  onResetUrl,
}: {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetUrl: () => void;
}) {
  return (
    <div className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-lg border border-zinc-300 bg-white/95 px-1 py-0.5 shadow-sm backdrop-blur">
      <button
        type="button"
        className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded text-base font-bold text-zinc-700 hover:bg-zinc-100 active:bg-zinc-200"
        aria-label="Zoom out"
        onClick={onZoomOut}
      >
        −
      </button>
      <button
        type="button"
        className="flex min-h-[44px] items-center justify-center rounded px-2 text-[11px] font-semibold text-zinc-500 hover:bg-zinc-100 active:bg-zinc-200"
        aria-label="Reset zoom and pan"
        onClick={onResetUrl}
      >
        Reset
      </button>
      <button
        type="button"
        className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded text-base font-bold text-zinc-700 hover:bg-zinc-100 active:bg-zinc-200"
        aria-label="Zoom in"
        onClick={onZoomIn}
      >
        +
      </button>
    </div>
  );
}

function spousePath(x1: number, y1: number, x2: number, y2: number): string {
  const ay = y1 + CARD_H / 2;
  const by = y2 + CARD_H / 2;
  const r1 = x1 + CARD_W;
  const r2 = x2;
  if (r1 <= r2) return `M ${r1} ${ay} L ${r2} ${by}`;
  return `M ${x1} ${ay} L ${r2} ${by}`;
}

type NodeBox = { x: number; y: number };

function parentChildPathSingle(parent: NodeBox, child: NodeBox): string {
  const midX = parent.x + CARD_W / 2;
  const y1 = parent.y + CARD_H;
  const y2 = child.y;
  const ym = (y1 + y2) / 2;
  const cx = child.x + CARD_W / 2;
  return `M ${midX} ${y1} L ${midX} ${ym} L ${cx} ${ym} L ${cx} ${y2}`;
}

/** Classic pedigree fork: marriage bar between parents, single drop to child. */
function parentChildPathFork(left: NodeBox, right: NodeBox, child: NodeBox): string {
  const barY = left.y + CARD_H + 14;
  const lx = left.x + CARD_W / 2;
  const rx = right.x + CARD_W / 2;
  const cx = child.x + CARD_W / 2;
  const ym = (barY + child.y) / 2;
  return [
    `M ${lx} ${left.y + CARD_H} L ${lx} ${barY} L ${rx} ${barY} L ${rx} ${right.y + CARD_H}`,
    `M ${(lx + rx) / 2} ${barY} L ${(lx + rx) / 2} ${ym} L ${cx} ${ym} L ${cx} ${child.y}`,
  ].join(" ");
}

const NEUTRAL_CARD_BG = "#e5e7eb";

/** Toolbar glyphs (titles / aria-labels carry the full wording). */
function IconParents() {
  return (
    <svg
      viewBox="0 0 16 16"
      width={14}
      height={14}
      className="shrink-0 opacity-90"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth={1.35}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 13V5M8 5 5 8M8 5l3 3" />
    </svg>
  );
}

function IconChildren() {
  return (
    <svg
      viewBox="0 0 16 16"
      width={14}
      height={14}
      className="shrink-0 opacity-90"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth={1.35}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 3v10M8 13 5 10M8 13l3-3" />
    </svg>
  );
}

function IconSiblings() {
  return (
    <svg
      viewBox="0 0 16 16"
      width={14}
      height={14}
      className="shrink-0 opacity-90"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth={1.25}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="5.5" cy="5.5" r="2.2" />
      <path d="M5.5 7.7v3.3" />
      <circle cx="10.5" cy="5.5" r="2.2" />
      <path d="M10.5 7.7v3.3" />
    </svg>
  );
}

function IconSpouse() {
  return (
    <svg
      viewBox="0 0 16 16"
      width={14}
      height={14}
      className="shrink-0 opacity-90"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth={1.25}
      strokeLinecap="round"
    >
      <circle cx="6" cy="8" r="3" />
      <circle cx="10" cy="8" r="3" />
    </svg>
  );
}

function IconLineDown() {
  return (
    <svg
      viewBox="0 0 16 16"
      width={14}
      height={14}
      className="shrink-0 opacity-90"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth={1.35}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 3v7M8 10 5.5 7.5M8 10l2.5-2.5" />
    </svg>
  );
}

function IconFocus() {
  return (
    <svg
      viewBox="0 0 16 16"
      width={14}
      height={14}
      className="shrink-0 opacity-90"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth={1.25}
      strokeLinecap="round"
    >
      <circle cx="8" cy="8" r="2.8" />
      <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2" />
    </svg>
  );
}

function IconCloseCard() {
  return (
    <svg
      viewBox="0 0 16 16"
      width={12}
      height={12}
      className="shrink-0"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
    >
      <path d="M5 5l6 6M11 5L5 11" />
    </svg>
  );
}

/** Fixed square icon toggles (card width ~200px → four 32px chips fit in one row). */
const toolbarSq =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border text-zinc-800 shadow-none transition select-none";
/** Wider row for line + focus */
const toolbarWide =
  "inline-flex h-8 min-h-8 min-w-0 flex-1 items-center justify-center gap-1 rounded-md border px-1.5 text-[9px] font-medium leading-none shadow-none transition select-none";
const toolbarBtnIdle =
  "border-zinc-200/90 bg-white/95 hover:border-zinc-300 hover:bg-white";
const toolbarBtnOn = "border-sky-500 bg-sky-50 text-sky-900 shadow-sm";
/** Descend one generation on the direct line (distinct from “Children” expand-all). */
const toolbarLineChildBtn =
  "border-emerald-200/95 bg-emerald-50/95 text-emerald-950 hover:border-emerald-400 hover:bg-emerald-50";
const closeCardBtn =
  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-zinc-300/90 bg-white/95 text-zinc-600 shadow-sm hover:border-red-300 hover:bg-red-50 hover:text-red-800";

/** Match fan chart: focal + zoom via background (reliable inside SVG foreignObject). */
function pedigreeAvatarBgStyle(src: string, focal: [number, number], zoom: number): CSSProperties {
  const pctX = Math.round(focal[0] * 100);
  const pctY = Math.round(focal[1] * 100);
  return {
    width: "100%",
    height: "100%",
    borderRadius: "9999px",
    backgroundImage: `url("${src}")`,
    backgroundSize: zoom > 1 ? `${Math.round(zoom * 100)}%` : "cover",
    backgroundPosition: `${pctX}% ${pctY}%`,
    backgroundRepeat: "no-repeat",
  };
}

function PedigreeChartLoaded({
  tree,
  photoInfos,
}: {
  tree: FamilyTree;
  photoInfos: Record<string, PhotoInfo | null>;
}) {
  const searchParams = useSearchParams();
  const paramStr = searchParams.toString();
  const router = useRouter();
  const pathname = usePathname();

  const urlState = useMemo(() => parsePedigreeSearchParams(new URLSearchParams(paramStr), tree), [paramStr, tree]);

  const urlStateRef = useRef(urlState);
  urlStateRef.current = urlState;

  /** Birth-parent chain upward from current focus (includes focus); excludes siblings, descendants, in-laws. */
  const directAncestorIds = useMemo(
    () => collectDirectAncestorIds(tree, urlState.focus),
    [tree, urlState.focus],
  );

  /** One pipeline for render and for `anchoredPedigreePan` in the layout module (no duplicated math). */
  const scene = useMemo(() => buildPedigreeScene(tree, urlState, VIEW_W, VIEW_H, PAD), [tree, urlState]);
  const { nodes: layoutNodes, edges: layoutEdges, ox: contentOx, oy: contentOy, visible: visibleIdsSet } = scene;

  /**
   * Monotonic counter: incremented every time *we* programmatically set the d3 transform.
   * The zoom "end" handler reads this to know "this transform came from code, don't write it back to the URL".
   */
  const programmaticSetRef = useRef(0);
  const pendingProgrammaticRef = useRef(0);
  /** Timer for debounced zoom→URL writes so dragging doesn't spam history. */
  const zoomTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const navigateUrl = useCallback(
    (next: PedigreeUrlState, mode: "push" | "replace" = "push") => {
      const q = serializePedigreeSearchParams(next);
      const href = q ? `${pathname}?${q}` : pathname;
      if (mode === "replace") router.replace(href);
      else router.push(href);
    },
    [pathname, router],
  );

  const navigateUrlRef = useRef(navigateUrl);
  navigateUrlRef.current = navigateUrl;

  /** Push a toggle / focus change (adds history entry). */
  const pushUrl = useCallback(
    (next: PedigreeUrlState) => navigateUrl(next, "push"),
    [navigateUrl],
  );

  const pushUrlRef = useRef(pushUrl);
  pushUrlRef.current = pushUrl;

  const onResetUrl = useCallback(() => {
    const next = cloneUrlState(urlStateRef.current);
    next.k = 1;
    next.x = 0;
    next.y = 0;
    next.dismissed = new Set();
    pushUrl(next);
  }, [pushUrl]);

  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const routerRef = useRef(router);
  routerRef.current = router;

  /** Apply a d3 transform programmatically without it echoing back as a URL write. */
  const applyTransformSilently = useCallback(
    (t: d3.ZoomTransform, animated = false) => {
      const svgEl = svgRef.current;
      const zoom = zoomRef.current;
      if (!svgEl || !zoom) return;
      programmaticSetRef.current += 1;
      pendingProgrammaticRef.current += 1;
      const sel = d3.select(svgEl);
      if (animated) {
        sel.transition().duration(300).call(zoom.transform, t)
          .on("end", () => { pendingProgrammaticRef.current = Math.max(0, pendingProgrammaticRef.current - 1); });
      } else {
        sel.call(zoom.transform, t);
        requestAnimationFrame(() => {
          pendingProgrammaticRef.current = Math.max(0, pendingProgrammaticRef.current - 1);
        });
      }
    },
    [],
  );

  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;
    const svg = d3.select(svgEl);
    const g = svg.select<SVGGElement>("g#pedigree-zoom-root");

    let lastProgrammaticSet = programmaticSetRef.current;

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.22, 14])
      .filter((event) => {
        if (event.type === "wheel") return true;
        if (event.button !== 0 && event.button !== undefined) return false;
        const t = event.target as Element | null;
        if (t?.closest?.("[data-no-pan]")) return false;
        return true;
      })
      .on("start", () => {
        svgEl.style.cursor = "grabbing";
      })
      .on("zoom", (event) => {
        g.attr("transform", event.transform.toString());
      })
      .on("end", (event) => {
        svgEl.style.cursor = "grab";

        const wasProgrammatic =
          programmaticSetRef.current !== lastProgrammaticSet ||
          pendingProgrammaticRef.current > 0;
        lastProgrammaticSet = programmaticSetRef.current;
        if (wasProgrammatic) return;

        const s = urlStateRef.current;
        const { k, x, y } = event.transform;
        const near =
          Math.abs(k - s.k) < 0.004 && Math.abs(x - s.x) < 0.5 && Math.abs(y - s.y) < 0.5;
        if (near) return;

        if (zoomTimerRef.current) clearTimeout(zoomTimerRef.current);
        zoomTimerRef.current = setTimeout(() => {
          zoomTimerRef.current = null;
          navigateUrlRef.current({ ...cloneUrlState(urlStateRef.current), k, x, y }, "replace");
        }, ZOOM_URL_DEBOUNCE_MS);
      });

    zoomRef.current = zoom;
    svg.call(zoom);
    svg.on("dblclick.zoom", null);

    let downTarget: Element | null = null;
    let downPos = { x: 0, y: 0 };

    function onPointerDown(e: PointerEvent) {
      downTarget = e.target as Element;
      downPos = { x: e.clientX, y: e.clientY };
    }

    function onPointerUp(e: PointerEvent) {
      if (!downTarget) return;
      const dx = e.clientX - downPos.x;
      const dy = e.clientY - downPos.y;
      if (dx * dx + dy * dy < DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) {
        const el = downTarget.closest?.("[data-href]");
        if (el) {
          const href = el.getAttribute("data-href");
          if (href) routerRef.current.push(href);
        }
      }
      downTarget = null;
    }

    svgEl.addEventListener("pointerdown", onPointerDown);
    svgEl.addEventListener("pointerup", onPointerUp);

    return () => {
      svg.on(".zoom", null);
      svgEl.removeEventListener("pointerdown", onPointerDown);
      svgEl.removeEventListener("pointerup", onPointerUp);
      if (zoomTimerRef.current) clearTimeout(zoomTimerRef.current);
      zoomRef.current = null;
    };
  }, []);

  /**
   * Sync d3 transform from URL state whenever the URL changes.
   * Uses the monotonic counter to avoid the "URL change → transform set → zoom end → URL write" loop.
   */
  useLayoutEffect(() => {
    const s = urlStateRef.current;
    const t = d3.zoomIdentity.translate(s.x, s.y).scale(s.k);
    applyTransformSilently(t);
  }, [paramStr, applyTransformSilently]);

  const onZoomIn = useCallback(() => {
    const svgEl = svgRef.current;
    const zoom = zoomRef.current;
    if (!svgEl || !zoom) return;
    const cur = d3.zoomTransform(svgEl);
    const next = cur.scale(1.5);
    applyTransformSilently(d3.zoomIdentity.translate(next.x, next.y).scale(next.k), true);
    navigateUrlRef.current(
      { ...cloneUrlState(urlStateRef.current), k: next.k, x: next.x, y: next.y },
      "replace",
    );
  }, [applyTransformSilently]);

  const onZoomOut = useCallback(() => {
    const svgEl = svgRef.current;
    const zoom = zoomRef.current;
    if (!svgEl || !zoom) return;
    const cur = d3.zoomTransform(svgEl);
    const next = cur.scale(1 / 1.5);
    applyTransformSilently(d3.zoomIdentity.translate(next.x, next.y).scale(next.k), true);
    navigateUrlRef.current(
      { ...cloneUrlState(urlStateRef.current), k: next.k, x: next.x, y: next.y },
      "replace",
    );
  }, [applyTransformSilently]);

  const nodeMap = useMemo(() => new Map(layoutNodes.map((n) => [n.id, n])), [layoutNodes]);

  return (
    <div className="relative w-full">
      <PedigreeZoomControls onZoomIn={onZoomIn} onZoomOut={onZoomOut} onResetUrl={onResetUrl} />

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
        <div>
          <h1 className="font-serif text-xl font-bold tracking-tight text-zinc-900 sm:text-2xl">Pedigree tree</h1>
          <p className="max-w-2xl text-xs text-zinc-500 sm:text-sm">
            Opens with {DEFAULT_PEDIGREE_ANCESTOR_GENERATIONS} ancestor generations above the focus when the URL omits{" "}
            <span className="font-mono text-zinc-600">parents</span>. Icons on each card toggle parents, children,
            siblings, and spouses; pan and zoom are stored in the URL so the back button restores your view.
          </p>
        </div>
        <a
          href="/chart"
          className="shrink-0 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 transition hover:border-sky-200 hover:text-sky-800"
        >
          Fan chart
        </a>
      </div>

      <div
        className="overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50/80"
        style={{ maxHeight: "min(88vh, 1680px)" }}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="w-full touch-none select-none"
          style={{ height: "min(88vh, 1680px)", cursor: "grab", backgroundColor: "#fafafa" }}
          aria-label="Pedigree family tree"
        >
          <defs>
            <filter id="pedigree-card-shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.2" floodOpacity="0.08" />
            </filter>
          </defs>
          <g id="pedigree-zoom-root">
            <g transform={`translate(${contentOx},${contentOy})`}>
              <g className="pedigree-edges">
                {layoutEdges.map((e, i) => {
                  const a = nodeMap.get(e.from);
                  const b = nodeMap.get(e.to);
                  if (!a || !b) return null;
                  return (
                    <path
                      key={`sp-${e.from}-${e.to}-${i}`}
                      d={spousePath(a.x, a.y, b.x, b.y)}
                      fill="none"
                      stroke="#71717a"
                      strokeWidth={1.5}
                    />
                  );
                })}
                {layoutNodes.map((child) => {
                  const ps = visibleParentsOfChild(tree, visibleIdsSet, child.id);
                  if (ps.length === 0) return null;
                  const boxes = ps
                    .map((p) => nodeMap.get(p.id))
                    .filter((b): b is NonNullable<typeof b> => Boolean(b));
                  if (boxes.length === 0) return null;
                  if (boxes.length === 1) {
                    return (
                      <path
                        key={`pc-${child.id}`}
                        d={parentChildPathSingle(boxes[0]!, child)}
                        fill="none"
                        stroke="#71717a"
                        strokeWidth={1.5}
                      />
                    );
                  }
                  const [left, right] = boxes[0]!.x <= boxes[1]!.x ? [boxes[0]!, boxes[1]!] : [boxes[1]!, boxes[0]!];
                  return (
                    <path
                      key={`pc-${child.id}`}
                      d={parentChildPathFork(left, right, child)}
                      fill="none"
                      stroke="#71717a"
                      strokeWidth={1.5}
                    />
                  );
                })}
              </g>

              {layoutNodes.map((n) => {
                const p = n.person;
                const slug = personSlugFromPage(p.personPage);
                const href = slug ? `/people/${slug}` : null;
                const photo = photoInfos[n.id];
                const yrs = yearRange(p);
                const [f, m] = getParents(tree, n.id);
                const hasParents = Boolean(f || m);
                const kids = getChildren(tree, n.id);
                const sibs = getSiblings(tree, n.id);
                const sps = getSpouses(tree, n.id);
                const showParentsBtn = hasParents;
                const showChildrenBtn = kids.length > 0;
                const showSiblingsBtn = sibs.length > 0;
                const showSpousesBtn = sps.length > 0;
                const isFocus = n.id === urlState.focus;
                const showFocusHere = !isFocus && directAncestorIds.has(n.id);
                const lineChildRaw = lineageChildTowardFocus(
                  tree,
                  n.id,
                  urlState.focus,
                  DEFAULT_PEDIGREE_FOCUS,
                );
                const lineChild =
                  lineChildRaw && lineChildRaw.id !== urlState.focus ? lineChildRaw : null;

                const toggle = (key: "parents" | "children" | "siblings" | "spouses") => {
                  const cur = urlStateRef.current;
                  const raw = applyExpansionToggle(tree, cur, key, n.id);
                  pushUrlRef.current(anchoredPedigreePan(tree, cur, raw, n.id, VIEW_W, VIEW_H, PAD));
                };

                const setFocusHere = () => {
                  const cur = urlStateRef.current;
                  const next = pedigreeStateForNewFocus(tree, cur, n.id);
                  pushUrlRef.current(anchoredPedigreePan(tree, cur, next, n.id, VIEW_W, VIEW_H, PAD));
                };

                const display = p.displayName ?? n.id;
                const rawPlace = (p.birthPlace ?? "").trim();
                const cardBg = rawPlace ? chartFillFromBirthPlace(p.birthPlace) : NEUTRAL_CARD_BG;
                const nameFg = chartNameFillForSegmentFill(cardBg);
                const mutedFg = chartYearsFillForSegmentFill(cardBg);

                return (
                  <g key={n.id} transform={`translate(${n.x},${n.y})`}>
                    <rect
                      x={0}
                      y={0}
                      width={CARD_W}
                      height={CARD_H}
                      rx={12}
                      fill={cardBg}
                      stroke={isFocus ? "#0ea5e9" : "rgba(0,0,0,0.12)"}
                      strokeWidth={isFocus ? 2.5 : 1}
                      filter="url(#pedigree-card-shadow)"
                    />
                    <foreignObject x={0} y={0} width={CARD_W} height={CARD_H}>
                      {/* No position:absolute/relative, no backdrop-blur inside foreignObject — iOS WebKit
                          mispositions absolutely-placed children and clips backdrop-filter content. */}
                      <div
                        data-no-pan=""
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          pointerEvents: "all",
                          height: CARD_H,
                          width: CARD_W,
                          padding: "10px 8px 6px 8px",
                          boxSizing: "border-box",
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                      >
                        <div style={{ display: "flex", flexShrink: 0, flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
                          {photo ? (
                            <div style={{ width: 48, height: 48, flexShrink: 0, borderRadius: "50%", boxShadow: "0 4px 6px -1px rgba(0,0,0,.1)", clipPath: "circle(50%)" }}>
                              <div
                                style={pedigreeAvatarBgStyle(photo.url, photo.focal ?? [0.5, 0.5], photo.zoom ?? 1)}
                              />
                            </div>
                          ) : null}
                          <div className={`min-w-0 flex-1 ${photo ? "self-center" : "self-start"}`}>
                            {href ? (
                              <Link
                                href={href}
                                className="block truncate text-left text-[13px] font-semibold leading-snug decoration-transparent opacity-95 hover:opacity-100"
                                style={{ color: nameFg }}
                                title={display}
                                onPointerDown={(e) => e.stopPropagation()}
                              >
                                {truncateName(display, photo ? 24 : 32)}
                              </Link>
                            ) : (
                              <span
                                className="block truncate text-[13px] font-semibold leading-snug"
                                style={{ color: nameFg }}
                                title={display}
                              >
                                {truncateName(display, photo ? 24 : 32)}
                              </span>
                            )}
                            <p className="mt-1 text-[11px] leading-snug" style={{ color: mutedFg }}>
                              {yrs || "—"}
                            </p>
                            {rawPlace ? (
                              <p
                                className="mt-1.5 line-clamp-2 text-[11px] font-medium leading-snug"
                                style={{ color: mutedFg }}
                                title={rawPlace}
                              >
                                {rawPlace}
                              </p>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            className={closeCardBtn}
                            title="Remove this person from the chart and collapse their child, sibling, and spouse expansions (focus card: collapse only)"
                            aria-label="Remove card from chart"
                            style={{ alignSelf: "flex-start" }}
                            onClick={() => {
                              const cur = urlStateRef.current;
                              pushUrlRef.current(
                                anchoredPedigreePan(tree, cur, closeCard(tree, cur, n.id), cur.focus, VIEW_W, VIEW_H, PAD),
                              );
                            }}
                          >
                            <IconCloseCard />
                          </button>
                        </div>
                        <div className="min-h-0 flex-1" aria-hidden />
                        <div className="flex w-full shrink-0 flex-col gap-1">
                          {showParentsBtn || showChildrenBtn || showSiblingsBtn || showSpousesBtn ? (
                            <div className="flex w-full shrink-0 flex-wrap justify-center gap-1">
                            {showParentsBtn ? (
                              <button
                                type="button"
                                className={`${toolbarSq} ${urlState.parents.has(n.id) ? toolbarBtnOn : toolbarBtnIdle}`}
                                title="Show or hide birth parents on the chart"
                                aria-label="Toggle parents on chart"
                                onClick={() => toggle("parents")}
                              >
                                <IconParents />
                              </button>
                            ) : null}
                            {showChildrenBtn ? (
                              <button
                                type="button"
                                className={`${toolbarSq} ${urlState.children.has(n.id) ? toolbarBtnOn : toolbarBtnIdle}`}
                                title="Show or hide all children on the chart"
                                aria-label="Toggle children on chart"
                                onClick={() => toggle("children")}
                              >
                                <IconChildren />
                              </button>
                            ) : null}
                            {showSiblingsBtn ? (
                              <button
                                type="button"
                                className={`${toolbarSq} ${urlState.siblings.has(n.id) ? toolbarBtnOn : toolbarBtnIdle}`}
                                title="Show or hide siblings (same parents)"
                                aria-label="Toggle siblings on chart"
                                onClick={() => toggle("siblings")}
                              >
                                <IconSiblings />
                              </button>
                            ) : null}
                            {showSpousesBtn ? (
                              <button
                                type="button"
                                className={`${toolbarSq} ${urlState.spouses.has(n.id) ? toolbarBtnOn : toolbarBtnIdle}`}
                                title="Show or hide spouse(s) on the chart"
                                aria-label="Toggle spouses on chart"
                                onClick={() => toggle("spouses")}
                              >
                                <IconSpouse />
                              </button>
                            ) : null}
                            </div>
                          ) : null}
                          {lineChild || showFocusHere ? (
                            <div className="flex w-full shrink-0 justify-center gap-1">
                              {lineChild ? (
                                <button
                                  type="button"
                                  className={`${toolbarWide} min-w-0 flex-1 truncate ${toolbarLineChildBtn}`}
                                  title={`Show or centre the direct-line child; chart focus (${urlState.focus}) stays the same.`}
                                  aria-label={`Reveal or centre direct-line child ${lineChild.displayName ?? lineChild.id}`}
                                  onClick={() => {
                                    const cur = urlStateRef.current;
                                    const parentId = n.id;
                                    if (!cur.children.has(parentId)) {
                                      const next = clonePedigreeUrlState(cur);
                                      next.children.add(parentId);
                                      next.dismissed.delete(lineChild.id);
                                      pushUrlRef.current(
                                        anchoredPedigreePan(tree, cur, next, lineChild.id, VIEW_W, VIEW_H, PAD),
                                      );
                                    } else {
                                      const cleared = clonePedigreeUrlState(cur);
                                      const hadDismissedChild = cleared.dismissed.delete(lineChild.id);
                                      if (hadDismissedChild) {
                                        pushUrlRef.current(
                                          anchoredPedigreePan(
                                            tree,
                                            cur,
                                            cleared,
                                            lineChild.id,
                                            VIEW_W,
                                            VIEW_H,
                                            PAD,
                                          ),
                                        );
                                      } else {
                                        pushUrlRef.current(
                                          recenterPedigreeCameraOnPerson(
                                            tree,
                                            cur,
                                            lineChild.id,
                                            VIEW_W,
                                            VIEW_H,
                                            PAD,
                                          ),
                                        );
                                      }
                                    }
                                  }}
                                >
                                  <IconLineDown />
                                  <span className="min-w-0 truncate">{lineChildButtonLabel(lineChild)}</span>
                                </button>
                              ) : null}
                              {showFocusHere ? (
                                <button
                                  type="button"
                                  className={
                                    lineChild
                                      ? `${toolbarSq} ${toolbarBtnIdle}`
                                      : `${toolbarWide} flex-1 ${toolbarBtnIdle}`
                                  }
                                  title="Set this person as chart focus"
                                  aria-label="Set chart focus here"
                                  onClick={() => setFocusHere()}
                                >
                                  <IconFocus />
                                </button>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </foreignObject>
                  </g>
                );
              })}
            </g>
          </g>
        </svg>
      </div>

      <p className="mt-3 text-center text-xs text-zinc-400">
        Chart focus: <span className="font-mono text-zinc-500">{urlState.focus}</span> ·{" "}
        <strong className="font-medium text-zinc-500">Line ↓</strong> reveals/centres the direct-line child (focus id unchanged) ·
        rings = spouse ·{" "}
        <strong className="font-medium text-zinc-500">×</strong> removes that card (ego stays put) ·
        Card fill = fan-chart colours ·{" "}
        <span className="font-mono">?parents=</span> empty = focus only · URL stores branches and{" "}
        <span className="font-mono">k</span>/<span className="font-mono">x</span>/<span className="font-mono">y</span>
      </p>
    </div>
  );
}

/** URL + SVG foreignObject: render only after mount so SSR/hydration match and `useSearchParams` is stable. */
export function PedigreeChart(props: { tree: FamilyTree; photoInfos: Record<string, PhotoInfo | null> }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) {
    return (
      <div className="relative w-full">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
          <div>
            <h1 className="font-serif text-xl font-bold tracking-tight text-zinc-900 sm:text-2xl">Pedigree tree</h1>
            <p className="max-w-2xl text-xs text-zinc-500 sm:text-sm">Loading chart…</p>
          </div>
        </div>
        <div
          className="overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100"
          style={{ maxHeight: "min(88vh, 1680px)", minHeight: "min(88vh, 1680px)" }}
          aria-busy
        />
      </div>
    );
  }
  return <PedigreeChartLoaded {...props} />;
}

function truncateName(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(1, max - 1))}…`;
}
