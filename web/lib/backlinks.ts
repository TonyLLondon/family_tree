import fs from "fs";
import path from "path";
import { repoPath } from "./paths";

export interface Backlink {
  /** Display label, e.g. "David John Lewis" */
  title: string;
  /** Site route, e.g. "/people/david-john-lewis" */
  href: string;
  /** Which vault area: people, stories, topics */
  kind: "people" | "stories" | "topics";
}

type BacklinkMap = Map<string, Backlink[]>;

let cached: BacklinkMap | null = null;

/** Strip leading `./` and `../` so `../sources/corpus/foo/...` matches like `sources/corpus/foo/...`. */
function normalizeLinkTargetForExtraction(linkTarget: string): string {
  const pathOnly = linkTarget.split("#")[0] ?? linkTarget;
  let s = pathOnly;
  while (s.startsWith("../") || s.startsWith("./")) {
    if (s.startsWith("../")) s = s.slice(3);
    else if (s.startsWith("./")) s = s.slice(2);
  }
  return s;
}

/**
 * Extracts the corpus slug from a vault-relative link target.
 * Handles patterns:
 *   sources/corpus/<slug>/...
 *   ../sources/corpus/<slug>/...   (from people/, stories/, topics/)
 *   corpus/<slug>/...              (relative from sources/*.md)
 */
function extractCorpusSlug(linkTarget: string): string | null {
  const norm = normalizeLinkTargetForExtraction(linkTarget);
  const m =
    norm.match(/^sources\/corpus\/([^/]+)/) ?? norm.match(/^corpus\/([^/]+)/);
  return m ? m[1]! : null;
}

/**
 * Extracts the source card slug from a vault-relative link target.
 * Handles: sources/<slug>.md (not under sources/corpus/).
 */
function extractSourceCardSlug(linkTarget: string): string | null {
  const norm = normalizeLinkTargetForExtraction(linkTarget);
  if (/sources\/corpus\//.test(norm)) return null;
  const m = norm.match(/^sources\/([^/]+)\.md$/);
  return m ? m[1]! : null;
}

function firstH1(content: string): string | null {
  for (const line of content.split(/\r?\n/)) {
    const m = line.match(/^#\s+(.+)$/);
    if (m) return m[1]!.trim();
  }
  return null;
}

function titleFromSlug(slug: string): string {
  return slug
    .split(/[-_]+/)
    .filter(Boolean)
    .map((w, i) => {
      if (i === 0) return w.charAt(0).toUpperCase() + w.slice(1);
      return w;
    })
    .join(" ");
}

function scanDir(
  dir: string,
  kind: "people" | "stories" | "topics",
  routePrefix: string,
  map: BacklinkMap,
) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md"));
  for (const file of files) {
    const abs = path.join(dir, file);
    const raw = fs.readFileSync(abs, "utf8");
    const slug = file.replace(/\.md$/, "");
    const title = firstH1(raw) ?? titleFromSlug(slug);
    const href = `${routePrefix}/${encodeURIComponent(slug)}`;
    const backlink: Backlink = { title, href, kind };

    const linkPattern = /\[[^\]]*\]\(([^)]+)\)/g;
    let match: RegExpExecArray | null;
    const seen = new Set<string>();

    while ((match = linkPattern.exec(raw)) !== null) {
      const target = match[1]!;

      const corpusSlug = extractCorpusSlug(target);
      if (corpusSlug && !seen.has(`corpus:${corpusSlug}`)) {
        seen.add(`corpus:${corpusSlug}`);
        const arr = map.get(`corpus:${corpusSlug}`) ?? [];
        arr.push(backlink);
        map.set(`corpus:${corpusSlug}`, arr);
      }

      const cardSlug = extractSourceCardSlug(target);
      if (cardSlug && !seen.has(`card:${cardSlug}`)) {
        seen.add(`card:${cardSlug}`);
        const arr = map.get(`card:${cardSlug}`) ?? [];
        arr.push(backlink);
        map.set(`card:${cardSlug}`, arr);
      }
    }
  }
}

function buildBacklinkMap(): BacklinkMap {
  const map: BacklinkMap = new Map();
  scanDir(repoPath("people"), "people", "/people", map);
  scanDir(repoPath("stories"), "stories", "/stories", map);
  scanDir(repoPath("topics"), "topics", "/topics", map);
  return map;
}

/** Backlinks pointing at a corpus bundle slug. */
export function getCorpusBacklinks(corpusSlug: string): Backlink[] {
  if (!cached) cached = buildBacklinkMap();
  return cached.get(`corpus:${corpusSlug}`) ?? [];
}

/** Backlinks pointing at a source citation card slug. */
export function getCardBacklinks(cardSlug: string): Backlink[] {
  if (!cached) cached = buildBacklinkMap();
  return cached.get(`card:${cardSlug}`) ?? [];
}

/** Combined deduplicated backlinks for a unified source page. */
export function getSourceBacklinks(
  cardSlug: string | null,
  corpusSlugs: string[],
): Backlink[] {
  if (!cached) cached = buildBacklinkMap();
  const seen = new Set<string>();
  const out: Backlink[] = [];
  const add = (bl: Backlink) => {
    if (seen.has(bl.href)) return;
    seen.add(bl.href);
    out.push(bl);
  };
  if (cardSlug) {
    for (const bl of cached.get(`card:${cardSlug}`) ?? []) add(bl);
  }
  for (const cs of corpusSlugs) {
    for (const bl of cached.get(`corpus:${cs}`) ?? []) add(bl);
  }
  out.sort((a, b) => a.title.localeCompare(b.title));
  return out;
}
