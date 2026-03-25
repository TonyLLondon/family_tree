"use client";

import * as d3 from "d3";
import { useMemo, useCallback, useRef, type ReactNode } from "react";
import {
  TransformWrapper,
  TransformComponent,
  useControls,
} from "react-zoom-pan-pinch";
import { useRouter } from "next/navigation";
import type { AncestorNode, Person } from "@/lib/genealogy";
import { personSlugFromPage } from "@/lib/genealogy";
import {
  chartFillPairFromBirthPlace,
  chartNameFillForSegmentFill,
  chartStrokeFromBirthPlace,
  chartYearsFillForSegmentFill,
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
  photoUrls: Record<string, string | null>;
  centers?: Person[];
};

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
    <div className="absolute right-3 top-3 z-10 flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white/95 px-1.5 py-1 shadow-sm backdrop-blur">
      <button
        type="button"
        className="rounded px-2 py-0.5 text-base font-bold text-zinc-700 hover:bg-zinc-100"
        aria-label="Zoom out"
        onClick={() => zoomOut()}
      >
        −
      </button>
      <button
        type="button"
        className="rounded px-2 py-0.5 text-[11px] font-semibold text-zinc-500 hover:bg-zinc-100"
        aria-label="Reset zoom"
        onClick={() => resetTransform()}
      >
        Reset
      </button>
      <button
        type="button"
        className="rounded px-2 py-0.5 text-base font-bold text-zinc-700 hover:bg-zinc-100"
        aria-label="Zoom in"
        onClick={() => zoomIn()}
      >
        +
      </button>
    </div>
  );
}

export function FanChart({ root, maxGeneration, photoUrls, centers: centersProp }: Props) {
  const segments = useMemo(() => {
    const out: FanSegment[] = [];
    layoutAncestors(root, maxGeneration, out);
    return out;
  }, [root, maxGeneration]);

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
        initialScale={0.5}
        minScale={0.2}
        maxScale={4}
        centerOnInit
        limitToBounds={false}
        panning={{ velocityDisabled: true }}
        doubleClick={{ mode: "reset" }}
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
                const photo = photoUrls[s.id];
                const name = s.person?.displayName ?? "?";
                const years = yearRange(s.person);
                const span = s.endAngle - s.startAngle;
                const pair = chartFillPairFromBirthPlace(s.person?.birthPlace);
                const fill = pair[idx % 2];
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
                const clipId = `fc-${idx}`;
                const tooltip = [name, years].filter(Boolean).join(" · ");

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
                        <defs>
                          <clipPath id={clipId}>
                            <circle cx={cx} cy={cy - 4} r={photoR} />
                          </clipPath>
                        </defs>
                        <circle cx={cx} cy={cy - 4} r={photoR + 1.5} fill="#fff" stroke="#d4d4d8" strokeWidth={0.5} />
                        <image
                          href={photo!}
                          x={cx - photoR}
                          y={cy - photoR - 4}
                          width={photoR * 2}
                          height={photoR * 2}
                          clipPath={`url(#${clipId})`}
                          preserveAspectRatio="xMidYMid slice"
                          style={{ pointerEvents: "none" }}
                        />
                      </>
                    )}

                    {labelBody}
                  </g>
                );
              })}

              <g transform={`translate(0,${ROOT_FOCUS_DY})`}>
                {centers.map((p, i) => {
                  const n = centers.length;
                  const step = 2 * ROOT_R + ROOT_GAP;
                  const xOff = n === 1 ? 0 : (i - (n - 1) / 2) * step;
                  const name = p.displayName ?? p.id;
                  const slug = personSlugFromPage(p.personPage);
                  const photo = photoUrls[p.id];
                  const years = yearRange(p);
                  const ring = chartStrokeFromBirthPlace(p.birthPlace);
                  const shortName = name.length > 22 ? `${name.slice(0, 21)}…` : name;
                  const photoY = photo ? 108 : 6;
                  const yearsY = photo ? 128 : 26;
                  return (
                    <g key={p.id} transform={`translate(${xOff},0)`}>
                      <circle r={ROOT_R} fill="#fff" stroke={ring} strokeWidth={3} />
                      {photo ? (
                        <>
                          <defs>
                            <clipPath id={`root-clip-${p.id}`}>
                              <circle r={70} />
                            </clipPath>
                          </defs>
                          <image
                            href={photo}
                            x={-70}
                            y={-70}
                            width={140}
                            height={140}
                            clipPath={`url(#root-clip-${p.id})`}
                            preserveAspectRatio="xMidYMid slice"
                            style={{ pointerEvents: "none" }}
                          />
                        </>
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
                })}
              </g>
            </g>
          </svg>
        </TransformComponent>
      </TransformWrapper>
    </div>
  );
}
