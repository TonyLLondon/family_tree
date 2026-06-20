import fs from "fs";
import matter from "gray-matter";
import { repoPath } from "@/lib/paths";
import type { ResolvedSource } from "@/lib/sourceResolver";
import { sourceBrowseMeta } from "@/lib/sourceBrowseMeta";

/** Stable id for Sources index chips (single primary bucket per row). */
export type SourceBrowseCategory =
  | "census"
  | "parish-register"
  | "baptism"
  | "marriage"
  | "burial"
  | "death"
  | "birth"
  | "military"
  | "newspaper"
  | "book"
  | "web"
  | "legal"
  | "photo"
  | "index"
  | "note"
  | "other";

const ORDER: SourceBrowseCategory[] = [
  "index",
  "note",
  "census",
  "parish-register",
  "baptism",
  "marriage",
  "burial",
  "death",
  "birth",
  "military",
  "newspaper",
  "book",
  "web",
  "legal",
  "photo",
  "other",
];

export const SOURCE_CATEGORY_LABEL: Record<SourceBrowseCategory, string> = {
  index: "Multi-record indexes",
  note: "Notes & pointers",
  census: "Census",
  "parish-register": "Parish registers",
  baptism: "Baptism",
  marriage: "Marriage",
  burial: "Burial",
  death: "Death",
  birth: "Birth",
  military: "Military & service",
  newspaper: "Newspapers & periodicals",
  book: "Books & chapters",
  web: "Web captures",
  legal: "Legal & wills",
  photo: "Photographs",
  other: "Other documents",
};

export function sourceCategorySortIndex(cat: SourceBrowseCategory): number {
  const i = ORDER.indexOf(cat);
  return i === -1 ? ORDER.length : i;
}

function readCorpusYamlKind(corpusSlug: string | null): string | null {
  if (!corpusSlug) return null;
  const p = repoPath("sources", "corpus", corpusSlug, "source.yaml");
  if (!fs.existsSync(p)) return null;
  try {
    const raw = fs.readFileSync(p, "utf8");
    const { data } = matter(`---\n${raw}\n---`);
    const d = data as Record<string, unknown>;
    const k = d.kind ?? d.source_type ?? d.record_type;
    return typeof k === "string" ? k.toLowerCase() : null;
  } catch {
    return null;
  }
}

function slugTitleHay(slug: string, title: string): string {
  return `${slug} ${title}`.toLowerCase();
}

/**
 * One primary category per source row for filtering. Uses card kind, then
 * corpus source.yaml kind, then slug/title heuristics.
 */
export function inferSourceBrowseCategory(slug: string, source: ResolvedSource): SourceBrowseCategory {
  const meta = sourceBrowseMeta(source);
  if (meta.startsWith("Index")) return "index";
  if (meta === "Note") return "note";

  const fm = source.cardFrontmatter;
  const kindRaw =
    (fm?.kind as string | undefined) ?? (fm?.source_type as string | undefined);
  const fromYaml = readCorpusYamlKind(source.primaryCorpusSlug);
  const kind = (kindRaw ?? fromYaml ?? "").toLowerCase();

  const mapKind: Record<string, SourceBrowseCategory> = {
    census: "census",
    "parish-register": "parish-register",
    baptism: "baptism",
    marriage: "marriage",
    burial: "burial",
    death: "death",
    birth: "birth",
    "book-chapter": "book",
    book: "book",
    periodical: "newspaper",
    doc: "other",
    photo: "photo",
    image: "photo",
    scan: "photo",
    pdf: "other",
    web: "web",
    spreadsheet: "other",
  };
  if (kind && mapKind[kind]) return mapKind[kind]!;

  const hay = slugTitleHay(slug, source.title);
  if (/\bcensus\b|rg\d+|ho\d+|piece\s/i.test(hay)) return "census";
  if (/\bparish\b|\bregister\b|\bchurch\b|\bbanns\b/i.test(hay)) return "parish-register";
  if (/\bbaptism\b|\bchristening\b/i.test(hay)) return "baptism";
  if (/\bmarriage\b|\bwedding\b|\bmatrimon/i.test(hay)) return "marriage";
  if (/\bburial\b|\bburied\b/i.test(hay)) return "burial";
  if (/\bdeath\b|\bdied\b|\bdeath notice\b/i.test(hay)) return "death";
  if (/\bbirth\b|\bborn\b/i.test(hay)) return "birth";
  if (/\barmy\b|\bmilitary\b|\bmedal\b|\bwar\b|\bregiment\b|\bgazette\b/i.test(hay)) return "military";
  if (/\bnewspaper\b|\bobituary\b|\bnyt\b|\btimes\b|\bherald\b|\bjournal\b/i.test(hay)) return "newspaper";
  if (/\bbook\b|\bchapter\b|\bhistory\b|\bvolume\b/i.test(hay)) return "book";
  if (/\bhttp|\.html\b|wikipedia|wiki\b/i.test(hay)) return "web";
  if (/\bwill\b|\bprobate\b|\bcontract\b|\bcourt\b|\bdeed\b/i.test(hay)) return "legal";

  return "other";
}
