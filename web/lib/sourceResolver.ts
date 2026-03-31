import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { repoPath } from "./paths";
import { extractFirstHeading, extractBlurb, titleFromSlug } from "./browse";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface ResolvedSource {
  /** The slug used in the URL (card slug or corpus slug). */
  slug: string;
  title: string;
  blurb: string;

  /** Citation card prose (markdown body, frontmatter stripped). */
  cardContent: string | null;
  cardFilePath: string | null;
  cardFrontmatter: Record<string, unknown> | null;

  /** Best corpus content to show inline. */
  corpusContent: string | null;
  corpusContentFilePath: string | null;
  corpusContentLabel: string | null;
  isMachineExtract: boolean;

  /** All corpus slugs this source is backed by. */
  corpusSlugs: string[];

  /** Files in the primary corpus bundle (for the collapsed file list). */
  bundleFiles: string[];
  /** Subdirectories in the primary corpus bundle. */
  bundleSubdirs: string[];
  /** Primary corpus slug (first one / matching one). */
  primaryCorpusSlug: string | null;

  /** Provenance from source.yaml. */
  provenance: SourceProvenance | null;

  /** Whether an original PDF or media reference exists. */
  hasPdf: boolean;
  pdfUrl: string | null;
}

export interface SourceProvenance {
  primaryPdfUrl?: string;
  webpageUrl?: string;
  fetchDate?: string;
}

/* ------------------------------------------------------------------ */
/*  Slug enumeration                                                   */
/* ------------------------------------------------------------------ */

/**
 * Corpus slugs that are "owned" by a citation card — via `corpus:` in YAML
 * frontmatter OR via markdown links to `corpus/<slug>/` in the body.
 * These should not appear as separate index entries.
 */
function getOwnedCorpusSlugs(): Set<string> {
  const owned = new Set<string>();
  const sourcesDir = repoPath("sources");
  if (!fs.existsSync(sourcesDir)) return owned;

  for (const ent of fs.readdirSync(sourcesDir, { withFileTypes: true })) {
    if (!ent.isFile() || !ent.name.endsWith(".md")) continue;
    const abs = path.join(sourcesDir, ent.name);
    try {
      const raw = fs.readFileSync(abs, "utf8");
      const { data, content } = matter(raw);

      const c = data.corpus;
      if (typeof c === "string") {
        owned.add(c.replace(/^corpus\//, ""));
      } else if (Array.isArray(c)) {
        for (const x of c) owned.add(String(x).replace(/^corpus\//, ""));
      }

      const linkPattern = /\]\((?:\.\.\/sources\/)?corpus\/([^/)]+)/g;
      let m: RegExpExecArray | null;
      while ((m = linkPattern.exec(content)) !== null) {
        owned.add(m[1]!);
      }
    } catch {
      // skip unparseable files
    }
  }
  return owned;
}

/**
 * All unified source slugs: every citation card + every corpus bundle
 * NOT already owned by a card. Each slug gets one page at /sources/[slug].
 */
export function getAllSourceSlugs(): string[] {
  const slugs = new Set<string>();

  const sourcesDir = repoPath("sources");
  if (fs.existsSync(sourcesDir)) {
    for (const ent of fs.readdirSync(sourcesDir, { withFileTypes: true })) {
      if (
        ent.isFile() &&
        ent.name.endsWith(".md") &&
        ent.name !== "corpus-bibliography.md" &&
        ent.name !== "master-source-list.md" &&
        ent.name !== "legacy-index.md"
      ) {
        slugs.add(ent.name.replace(/\.md$/, ""));
      }
    }
  }

  const owned = getOwnedCorpusSlugs();

  const corpusDir = repoPath("sources", "corpus");
  if (fs.existsSync(corpusDir)) {
    for (const ent of fs.readdirSync(corpusDir, { withFileTypes: true })) {
      if (ent.isDirectory() && !ent.name.startsWith(".")) {
        const corpusSlug = ent.name;
        if (!owned.has(corpusSlug) && !slugs.has(corpusSlug)) {
          slugs.add(corpusSlug);
        }
      }
    }
  }

  return Array.from(slugs).sort();
}

/**
 * Every slug that needs a /sources/[slug] static page — includes owned corpus
 * slugs (they still need pages for direct links and /corpus/ redirects).
 */
export function getAllSourcePageSlugs(): string[] {
  const slugs = new Set<string>();

  const sourcesDir = repoPath("sources");
  if (fs.existsSync(sourcesDir)) {
    for (const ent of fs.readdirSync(sourcesDir, { withFileTypes: true })) {
      if (
        ent.isFile() &&
        ent.name.endsWith(".md") &&
        ent.name !== "corpus-bibliography.md" &&
        ent.name !== "master-source-list.md" &&
        ent.name !== "legacy-index.md"
      ) {
        slugs.add(ent.name.replace(/\.md$/, ""));
      }
    }
  }

  const corpusDir = repoPath("sources", "corpus");
  if (fs.existsSync(corpusDir)) {
    for (const ent of fs.readdirSync(corpusDir, { withFileTypes: true })) {
      if (ent.isDirectory() && !ent.name.startsWith(".")) {
        slugs.add(ent.name);
      }
    }
  }

  return Array.from(slugs).sort();
}

/* ------------------------------------------------------------------ */
/*  Resolver                                                           */
/* ------------------------------------------------------------------ */

function readYaml(absPath: string): Record<string, unknown> | null {
  if (!fs.existsSync(absPath)) return null;
  try {
    const raw = fs.readFileSync(absPath, "utf8");
    const { data } = matter(`---\n${raw}\n---`);
    return data;
  } catch {
    return null;
  }
}

function parseCorpusFrontmatter(
  fm: Record<string, unknown>,
): string[] {
  const c = fm.corpus;
  if (!c) return [];
  if (typeof c === "string") {
    return [c.replace(/^corpus\//, "")];
  }
  if (Array.isArray(c)) {
    return c.map((x) => String(x).replace(/^corpus\//, ""));
  }
  return [];
}

const CONTENT_PRIORITY = [
  { pattern: /^transcription.*\.md$/i, label: "Transcription" },
  { pattern: /^translation.*\.md$/i, label: "Translation" },
  { pattern: /^reference\.md$/i, label: "Reference" },
  { pattern: /^extracted\.pdf\.md$/i, label: "Machine extract (PDF)" },
  { pattern: /^extracted\.web\.md$/i, label: "Machine extract (web)" },
];

function pickBestContent(
  bundleDir: string,
  files: string[],
): { content: string; filePath: string; label: string; isMachine: boolean } | null {
  for (const { pattern, label } of CONTENT_PRIORITY) {
    const match = files.find((f) => pattern.test(f));
    if (match) {
      const abs = path.join(bundleDir, match);
      const raw = fs.readFileSync(abs, "utf8");
      const { content } = matter(raw);
      const relPath = path.relative(repoPath(), abs).split(path.sep).join("/");
      const isMachine = /^extracted\./i.test(match);
      return { content, filePath: relPath, label, isMachine };
    }
  }
  return null;
}

function extractProvenance(yaml: Record<string, unknown> | null): SourceProvenance | null {
  if (!yaml) return null;
  const remote = yaml.remote as Record<string, unknown> | undefined;
  const fetches = yaml.fetches as Array<Record<string, unknown>> | undefined;
  const prov: SourceProvenance = {};
  if (remote) {
    if (typeof remote.primary_pdf_url === "string") prov.primaryPdfUrl = remote.primary_pdf_url;
    if (typeof remote.webpage_url === "string") prov.webpageUrl = remote.webpage_url;
  }
  if (fetches && fetches.length > 0) {
    const last = fetches[fetches.length - 1]!;
    if (typeof last["last-modified"] === "string") prov.fetchDate = last["last-modified"];
  }
  if (!prov.primaryPdfUrl && !prov.webpageUrl && !prov.fetchDate) return null;
  return prov;
}

export function resolveSource(slug: string): ResolvedSource | null {
  const cardPath = repoPath("sources", `${slug}.md`);
  const corpusDir = repoPath("sources", "corpus", slug);
  const hasCard = fs.existsSync(cardPath);
  const hasCorpus = fs.existsSync(corpusDir) && fs.statSync(corpusDir).isDirectory();

  if (!hasCard && !hasCorpus) return null;

  let cardContent: string | null = null;
  let cardFilePath: string | null = null;
  let cardFrontmatter: Record<string, unknown> | null = null;
  let cardTitle: string | null = null;
  let cardBlurb = "";
  let corpusSlugsFromCard: string[] = [];

  if (hasCard) {
    const raw = fs.readFileSync(cardPath, "utf8");
    const parsed = matter(raw);
    cardContent = parsed.content;
    cardFilePath = `sources/${slug}.md`;
    cardFrontmatter = parsed.data as Record<string, unknown>;
    cardTitle =
      (typeof cardFrontmatter.title === "string" && cardFrontmatter.title) ||
      extractFirstHeading(parsed.content);
    cardBlurb = extractBlurb(parsed.content);
    corpusSlugsFromCard = parseCorpusFrontmatter(cardFrontmatter);
  }

  const allCorpusSlugs = new Set(corpusSlugsFromCard);
  if (hasCorpus) allCorpusSlugs.add(slug);

  let corpusContent: string | null = null;
  let corpusContentFilePath: string | null = null;
  let corpusContentLabel: string | null = null;
  let isMachineExtract = false;
  let bundleFiles: string[] = [];
  let bundleSubdirs: string[] = [];
  let primaryCorpusSlug: string | null = null;
  let provenance: SourceProvenance | null = null;
  let hasPdf = false;
  let pdfUrl: string | null = null;

  const primarySlug = hasCorpus ? slug : corpusSlugsFromCard[0] ?? null;
  if (primarySlug) {
    const dir = repoPath("sources", "corpus", primarySlug);
    if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
      primaryCorpusSlug = primarySlug;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      bundleFiles = entries
        .filter((e) => e.isFile())
        .map((e) => e.name)
        .sort();
      bundleSubdirs = entries
        .filter((e) => e.isDirectory() && !e.name.startsWith("."))
        .map((e) => e.name)
        .sort();

      const best = pickBestContent(dir, bundleFiles);
      if (best) {
        corpusContent = best.content;
        corpusContentFilePath = best.filePath;
        corpusContentLabel = best.label;
        isMachineExtract = best.isMachine;
      }

      const yamlData = readYaml(path.join(dir, "source.yaml"));
      provenance = extractProvenance(yamlData);

      if (bundleFiles.includes("original.pdf")) {
        hasPdf = true;
        pdfUrl = `/files/sources/corpus/${encodeURIComponent(primarySlug)}/original.pdf`;
      } else if (yamlData) {
        const mediaRef = yamlData["files.media_reference"] ?? (yamlData.files as Record<string, unknown> | undefined)?.media_reference;
        if (typeof mediaRef === "string") {
          hasPdf = /\.pdf$/i.test(mediaRef);
          if (hasPdf) {
            pdfUrl = `/files/${mediaRef.split("/").map(encodeURIComponent).join("/")}`;
          }
        }
      }
    }
  }

  let corpusTitle: string | null = null;
  if (hasCorpus && !cardTitle) {
    const refMd = path.join(corpusDir, "reference.md");
    if (fs.existsSync(refMd)) {
      const raw = fs.readFileSync(refMd, "utf8");
      const { content } = matter(raw);
      corpusTitle = extractFirstHeading(content);
      if (!cardBlurb) cardBlurb = extractBlurb(content);
    }
    if (!corpusTitle && corpusContent) {
      corpusTitle = extractFirstHeading(corpusContent);
    }
  }

  const title = cardTitle ?? corpusTitle ?? titleFromSlug(slug);

  return {
    slug,
    title,
    blurb: cardBlurb,
    cardContent,
    cardFilePath,
    cardFrontmatter,
    corpusContent,
    corpusContentFilePath,
    corpusContentLabel,
    isMachineExtract,
    corpusSlugs: Array.from(allCorpusSlugs),
    bundleFiles,
    bundleSubdirs,
    primaryCorpusSlug,
    provenance,
    hasPdf,
    pdfUrl,
  };
}
