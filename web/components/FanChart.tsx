"use client";

import * as d3 from "d3";
import { useMemo, useCallback, useRef, useState, type ReactNode } from "react";
import {
  TransformWrapper,
  TransformComponent,
  useControls,
} from "react-zoom-pan-pinch";
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

function focalToObjectPosition(focal: [number, number]): string {
  return `${Math.round(focal[0] * 100)}% ${Math.round(focal[1] * 100)}%`;
}

function photoImgStyle(
  focal: [number, number],
  zoom: number,
): React.CSSProperties {
  const op = focalToObjectPosition(focal);
  if (zoom <= 1) {
    return {
      width: "100%",
      height: "100%",
      objectFit: "cover",
      objectPosition: op,
      display: "block",
    };
  }
  const dx = 50 - focal[0] * 100;
  const dy = 50 - focal[1] * 100;
  return {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    objectPosition: op,
    transform: `scale(${zoom}) translate(${dx.toFixed(1)}%, ${dy.toFixed(1)}%)`,
    transformOrigin: "50% 50%",
    display: "block",
  };
}

const W = 2400;
const CX = W / 2;

const FAN_ANGLE_EXTRA = Math.PI / 4;
const FAN_START = -Math.PI / 2 - FAN_ANGLE_EXTRA;
const FAN_END = Math.PI / 2 + FAN_ANGLE_EXTRA;

const TOP_GUTTER = 28;
const ROOT_STACK_BELOW = 150;

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

const BAND_SCALE = 1.07;

function ringRadii(gen: number): { inner: number; outer: number } {
  const bands = [0, 150, 140, 125, 110, 95, 85, 75].map((b, i) =>
    i === 0 ? 0 : Math.round(b * BAND_SCALE)
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

type ArcDatum = { innerRadius: number; outerRadius: number; startAngle: number; endAngle: number };

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

const ROOT_R = 90;
const ROOT_GAP = 36;

function ZoomControls() {
  const { zoomIn, zoomOut, resetTransform } = useControls();
  return (
    <div className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-lg border border-zinc-300 bg-white/95 px-1 py-0.5 shadow-sm backdrop-blur">
      <button
        type="button"
        className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded text-base font-bold text-zinc-700 hover:bg-zinc-100 active:bg-zinc-200"
        aria-label="Zoom out"
        onClick={() => zoomOut()}
      >
        −
      </button>
      <button
        type="button"
        className="flex min-h-[44px] items-center justify-center rounded px-2 text-[11px] font-semibold text-zinc-500 hover:bg-zinc-100 active:bg-zinc-200"
        aria-label="Reset zoom"
        onClick={() => resetTransform()}
      >
        Reset
      </button>
      <button
        type="button"
        className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded text-base font-bold text-zinc-700 hover:bg-zinc-100 active:bg-zinc-200"
        aria-label="Zoom in"
        onClick={() => zoomIn()}
      >
        +
      </button>
    </div>
  );
}

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

export function FanChart({ root, maxGeneration, photoInfos, centers: centersProp }: Props) {
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
      Math.sin(FAN_START - Math.PI / 2)
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

  const router = useRouter();
  const pointerOriginRef = useRef<{ x: number; y: number } | null>(null);
  const DRAG_THRESHOLD_PX = 5;

  const onSegmentPointerDown = useCallback((e: React.PointerEvent) => {
    pointerOriginRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  const onSegmentClick = useCallback(
    (e: React.MouseEvent, href: string) => {
      const origin = pointerOriginRef.current;
      if (origin) {
        const dx = e.clientX - origin.x;
        const dy = e.clientY - origin.y;
        if (dx * dx + dy * dy > DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) return;
      }
      router.push(href);
    },
    [router],
  );

  return (
    <div className="relative w-full">
      <TransformWrapper
        initialScale={1}
        minScale={0.2}
        maxScale={4}
        limitToBounds={false}
        panning={{ velocityDisabled: true }}
        doubleClick={{ mode: "reset" }}
        onInit={(ref) => { ref.centerView(1, 0); }}
      >
        <ZoomControls />
        <TransformComponent
          wrapperClass="!w-full !max-h-[min(88vh,1680px)] rounded-lg border border-zinc-200 bg-zinc-100/40"
          contentClass="!w-auto"
        >
          <svg
            width={W}
            height={chartH}
            viewBox={`0 0 ${W} ${chartH}`}
            id="fan-chart-svg"
          >
            <rect width={W} height={chartH} fill="#fafafa" />

            <g transform={`translate(${CX},${chartCY})`}>
              {segments.map((s, idx) => {
                const { inner, outer } = ringRadii(s.generation);
                const datum: ArcDatum = { innerRadius: inner, outerRadius: outer, startAngle: s.startAngle, endAngle: s.endAngle };
                const pathD = arcGen(datum);
                const [cx, cy] = arcGen.centroid(datum);
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
                        Math.min(44, band * 0.44, arcLen * 0.34, arcLenOuter * 0.3)
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
                    Math.max(veryTight ? 5.5 : 6, Math.min(band * 0.34, arcLen * (veryTight ? 0.22 : 0.28)))
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
                    Math.max(8, arcLen / 7.5)
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
                      className={slug ? "transition-colors duration-100 hover:brightness-95 cursor-pointer" : undefined}
                      onPointerDown={slug ? onSegmentPointerDown : undefined}
                      onClick={slug ? (e) => onSegmentClick(e, `/people/${slug}`) : undefined}
                    >
                      <title>{tooltip}</title>
                    </path>

                    {showPhoto && (
                      <>
                        <circle cx={cx} cy={cy - 4} r={photoR + 1.5} fill="#fff" stroke="#d4d4d8" strokeWidth={0.5} />
                        <foreignObject
                          x={cx - photoR}
                          y={cy - photoR - 4}
                          width={photoR * 2}
                          height={photoR * 2}
                          style={{ pointerEvents: "none" }}
                        >
                          <div style={{ width: "100%", height: "100%", borderRadius: "50%", overflow: "hidden" }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={photo!}
                              alt=""
                              style={photoImgStyle(photoFocal, photoZoom)}
                            />
                          </div>
                        </foreignObject>
                      </>
                    )}

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
                {/* SE edge (right) — one fewer date */}
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
                        <circle r={ROOT_R} fill="#fff" stroke={ring} strokeWidth={3} />
                        <foreignObject
                          x={-clipR}
                          y={-clipR}
                          width={clipR * 2}
                          height={clipR * 2}
                          style={{ pointerEvents: "none" }}
                        >
                          <div style={{ width: "100%", height: "100%", borderRadius: "50%", overflow: "hidden" }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={photo}
                              alt=""
                              style={photoImgStyle(focal, rootZoom)}
                            />
                          </div>
                        </foreignObject>
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
                        {photo ? (
                          <foreignObject
                            x={-70}
                            y={-70}
                            width={140}
                            height={140}
                            style={{ pointerEvents: "none" }}
                          >
                            <div style={{ width: "100%", height: "100%", borderRadius: "50%", overflow: "hidden" }}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={photo}
                                alt=""
                                style={photoImgStyle(rootFocal, rootZoom)}
                              />
                            </div>
                          </foreignObject>
                        ) : null}
                        {slug ? (
                          <circle
                            r={ROOT_R}
                            fill="transparent"
                            className="hover:fill-blue-100/40 cursor-pointer"
                            onPointerDown={onSegmentPointerDown}
                            onClick={(e) => onSegmentClick(e, `/people/${slug}`)}
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
          </svg>
        </TransformComponent>
        <ChartLegend />
      </TransformWrapper>
    </div>
  );
}
