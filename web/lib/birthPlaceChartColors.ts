import { rgb } from "d3-color";

/** Sun-chart style: region of birth → fill. Order is first-match wins (most specific first). */
const RULES: { id: string; label: string; test: (n: string) => boolean; base: string }[] = [
  {
    id: "zara",
    label: "Zara / Zadar (Dalmatia)",
    test: (n) => /\bzara\b/.test(n) || /\bzadar\b/.test(n),
    base: "#C9A227",
  },
  {
    id: "dalmatia",
    label: "Other Dalmatia / Croatia",
    test: (n) =>
      /\bdalmatia\b/.test(n) ||
      /\bcroatia\b/.test(n) ||
      /\bsplit\b/.test(n) ||
      /\bcattaro\b/.test(n) ||
      /\bvinodol\b/.test(n),
    base: "#38BDF8",
  },
  {
    id: "italy",
    label: "Italy (e.g. Venice, Florence)",
    test: (n) =>
      /\bitaly\b/.test(n) ||
      /\bitalia\b/.test(n) ||
      /\bvenice\b/.test(n) ||
      /\bvenezia\b/.test(n) ||
      /\bflorence\b/.test(n) ||
      /\bfirenze\b/.test(n) ||
      /\bliguria\b/.test(n) ||
      /\blombardy\b/.test(n) ||
      /\bsicily\b/.test(n) ||
      /\bsicilia\b/.test(n) ||
      /\bgenoa\b/.test(n) ||
      /\bgenova\b/.test(n) ||
      /\btrieste\b/.test(n) ||
      /\bfriuli\b/.test(n) ||
      /\bpalermo\b/.test(n) ||
      /\bbrescia\b/.test(n) ||
      /\budine\b/.test(n) ||
      /\bmetropolitan city of genoa\b/.test(n),
    base: "#5C7A8C",
  },
  {
    id: "iran",
    label: "Persia / Iran",
    test: (n) =>
      /\biran\b/.test(n) ||
      /\bpersia\b/.test(n) ||
      /\btehran\b/.test(n) ||
      /\btabriz\b/.test(n) ||
      /\btabrīz\b/.test(n),
    base: "#16A34A",
  },
  {
    id: "india",
    label: "India",
    test: (n) =>
      /\bindia\b/.test(n) ||
      /\bmadras\b/.test(n) ||
      /\bbengal\b/.test(n) ||
      /\bmumbai\b/.test(n) ||
      /\bbombay\b/.test(n) ||
      /\bjabalpur\b/.test(n),
    base: "#EA580C",
  },
  {
    id: "chile",
    label: "Chile",
    test: (n) => /\bchile\b/.test(n) || /\bparral\b/.test(n) || /\bcauquenes\b/.test(n) || /\bmaule,\s*chile\b/.test(n),
    base: "#C45C3A",
  },
  {
    id: "usa",
    label: "U.S.A.",
    test: (n) =>
      /\bunited states\b/.test(n) ||
      /\bcalifornia\b/.test(n) ||
      /\blos gatos\b/.test(n) ||
      /\b,\s*usa\b/.test(n) ||
      /\bu\.s\.a\.?\b/.test(n),
    base: "#0F172A",
  },
  {
    id: "australia",
    label: "Australia",
    test: (n) => /\baustralia\b/.test(n) || /\bcanberra\b/.test(n),
    base: "#FEF08A",
  },
  {
    id: "france",
    label: "France",
    test: (n) => /\bfrance\b/.test(n),
    base: "#2563EB",
  },
  {
    id: "germany",
    label: "Germany",
    test: (n) =>
      /\bgermany\b/.test(n) ||
      /\bdeutschland\b/.test(n) ||
      /\bgotha\b/.test(n) ||
      /\bthüringen\b/.test(n) ||
      /\bthuringen\b/.test(n) ||
      /\bohrdruf\b/.test(n) ||
      /\bschweinau\b/.test(n),
    base: "#EAB308",
  },
  {
    id: "switzerland",
    label: "Switzerland",
    test: (n) =>
      /\bswitzerland\b/.test(n) ||
      /\bsuisse\b/.test(n) ||
      /\bschweiz\b/.test(n) ||
      /\bthurgau\b/.test(n) ||
      /\bmorges\b/.test(n) ||
      /\bgeneva\b/.test(n) ||
      /\bgenève\b/.test(n) ||
      /\bgeneve\b/.test(n),
    base: "#DC2626",
  },
  {
    id: "wales",
    label: "Wales",
    test: (n) =>
      /\bwales\b/.test(n) ||
      /\bglamorgan\b/.test(n) ||
      /\bglamorganshire\b/.test(n) ||
      /\bmerthyr\b/.test(n) ||
      /\baberdare\b/.test(n) ||
      /\bbrecknockshire\b/.test(n) ||
      /\bcarmarthenshire\b/.test(n) ||
      /\bmonmouthshire\b/.test(n) ||
      /\bneath\b/.test(n) ||
      /\bdowlais\b/.test(n) ||
      /\babersychan\b/.test(n) ||
      /\bllansamlet\b/.test(n) ||
      /\btrecastle\b/.test(n),
    base: "#DC2626",
  },
  {
    id: "ireland",
    label: "Ireland",
    test: (n) =>
      /\bireland\b/.test(n) ||
      /\béire\b/.test(n) ||
      /\bcounty cork\b/.test(n) ||
      /\bcounty limerick\b/.test(n) ||
      /\bcounty wexford\b/.test(n) ||
      /\bcounty wicklow\b/.test(n) ||
      /\bcounty carlow\b/.test(n) ||
      /\bcounty kildare\b/.test(n) ||
      /\bdublin\b/.test(n) ||
      /\bcork,\s*county\b/.test(n) ||
      /\bmunster\b/.test(n) ||
      /\bconnacht\b/.test(n) ||
      /\bclare,\s*ireland\b/.test(n) ||
      /\btipperary,\s*munster\b/.test(n) ||
      /\blimerick,\s*county\b/.test(n) ||
      /\blimerick city\b/.test(n) ||
      /\bbrickfield,\s*limerick\b/.test(n),
    base: "#4ADE80",
  },
  {
    id: "russiaBaltic",
    label: "Russia & Baltic (incl. Reval / Tallinn)",
    test: (n) =>
      /\brussia\b/.test(n) ||
      /\bestonia\b/.test(n) ||
      /\blivland\b/.test(n) ||
      /\btallinn\b/.test(n) ||
      /\btalinn\b/.test(n) ||
      /\breval\b/.test(n) ||
      /\briga\b/.test(n) ||
      /\brakvere\b/.test(n) ||
      /\bpärnu\b/.test(n) ||
      /\bparnu\b/.test(n) ||
      /\bst\.?\s*petersburg\b/.test(n) ||
      /\bsaint petersburg\b/.test(n) ||
      /\bleal\b/.test(n) ||
      /\bfellin\b/.test(n) ||
      /\bhaggers\b/.test(n) ||
      /\bviljandi\b/.test(n),
    base: "#1E3A5F",
  },
  {
    id: "london",
    label: "London",
    test: (n) =>
      /\blondon\b/.test(n) ||
      /\bislington\b/.test(n) ||
      /\bcamden\b/.test(n) ||
      /\bholborn\b/.test(n) ||
      /\bclerkenwell\b/.test(n) ||
      /\bhammersmith\b/.test(n) ||
      /\bfulham\b/.test(n) ||
      /\bmarylebone\b/.test(n) ||
      /\blambeth\b/.test(n) ||
      /\bcharterhouse\b/.test(n) ||
      /\bholloway\b/.test(n) ||
      /\bwestminster\b/.test(n) ||
      /\bsouthwark\b/.test(n) ||
      /\btower hamlets\b/.test(n) ||
      /\bmiddlesex\b/.test(n),
    base: "#D8B4FE",
  },
  {
    id: "caucasusGeorgia",
    label: "Tbilisi / Caucasus Georgia",
    test: (n) => /^georgia$/i.test(n.trim()) || /\btbilisi\b/.test(n),
    base: "#CA8A04",
  },
  {
    id: "england",
    label: "England (elsewhere in U.K.)",
    test: (n) =>
      /\bengland\b/.test(n) ||
      /\bscotland\b/.test(n) ||
      /\bunited kingdom\b/.test(n) ||
      /\bgreat britain\b/.test(n) ||
      /\bessex\b/.test(n) ||
      /\bhertfordshire\b/.test(n) ||
      /\bhuntingdonshire\b/.test(n) ||
      /\bwestmorland\b/.test(n) ||
      /\blancashire\b/.test(n) ||
      /\bdurham\b/.test(n) ||
      /\bcumberland\b/.test(n) ||
      /\bbedfordshire\b/.test(n) ||
      /\bbuckinghamshire\b/.test(n) ||
      /\bsomerset\b/.test(n) ||
      /\boxfordshire\b/.test(n) ||
      /\bnorthumberland\b/.test(n) ||
      /\byorkshire\b/.test(n) ||
      /\bsurrey\b/.test(n) ||
      /\bcheshire\b/.test(n) ||
      /\bkent\b/.test(n) ||
      /\bstaffordshire\b/.test(n) ||
      /\bdevon\b/.test(n) ||
      /\bcornwall\b/.test(n) ||
      /\bshropshire\b/.test(n) ||
      /\bhereford\b/.test(n) ||
      /\bnorfolk\b/.test(n) ||
      /\bsussex\b/.test(n) ||
      /\bhampshire\b/.test(n) ||
      /\bwiltshire\b/.test(n) ||
      /\bderbyshire\b/.test(n) ||
      /\bnottinghamshire\b/.test(n) ||
      /\bwarwickshire\b/.test(n) ||
      /\bcambridgeshire\b/.test(n) ||
      /\bgloucestershire\b/.test(n) ||
      /\bperthshire\b/.test(n) ||
      /\bberkshire\b/.test(n) ||
      /\bisle of wight\b/.test(n) ||
      /\borkney\b/.test(n) ||
      /\bshetland\b/.test(n) ||
      /\bbedfordshire\b/.test(n) ||
      /\bhunts\b/.test(n) ||
      /\bsurrey north\b/.test(n) ||
      /\bmaldon\b/.test(n),
    base: "#F1F5F9",
  },
];

const UNKNOWN_BASE = "#CBD5E1";

/** Exported for the chart legend (fixed order, matches Sun Chart 200812 model). */
export const CHART_BIRTH_PLACE_LEGEND: { id: string; label: string; color: string }[] = [
  ...RULES.map((r) => ({ id: r.id, label: r.label, color: r.base })),
  { id: "unknown", label: "Unknown / other", color: UNKNOWN_BASE },
];

export function classifyBirthPlaceRegion(birthPlace: string | undefined): string {
  const raw = (birthPlace ?? "").trim();
  if (!raw) return "unknown";
  const n = raw.toLowerCase();
  for (const r of RULES) {
    if (r.test(n)) return r.id;
  }
  return "unknown";
}

function pairFromBase(base: string): [string, string] {
  const c = rgb(base);
  const a = c.formatHex();
  const dim = rgb(Math.round(c.r * 0.92), Math.round(c.g * 0.92), Math.round(c.b * 0.92));
  return [a, dim.formatHex()];
}

/** Two fills for alternating wedge shading (same as former generation striping). */
export function chartFillPairFromBirthPlace(birthPlace: string | undefined): [string, string] {
  const id = classifyBirthPlaceRegion(birthPlace);
  if (id === "unknown") return pairFromBase(UNKNOWN_BASE);
  const rule = RULES.find((r) => r.id === id);
  return pairFromBase(rule?.base ?? UNKNOWN_BASE);
}

export function chartStrokeFromBirthPlace(birthPlace: string | undefined): string {
  const id = classifyBirthPlaceRegion(birthPlace);
  if (id === "unknown") return "#64748B";
  const rule = RULES.find((r) => r.id === id);
  const base = rule?.base ?? UNKNOWN_BASE;
  const c = rgb(base);
  return rgb(Math.round(c.r * 0.75), Math.round(c.g * 0.75), Math.round(c.b * 0.75)).formatHex();
}

function segmentLuminance(hex: string): number {
  const c = rgb(hex);
  return (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255;
}

/** Name text on wedge: light on dark fills (e.g. U.S.A., Baltic). */
export function chartNameFillForSegmentFill(fill: string): string {
  return segmentLuminance(fill) < 0.52 ? "#F8FAFC" : "#1e293b";
}

export function chartYearsFillForSegmentFill(fill: string): string {
  return segmentLuminance(fill) < 0.52 ? "#CBD5E1" : "#71717a";
}
