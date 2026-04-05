"use client";

import * as d3 from "d3";
import {
  useMemo,
  useCallback,
  useRef,
  useState,
  useEffect,
  type ReactNode,
  type RefObject,
} from "react";
import { useRouter } from "next/navigation";
import type { AncestorNode, Person } from "@/lib/genealogy";
import type { PhotoInfo } from "@/lib/photos";
import { personSlugFromPage } from "@/lib/genealogy";
import {
  CHART_BIRTH_PLACE_LEGEND,
  chartFillFromBirthPlace,
  chartNameFillForSegmentFill,
  chartStrokeFromBirthPlace,
  chartYearsFillForSegmentFill,
  regionShortLabelFromBirthPlace,
} from "@/lib/birthPlaceChartColors";

/* ── Types ───────────────────────────────────────── */

type FanSegment = {
  id: string;
  person: AncestorNode["person"];
  startAngle: number;
  endAngle: number;
  generation: number;
};

type Props = {
  root: AncestorNode;
  maxGeneration: number;
  photoInfos: Record<string, PhotoInfo | null>;
  centers?: Person[];
};

type PhotoLayerEntry = {
  key: string;
  x: number;
  y: number;
  w: number;
  h: number;
  src: string;
  focal: [number, number];
  zoom: number;
};

/* ── Photo CSS ───────────────────────────────────── */

function photoBgStyle(
  src: string,
  focal: [number, number],
  zoom: number,
): React.CSSProperties {
  const pctX = Math.round(focal[0] * 100);
  const pctY = Math.round(focal[1] * 100);
  return {
    width: "100%",
    height: "100%",
    borderRadius: "50%",
    backgroundImage: `url("${src}")`,
    backgroundSize: zoom > 1 ? `${Math.round(zoom * 100)}%` : "cover",
    backgroundPosition: `${pctX}% ${pctY}%`,
    backgroundRepeat: "no-repeat",
  };
}

/* ── Constants ───────────────────────────────────── */

const W = 2400;
const CX = W / 2;

const FAN_ANGLE_EXTRA = Math.PI / 4;
const FAN_START = -Math.PI / 2 - FAN_ANGLE_EXTRA;
const FAN_END = Math.PI / 2 + FAN_ANGLE_EXTRA;

const TOP_GUTTER = 28;
const ROOT_STACK_BELOW = 150;
const ROOT_R = 90;
const ROOT_GAP = 36;

const BAND_SCALE = 1.07;
const DRAG_THRESHOLD_PX = 5;

/* ── Layout ──────────────────────────────────────── */

function layoutAncestors(root: AncestorNode, maxGen: number, out: FanSegment[]) {
  function walk(node: AncestorNode | null, start: number, end: number, gen: number) {
    if (!node || gen > maxGen) return;
    if (gen >= 1) out.push({ id: node.id, person: node.person, startAngle: start, endAngle: end, generation: gen });
    const mid = (start + end) / 2;
    const f = node.father;
    const m = node.mother;
    const hasF = Boolean(f?.person);
    const hasM = Boolean(m?.person);
    if (hasF && hasM) { walk(f, start, mid, gen + 1); walk(m, mid, end, gen + 1); }
    else if (hasF) walk(f, start, end, gen + 1);
    else if (hasM) walk(m, start, end, gen + 1);
  }
  const mid = (FAN_START + FAN_END) / 2;
  const hasF = Boolean(root.father?.person);
  const hasM = Boolean(root.mother?.person);
  if (hasF && hasM) { walk(root.father, FAN_START, mid, 1); walk(root.mother, mid, FAN_END, 1); }
  else if (hasF) walk(root.father, FAN_START, FAN_END, 1);
  else if (hasM) walk(root.mother, FAN_START, FAN_END, 1);
}

function ringRadii(gen: number): { inner: number; outer: number } {
  const bands = [0, 150, 140, 125, 110, 95, 85, 75].map((b, i) =>
    i === 0 ? 0 : Math.round(b * BAND_SCALE),
  );
  let r = Math.round(100 * BAND_SCALE);
  for (let g = 1; g < gen; g++) r += bands[g] ?? Math.round(75 * BAND_SCALE);
  const band = bands[gen] ?? Math.round(75 * BAND_SCALE);
  return { inner: r, outer: r + band - 2 };
}

function maxOuterRadius(maxGen: number): number {
  return ringRadii(maxGen).outer;
}

function computeGenerationEras(segments: FanSegment[]): { gen: number; decade: number }[] {
  const byGen = new Map<number, number[]>();
  for (const s of segments) {
    const yr = fmtDate(s.person?.birthDate);
    if (!yr) continue;
    const year = parseInt(yr, 10);
    if (isNaN(year) || year < 1500) continue;
    const arr = byGen.get(s.generation);
    if (arr) arr.push(year);
    else byGen.set(s.generation, [year]);
  }
  const result: { gen: number; decade: number }[] = [];
  for (const [gen, years] of byGen) {
    years.sort((a, b) => a - b);
    const median = years[Math.floor(years.length / 2)];
    result.push({ gen, decade: Math.floor(median / 10) * 10 });
  }
  return result.sort((a, b) => a.gen - b.gen);
}

const ROOT_FOCUS_DY = Math.round(ringRadii(1).inner * 0.82 + 52);

/* ── Arc datum ───────────────────────────────────── */

type ArcDatum = { innerRadius: number; outerRadius: number; startAngle: number; endAngle: number };

/* ── Text helpers ────────────────────────────────── */

function fmtDate(d: string | undefined): string {
  if (!d) return "";
  const clean = d.replace(/^(ABT|BEF|AFT|aft|~|c\.?\s*)/i, "").trim();
  const m = clean.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[1]}`;
  const m2 = clean.match(/^(\d{4})-(\d{2})$/);
  if (m2) return `${m2[1]}`;
  const m3 = clean.match(/^(\d{4})$/);
  if (m3) return m3[1];
  const m4 = clean.match(/(\d{4})/);
  if (m4) return m4[1];
  return clean.length > 10 ? clean.slice(0, 10) : clean;
}

function yearRange(p: AncestorNode["person"]): string {
  if (!p) return "";
  const b = fmtDate(p.birthDate);
  const d = fmtDate(p.deathDate);
  if (b && d) return `${b}–${d}`;
  if (b) return `b. ${b}`;
  if (d) return `d. ${d}`;
  return "";
}

function splitName(name: string, maxChars: number): string[] {
  const clean = name.replace(/\s+/g, " ").trim();
  if (clean.length <= maxChars) return [clean];
  const words = clean.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if (cur && (cur + " " + w).length > maxChars) { lines.push(cur); cur = w; }
    else cur = cur ? cur + " " + w : w;
  }
  if (cur) lines.push(cur);
  return lines.length > 3 ? [lines.slice(0, 2).join(" "), lines.slice(2).join(" ")] : lines;
}

function labelRotationRadial(startAngle: number, endAngle: number): number {
  const mid = (startAngle + endAngle) / 2;
  let rotDeg = (mid * 180) / Math.PI - 90;
  if (rotDeg > 90) rotDeg -= 180;
  if (rotDeg < -90) rotDeg += 180;
  return rotDeg;
}

function truncateChars(s: string, maxLen: number): string {
  const t = s.trim();
  if (t.length <= maxLen) return t;
  if (maxLen <= 1) return "…";
  return `${t.slice(0, Math.max(1, maxLen - 1))}…`;
}

function truncateNameSmart(name: string, maxLen: number): string {
  const t = name.replace(/\s+/g, " ").trim();
  if (t.length <= maxLen) return t;
  const words = t.split(" ");
  if (words.length >= 2) {
    const sur = words[words.length - 1]!;
    const budgetForPrefix = maxLen - sur.length - 1;
    if (budgetForPrefix >= 1) {
      const rest = words.slice(0, -1).join(" ");
      const prefix = truncateChars(rest, budgetForPrefix);
      if (prefix) return `${prefix} ${sur}`;
    }
    return truncateChars(sur, maxLen);
  }
  return truncateChars(t, maxLen);
}

/* ── URL state persistence ───────────────────────── */

function readUrlTransform(): d3.ZoomTransform | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const k = parseFloat(params.get("k") ?? "");
  const x = parseFloat(params.get("x") ?? "");
  const y = parseFloat(params.get("y") ?? "");
  if (isNaN(k) || isNaN(x) || isNaN(y)) return null;
  if (k < 0.1 || k > 20) return null;
  return d3.zoomIdentity.translate(x, y).scale(k);
}

function writeUrlTransform(t: d3.ZoomTransform): void {
  const url = new URL(window.location.href);
  url.searchParams.set("k", t.k.toFixed(3));
  url.searchParams.set("x", t.x.toFixed(1));
  url.searchParams.set("y", t.y.toFixed(1));
  window.history.replaceState(null, "", url.toString());
}

/* ── Zoom controls ───────────────────────────────── */

function ZoomControls({
  svgRef,
  zoomRef,
}: {
  svgRef: RefObject<SVGSVGElement | null>;
  zoomRef: RefObject<d3.ZoomBehavior<SVGSVGElement, unknown> | null>;
}) {
  const act = useCallback(
    (fn: (svg: d3.Selection<SVGSVGElement, unknown, null, undefined>, z: d3.ZoomBehavior<SVGSVGElement, unknown>) => void) => {
      if (!svgRef.current || !zoomRef.current) return;
      fn(d3.select(svgRef.current), zoomRef.current);
    },
    [svgRef, zoomRef],
  );

  return (
    <div className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-lg border border-zinc-300 bg-white/95 px-1 py-0.5 shadow-sm backdrop-blur">
      <button
        type="button"
        className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded text-base font-bold text-zinc-700 hover:bg-zinc-100 active:bg-zinc-200"
        aria-label="Zoom out"
        onClick={() => act((svg, z) => svg.transition().duration(300).call(z.scaleBy, 1 / 1.5))}
      >
        −
      </button>
      <button
        type="button"
        className="flex min-h-[44px] items-center justify-center rounded px-2 text-[11px] font-semibold text-zinc-500 hover:bg-zinc-100 active:bg-zinc-200"
        aria-label="Reset zoom"
        onClick={() => act((svg, z) => svg.transition().duration(500).call(z.transform, d3.zoomIdentity))}
      >
        Reset
      </button>
      <button
        type="button"
        className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded text-base font-bold text-zinc-700 hover:bg-zinc-100 active:bg-zinc-200"
        aria-label="Zoom in"
        onClick={() => act((svg, z) => svg.transition().duration(300).call(z.scaleBy, 1.5))}
      >
        +
      </button>
    </div>
  );
}

/* ── Birthplace legend ───────────────────────────── */

function ChartLegend() {
  const [open, setOpen] = useState(false);
  const [hasAutoExpanded, setHasAutoExpanded] = useState(false);

  const containerRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node || hasAutoExpanded) return;
      const mq = window.matchMedia("(min-width: 640px)");
      if (mq.matches) {
        setOpen(true);
        setHasAutoExpanded(true);
      }
    },
    [hasAutoExpanded],
  );

  return (
    <div
      ref={containerRef}
      className="absolute bottom-3 left-3 z-10 rounded-lg border border-zinc-200 bg-white/90 shadow-sm backdrop-blur"
    >
      <button
        type="button"
        className="flex w-full items-center gap-1.5 px-3 py-1.5 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
          Birthplace Legend
        </span>
        <svg
          viewBox="0 0 12 12"
          className={`h-2.5 w-2.5 text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M2 4.5 6 8.5 10 4.5" />
        </svg>
      </button>
      {open && (
        <ul className="max-h-[32vh] overflow-y-auto px-3 pb-2 grid grid-cols-2 gap-x-4 gap-y-1">
          {CHART_BIRTH_PLACE_LEGEND.map((e) => (
            <li key={e.id} className="flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-sm border border-zinc-300/60"
                style={{ backgroundColor: e.color }}
              />
              <span className="text-[10px] leading-tight text-zinc-600">
                {e.label}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ── Fan chart ───────────────────────────────────── */

export function FanChart({ root, maxGeneration, photoInfos, centers: centersProp }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown>>(null);
  const urlTimerRef = useRef<number>(0);

  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;

  /* ── Layout computation (pure, deterministic) ──── */

  const segments = useMemo(() => {
    const out: FanSegment[] = [];
    layoutAncestors(root, maxGeneration, out);
    return out;
  }, [root, maxGeneration]);

  const generationEras = useMemo(() => computeGenerationEras(segments), [segments]);

  const { chartH, chartCY } = useMemo(() => {
    const maxR = maxOuterRadius(maxGeneration);
    const cy = TOP_GUTTER + maxR;
    const sinLow = Math.max(
      Math.sin(FAN_END - Math.PI / 2),
      Math.sin(FAN_START - Math.PI / 2),
    );
    const rimLow = maxR * Math.max(0, sinLow);
    const h = Math.ceil(cy + Math.max(ROOT_FOCUS_DY + ROOT_STACK_BELOW, rimLow + 20) + 12);
    return { chartH: h, chartCY: cy };
  }, [maxGeneration]);

  const arcGen = useMemo(() => d3.arc<ArcDatum>().padAngle(0.003).cornerRadius(2), []);

  const centers = useMemo((): Person[] => {
    if (centersProp?.length) return centersProp.filter(Boolean);
    if (root.person) return [root.person];
    return [{ id: root.id, displayName: root.id }];
  }, [centersProp, root.person, root.id]);

  /* ── D3-zoom + click detection ─────────────────── */

  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;
    const svg = d3.select(svgEl);

    let gestureTarget: EventTarget | null = null;
    let gestureOrigin: { x: number; y: number } | null = null;
    let didPan = false;

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 8])
      .on("start", (event) => {
        didPan = false;
        const se = event.sourceEvent;
        if (se && "clientX" in se) {
          gestureTarget = se.target;
          gestureOrigin = { x: se.clientX, y: se.clientY };
        }
        svgEl.style.cursor = "grabbing";
      })
      .on("zoom", (event) => {
        didPan = true;
        svg.select<SVGGElement>("#chart-content").attr("transform", event.transform.toString());
        clearTimeout(urlTimerRef.current);
        urlTimerRef.current = window.setTimeout(() => writeUrlTransform(event.transform), 150);
      })
      .on("end", (event) => {
        svgEl.style.cursor = "grab";
        const se = event.sourceEvent;
        if (!didPan && gestureTarget && gestureOrigin && se && "clientX" in se) {
          const dx = se.clientX - gestureOrigin.x;
          const dy = se.clientY - gestureOrigin.y;
          if (dx * dx + dy * dy < DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) {
            const el = gestureTarget as Element;
            const clickable = el.closest?.("[data-href]");
            if (clickable) {
              const href = clickable.getAttribute("data-href");
              if (href) routerRef.current.push(href);
            }
          }
        }
        gestureTarget = null;
        gestureOrigin = null;
        didPan = false;
      });

    zoomRef.current = zoom;
    svg.call(zoom);
    svg.on("dblclick.zoom", null);

    const saved = readUrlTransform();
    if (saved) {
      svg.call(zoom.transform, saved);
    }

    return () => {
      svg.on(".zoom", null);
      clearTimeout(urlTimerRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Render ────────────────────────────────────── */

  return (
    <div className="relative w-full">
      <ZoomControls svgRef={svgRef} zoomRef={zoomRef} />
      <div
        className="rounded-lg border border-zinc-200 bg-zinc-100/40 overflow-hidden"
        style={{ maxHeight: "min(88vh, 1680px)" }}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${chartH}`}
          className="w-full select-none"
          style={{ height: "min(88vh, 1680px)", cursor: "grab", touchAction: "none", backgroundColor: "#fafafa" }}
          id="fan-chart-svg"
        >
          <g id="chart-content">
            <rect x={-5000} y={-5000} width={W + 10000} height={chartH + 10000} fill="#fafafa" />

            {(() => {
            const photoLayer: PhotoLayerEntry[] = [];
            return (<>
            <g transform={`translate(${CX},${chartCY})`}>
              {segments.map((s, idx) => {
                const { inner, outer } = ringRadii(s.generation);
                const datum: ArcDatum = { innerRadius: inner, outerRadius: outer, startAngle: s.startAngle, endAngle: s.endAngle };
                const pathD = arcGen(datum);
                const [rawCx, rawCy] = arcGen.centroid(datum);
                const cx = Math.round(rawCx * 100) / 100;
                const cy = Math.round(rawCy * 100) / 100;
                const slug = personSlugFromPage(s.person?.personPage);
                const pInfo = photoInfos[s.id];
                const photo = pInfo?.url ?? null;
                const photoFocal = pInfo?.focal ?? [0.5, 0.5] as [number, number];
                const photoZoom = pInfo?.zoom ?? 1;
                const name = s.person?.displayName ?? "?";
                const years = yearRange(s.person);
                const span = s.endAngle - s.startAngle;
                const fill = chartFillFromBirthPlace(s.person?.birthPlace);
                const nameFill = chartNameFillForSegmentFill(fill);
                const yearsFill = chartYearsFillForSegmentFill(fill);
                const rm = (inner + outer) / 2;
                const arcLen = span * rm;
                const band = outer - inner;
                const arcLenOuter = span * outer;
                const photoR =
                  photo == null
                    ? 0
                    : Math.max(
                        3.5,
                        Math.min(44, band * 0.44, arcLen * 0.34, arcLenOuter * 0.3),
                      );
                const tightRadial = arcLen < 92 || s.generation >= 5;
                const veryTight = arcLen < 40 || (s.generation >= 6 && arcLen < 58);
                const showPhoto = Boolean(photo) && band >= 5 && photoR >= 3.5;
                const regionShort = regionShortLabelFromBirthPlace(s.person?.birthPlace);
                const tooltip = [name, years, s.person?.birthPlace].filter(Boolean).join(" · ");

                let labelBody: ReactNode;

                if (tightRadial) {
                  const rotDeg = labelRotationRadial(s.startAngle, s.endAngle);
                  const fs = Math.min(
                    11,
                    Math.max(veryTight ? 5.5 : 6, Math.min(band * 0.34, arcLen * (veryTight ? 0.22 : 0.28))),
                  );
                  const charW = fs * 0.52;
                  const radialBudget = band * 0.86;
                  const maxChars = Math.max(veryTight ? 3 : 4, Math.floor(radialBudget / charW));
                  const displayName = truncateNameSmart(name, maxChars);
                  const yearFs = Math.max(4.5, fs - 2);
                  const showYearsOnWedge = Boolean(years) && !veryTight && arcLen >= 48 && band >= 22;

                  const radialTextLift = showPhoto ? photoR + 6 : 0;
                  labelBody = (
                    <g transform={`translate(${cx},${cy}) rotate(${rotDeg})`} style={{ pointerEvents: "none" }}>
                      <text
                        textAnchor="middle"
                        dominantBaseline="middle"
                        y={(showYearsOnWedge ? -yearFs * 0.55 : 0) - radialTextLift}
                        fontSize={fs}
                        fontWeight={600}
                        fill={nameFill}
                      >
                        {displayName}
                      </text>
                      {showYearsOnWedge ? (
                        <text
                          textAnchor="middle"
                          dominantBaseline="middle"
                          y={fs * 0.65 - radialTextLift}
                          fontSize={yearFs}
                          fontWeight={400}
                          fill={yearsFill}
                        >
                          {truncateChars(years, Math.max(4, maxChars + 2))}
                        </text>
                      ) : null}
                    </g>
                  );
                } else {
                  const fontSize = Math.min(
                    s.generation <= 2 ? 18 : s.generation <= 3 ? 16 : s.generation <= 5 ? 14 : 12,
                    Math.max(8, arcLen / 7.5),
                  );
                  const maxChars = Math.max(6, Math.floor(arcLen / (fontSize * 0.52)));
                  const nameLines = splitName(name, maxChars);
                  const textYStart = showPhoto ? cy + photoR + 8 : cy - (nameLines.length * (fontSize + 2)) / 2 + fontSize / 2;

                  const regionFs = Math.max(7, fontSize - 3);
                  const showRegionOnWedge = Boolean(regionShort) && band >= 80;
                  const regionY =
                    textYStart +
                    nameLines.length * (fontSize + 2) +
                    (years ? fontSize : 0) +
                    1;

                  labelBody = (
                    <>
                      {nameLines.map((line, li) => (
                        <text
                          key={li}
                          x={cx}
                          y={textYStart + li * (fontSize + 2)}
                          textAnchor="middle"
                          fontSize={fontSize}
                          fontWeight={600}
                          fill={nameFill}
                          style={{ pointerEvents: "none" }}
                        >
                          {line}
                        </text>
                      ))}
                      {years ? (
                        <text
                          x={cx}
                          y={textYStart + nameLines.length * (fontSize + 2) + 1}
                          textAnchor="middle"
                          fontSize={fontSize - 2}
                          fontWeight={400}
                          fill={yearsFill}
                          style={{ pointerEvents: "none" }}
                        >
                          {years}
                        </text>
                      ) : null}
                      {showRegionOnWedge ? (
                        <text
                          x={cx}
                          y={regionY}
                          textAnchor="middle"
                          fontSize={regionFs}
                          fontWeight={400}
                          fontStyle="italic"
                          fill={yearsFill}
                          opacity={0.85}
                          style={{ pointerEvents: "none" }}
                        >
                          {regionShort}
                        </text>
                      ) : null}
                    </>
                  );
                }

                return (
                  <g key={`${s.id}-${idx}`}>
                    <path
                      d={pathD ?? ""}
                      fill={fill}
                      stroke="#d4d4d8"
                      strokeWidth={0.6}
                      data-href={slug ? `/people/${slug}` : undefined}
                      className={slug ? "transition-colors duration-100 hover:brightness-95 cursor-pointer" : undefined}
                    >
                      <title>{tooltip}</title>
                    </path>

                    {showPhoto && (() => {
                      photoLayer.push({
                        key: `seg-${s.id}`,
                        x: CX + cx - photoR,
                        y: chartCY + cy - photoR - 4,
                        w: photoR * 2,
                        h: photoR * 2,
                        src: photo!,
                        focal: photoFocal,
                        zoom: photoZoom,
                      });
                      return <circle cx={cx} cy={cy - 4} r={photoR + 1.5} fill="#fff" stroke="#d4d4d8" strokeWidth={0.5} />;
                    })()}

                    {labelBody}
                  </g>
                );
              })}

              {/* Era decade labels — angled along both fan edges */}
              <g style={{ pointerEvents: "none" }}>
                {/* SW edge (left) */}
                {generationEras
                  .filter(({ decade }) => decade >= 1820)
                  .map(({ gen, decade }) => {
                  const { inner, outer } = ringRadii(gen);
                  const midR = (inner + outer) / 2;
                  const angle = FAN_START - 0.03;
                  const x = midR * Math.sin(angle);
                  const y = -midR * Math.cos(angle);
                  const fontSize = gen <= 2 ? 16 : gen <= 4 ? 15 : 14;
                  return (
                    <text
                      key={`era-sw-${gen}`}
                      x={x}
                      y={y}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={fontSize}
                      fill="#57534e"
                      fontWeight={700}
                      fontStyle="normal"
                      letterSpacing={0.5}
                      transform={`rotate(-45, ${x.toFixed(1)}, ${y.toFixed(1)})`}
                    >
                      {`c.\u2009${decade}s`}
                    </text>
                  );
                })}
                {/* SE edge (right) */}
                {generationEras
                  .filter(({ decade }) => decade >= 1850)
                  .map(({ gen, decade }) => {
                  const { inner, outer } = ringRadii(gen);
                  const midR = (inner + outer) / 2;
                  const angle = FAN_END + 0.03;
                  const x = midR * Math.sin(angle);
                  const y = -midR * Math.cos(angle);
                  const fontSize = gen <= 2 ? 16 : gen <= 4 ? 15 : 14;
                  return (
                    <text
                      key={`era-se-${gen}`}
                      x={x}
                      y={y}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={fontSize}
                      fill="#57534e"
                      fontWeight={700}
                      fontStyle="normal"
                      letterSpacing={0.5}
                      transform={`rotate(45, ${x.toFixed(1)}, ${y.toFixed(1)})`}
                    >
                      {`c.\u2009${decade}s`}
                    </text>
                  );
                })}
              </g>

              {/* Root person(s) */}
              <g transform={`translate(0,${ROOT_FOCUS_DY})`}>
                {(() => {
                  const photoUrls = centers.map((c) => photoInfos[c.id]?.url ?? null);
                  const sharedPhoto =
                    centers.length > 1 &&
                    photoUrls[0] &&
                    photoUrls.every((u) => u === photoUrls[0]);

                  if (sharedPhoto) {
                    const photo = photoUrls[0]!;
                    const focal = photoInfos[centers[0].id]?.focal ?? ([0.5, 0.5] as [number, number]);
                    const rootZoom = photoInfos[centers[0].id]?.zoom ?? 1;
                    const ring = chartStrokeFromBirthPlace(centers[0].birthPlace);
                    const clipR = 70;

                    const names = centers.map((c) => c.displayName ?? c.id);
                    const lastParts = names.map((n) => n.split(" ").slice(-1)[0]);
                    const sameSurname = lastParts.every((l) => l === lastParts[0]);
                    const combinedName = sameSurname
                      ? names.map((n) => n.split(" ").slice(0, -1).join(" ")).join(" & ") + " " + lastParts[0]
                      : names.join(" & ");

                    const allYears = centers.map((c) => yearRange(c)).filter(Boolean);
                    const combinedYears = allYears.join("  ·  ");

                    return (
                      <g transform="translate(0,30)">
                        {(() => {
                          photoLayer.push({
                            key: "root-shared",
                            x: CX - clipR,
                            y: chartCY + ROOT_FOCUS_DY + 30 - clipR,
                            w: clipR * 2,
                            h: clipR * 2,
                            src: photo,
                            focal,
                            zoom: rootZoom,
                          });
                          return null;
                        })()}
                        <circle r={ROOT_R} fill="#fff" stroke={ring} strokeWidth={3} />
                        <text y={108} x={0} textAnchor="middle" fontSize={17} fontWeight={700} fill="#0f172a" style={{ pointerEvents: "none" }}>
                          {combinedName}
                        </text>
                        {combinedYears && (
                          <text y={128} x={0} textAnchor="middle" fontSize={13} fill="#64748b" style={{ pointerEvents: "none" }}>
                            {combinedYears}
                          </text>
                        )}
                      </g>
                    );
                  }

                  return centers.map((p, i) => {
                    const n = centers.length;
                    const step = 2 * ROOT_R + ROOT_GAP;
                    const xOff = n === 1 ? 0 : (i - (n - 1) / 2) * step;
                    const name = p.displayName ?? p.id;
                    const slug = personSlugFromPage(p.personPage);
                    const pInfo = photoInfos[p.id];
                    const photo = pInfo?.url ?? null;
                    const rootFocal = pInfo?.focal ?? ([0.5, 0.5] as [number, number]);
                    const rootZoom = pInfo?.zoom ?? 1;
                    const years = yearRange(p);
                    const ring = chartStrokeFromBirthPlace(p.birthPlace);
                    const shortName = name.length > 22 ? `${name.slice(0, 21)}…` : name;
                    const photoY = photo ? 108 : 6;
                    const yearsY = photo ? 128 : 26;
                    return (
                      <g key={p.id} transform={`translate(${xOff},0)`}>
                        <circle r={ROOT_R} fill="#fff" stroke={ring} strokeWidth={3} />
                        {photo ? (() => {
                          photoLayer.push({
                            key: `root-${p.id}`,
                            x: CX + xOff - 70,
                            y: chartCY + ROOT_FOCUS_DY - 70,
                            w: 140,
                            h: 140,
                            src: photo,
                            focal: rootFocal,
                            zoom: rootZoom,
                          });
                          return null;
                        })() : null}
                        {slug ? (
                          <circle
                            r={ROOT_R}
                            fill="transparent"
                            data-href={`/people/${slug}`}
                            className="hover:fill-blue-100/40 cursor-pointer"
                          />
                        ) : null}
                        <text y={photoY} x={0} textAnchor="middle" fontSize={n === 2 ? 17 : 20} fontWeight={700} fill="#0f172a" style={{ pointerEvents: "none" }}>
                          {shortName}
                        </text>
                        {years ? (
                          <text y={yearsY} x={0} textAnchor="middle" fontSize={n === 2 ? 13 : 15} fill="#64748b" style={{ pointerEvents: "none" }}>
                            {years}
                          </text>
                        ) : null}
                      </g>
                    );
                  });
                })()}
              </g>
            </g>

            {/* Photo layer: foreignObject with CSS background-image (no CSS transform — avoids iOS WebKit foreignObject clipping bugs) */}
            {photoLayer.map((p) => (
              <foreignObject
                key={p.key}
                x={p.x}
                y={p.y}
                width={p.w}
                height={p.h}
                style={{ pointerEvents: "none" }}
              >
                <div style={photoBgStyle(p.src, p.focal, p.zoom)} />
              </foreignObject>
            ))}
            </>);
            })()}
          </g>
        </svg>
      </div>
      <ChartLegend />
    </div>
  );
}
