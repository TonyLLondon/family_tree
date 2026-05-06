import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { repoPath } from "./paths";
import { extractFirstHeading, extractBlurb, titleFromSlug } from "./browse";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface FacsimileImage {
  /** URL under /files/... ready to render. */
  src: string;
  /** Caption / alt text. */
  alt: string;
  /** True if this is the primary, full-resolution facsimile (vs a derived crop). */
  primary: boolean;
}

export interface SourceBodyContent {
  /** Markdown body (frontmatter stripped). */
  content: string;
  /** Repo-relative file path, used for resolving relative links inside the markdown. */
  filePath: string;
  /** Human-friendly section label (e.g. "Translation (English)", "Original (Italian)"). */
  label: string;
  /** ISO-639-1 language code if known (e.g. "it", "en"). */
  language?: string;
}

export interface SourceProvenance {
  primaryPdfUrl?: string;
  webpageUrl?: string;
  fetchDate?: string;
}

/** One Tier C / C+ hit: an anchor page + the focus terms that matched it + image URLs. */
export interface SourceSnippetHit {
  id: string;
  anchorPage: number;
  terms: string[];
  source: string;
  preview: string;
  /** Resolved /files/... URLs for the rendered hit pages. */
  imageUrls: string[];
}

/** Tier C / C+ selective-extraction package: manifest + per-hit transcription. */
export interface SourceSnippets {
  /** Body of `transcription.snippets.md` (frontmatter stripped). May be null until the agent writes it. */
  body: SourceBodyContent | null;
  hits: SourceSnippetHit[];
  variant: string;            // "C" or "C+"
  focus: { terms: string[]; match: string; context: number } | null;
  pageCount: number;
}

export interface ResolvedSource {
  /** The slug used in the URL (card slug or corpus slug). */
  slug: string;
  title: string;
  blurb: string;

  /** Citation card prose (markdown body, frontmatter stripped). */
  cardContent: string | null;
  cardFilePath: string | null;
  cardFrontmatter: Record<string, unknown> | null;

  /** Image facsimiles, in display order: full-page first, then crops/details, then internal pages/. */
  facsimiles: FacsimileImage[];

  /** English (or other modern-language) translation of the source, if present. */
  translation: SourceBodyContent | null;
  /** Original-language palaeographic transcription, if present (Italian, Latin, French, etc.). */
  original: SourceBodyContent | null;
  /** Structured reference (typically a field/value table) — `reference.md`. */
  reference: SourceBodyContent | null;
  /** Machine extract from a PDF or web capture (OCR / pymupdf / trafilatura). Always shown with a warning. */
  extract: SourceBodyContent | null;
  /** Tier C / C+ selective-extraction snippets (per-hit transcriptions paired with page images). */
  snippets: SourceSnippets | null;

  /** Original PDF download URL (if the bundle has `original.pdf` or media_reference points at a PDF). */
  pdfDownloadUrl: string | null;

  /** All corpus slugs this source is backed by. */
  corpusSlugs: string[];
  /** Primary corpus slug (first one / matching one). */
  primaryCorpusSlug: string | null;

  /** Provenance from source.yaml. */
  provenance: SourceProvenance | null;
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
/*  Helpers                                                            */
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

function parseCorpusFrontmatter(fm: Record<string, unknown>): string[] {
  const c = fm.corpus;
  if (!c) return [];
  if (typeof c === "string") return [c.replace(/^corpus\//, "")];
  if (Array.isArray(c)) return c.map((x) => String(x).replace(/^corpus\//, ""));
  return [];
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

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|tiff?|jfif)$/i;
const PDF_EXT = /\.pdf$/i;

function isImagePath(p: string): boolean {
  return IMAGE_EXT.test(p);
}

function filesUrl(repoRelPath: string): string {
  return "/files/" + repoRelPath.split("/").map(encodeURIComponent).join("/");
}

/** Coerce a yaml field that may be a string, an array of strings, or absent into an array of strings. */
function toStringArray(v: unknown): string[] {
  if (typeof v === "string") return [v];
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string");
  return [];
}

const LANGUAGE_NAMES: Record<string, string> = {
  it: "Italian",
  en: "English",
  fr: "French",
  de: "German",
  la: "Latin",
  es: "Spanish",
  pt: "Portuguese",
  hr: "Croatian",
  sl: "Slovene",
  ru: "Russian",
  fa: "Persian",
};

function languageLabel(code: string | undefined): string {
  if (!code) return "";
  return LANGUAGE_NAMES[code.toLowerCase()] ?? code.toUpperCase();
}

/** Detect a language tag in a transcription/translation filename like `transcription.it.md` → `it`. */
function languageFromFilename(name: string): string | undefined {
  const m = name.match(/\.([a-z]{2})\.md$/i);
  return m ? m[1]!.toLowerCase() : undefined;
}

type ContentRole =
  | "translation"
  | "original"
  | "reference"
  | "extract"
  | "snippets"
  | null;

function classifyContentFile(name: string): ContentRole {
  const lower = name.toLowerCase();
  if (!lower.endsWith(".md")) return null;
  if (lower === "reference.md") return "reference";
  if (/^extracted\.(pdf|web)\.md$/.test(lower)) return "extract";
  // Tier C/C+ per-hit transcriptions live in their own file and own section.
  if (lower === "transcription.snippets.md") return "snippets";
  // Translations: anything containing "translation", or ending in `.en.md`,
  // or `*.en.md` style suffix files.
  if (lower.includes("translation") || /\.en\.md$/.test(lower)) return "translation";
  if (lower.startsWith("transcription")) return "original";
  return null;
}

function readBodyFile(
  bundleDir: string,
  fileName: string,
): { content: string; filePath: string; frontmatter: Record<string, unknown> } | null {
  const abs = path.join(bundleDir, fileName);
  if (!fs.existsSync(abs)) return null;
  try {
    const raw = fs.readFileSync(abs, "utf8");
    const { content, data } = matter(raw);
    const relPath = path.relative(repoPath(), abs).split(path.sep).join("/");
    return { content, filePath: relPath, frontmatter: data as Record<string, unknown> };
  } catch {
    return null;
  }
}

/** Build a SourceBodyContent for the highest-priority file matching a role. */
function pickBodyForRole(
  bundleDir: string,
  files: string[],
  role: Exclude<ContentRole, null>,
  defaultLabel: string,
): SourceBodyContent | null {
  const candidates = files.filter((f) => classifyContentFile(f) === role);
  if (candidates.length === 0) return null;

  // Prefer files whose name carries an explicit language tag (transcription.it.md > transcription.md).
  candidates.sort((a, b) => {
    const aLang = languageFromFilename(a) ? 0 : 1;
    const bLang = languageFromFilename(b) ? 0 : 1;
    if (aLang !== bLang) return aLang - bLang;
    return a.localeCompare(b);
  });

  const chosen = candidates[0]!;
  const body = readBodyFile(bundleDir, chosen);
  if (!body) return null;

  const fmLang =
    typeof body.frontmatter.language === "string"
      ? body.frontmatter.language.toLowerCase()
      : undefined;
  const language = fmLang ?? languageFromFilename(chosen);

  let label = defaultLabel;
  if (language) {
    const ln = languageLabel(language);
    if (ln) label = `${defaultLabel} (${ln})`;
  }

  return { content: body.content, filePath: body.filePath, label, language };
}

/* ------------------------------------------------------------------ */
/*  Snippets manifest (Tier C / C+)                                    */
/* ------------------------------------------------------------------ */

interface SnippetsManifestRaw {
  variant?: string;
  page_count?: number;
  focus?: { terms?: string[]; match?: string; context?: number };
  hits?: Array<{
    id?: string;
    anchor_page?: number;
    terms?: string[];
    source?: string;
    preview?: string;
    image_files?: string[];
  }>;
}

function readSnippetsManifest(
  bundleDir: string,
  corpusSlug: string,
): {
  hits: SourceSnippetHit[];
  variant: string;
  pageCount: number;
  focus: { terms: string[]; match: string; context: number } | null;
} | null {
  const mPath = path.join(bundleDir, "snippets", "manifest.json");
  if (!fs.existsSync(mPath)) return null;
  let raw: SnippetsManifestRaw;
  try {
    raw = JSON.parse(fs.readFileSync(mPath, "utf8")) as SnippetsManifestRaw;
  } catch {
    return null;
  }

  const hits: SourceSnippetHit[] = (raw.hits ?? []).map((h, i) => {
    const anchor = typeof h.anchor_page === "number" ? h.anchor_page : 0;
    const imgs = (h.image_files ?? []).map((rel) =>
      filesUrl(`sources/corpus/${corpusSlug}/${rel}`),
    );
    return {
      id: h.id ?? `h${String(i + 1).padStart(3, "0")}`,
      anchorPage: anchor,
      terms: h.terms ?? [],
      source: h.source ?? "unknown",
      preview: h.preview ?? "",
      imageUrls: imgs,
    };
  });

  const focus =
    raw.focus && Array.isArray(raw.focus.terms) && raw.focus.terms.length > 0
      ? {
          terms: raw.focus.terms,
          match: raw.focus.match ?? "substring",
          context: typeof raw.focus.context === "number" ? raw.focus.context : 0,
        }
      : null;

  return {
    hits,
    variant: raw.variant ?? "C",
    pageCount: raw.page_count ?? 0,
    focus,
  };
}

/* ------------------------------------------------------------------ */
/*  Resolver                                                           */
/* ------------------------------------------------------------------ */

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

  const primarySlug = hasCorpus ? slug : corpusSlugsFromCard[0] ?? null;
  let primaryCorpusSlug: string | null = null;

  let translation: SourceBodyContent | null = null;
  let original: SourceBodyContent | null = null;
  let reference: SourceBodyContent | null = null;
  let extract: SourceBodyContent | null = null;
  let snippets: SourceSnippets | null = null;
  let facsimiles: FacsimileImage[] = [];
  let pdfDownloadUrl: string | null = null;
  let provenance: SourceProvenance | null = null;
  let corpusTitle: string | null = null;
  let corpusBlurb = "";

  if (primarySlug) {
    const dir = repoPath("sources", "corpus", primarySlug);
    if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
      primaryCorpusSlug = primarySlug;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      const files = entries
        .filter((e) => e.isFile())
        .map((e) => e.name)
        .sort();
      const subdirs = entries
        .filter((e) => e.isDirectory() && !e.name.startsWith("."))
        .map((e) => e.name)
        .sort();

      translation = pickBodyForRole(dir, files, "translation", "Translation");
      original = pickBodyForRole(dir, files, "original", "Original");
      reference = pickBodyForRole(dir, files, "reference", "Reference");
      extract = pickBodyForRole(dir, files, "extract", "Machine extract");

      // Tier C / C+ snippets package: pair the per-hit transcription file
      // with the snippets/manifest.json so the page can render each hit
      // alongside its rendered page image(s).
      const snippetManifest = readSnippetsManifest(dir, primarySlug);
      const snippetBody = pickBodyForRole(dir, files, "snippets", "Excerpts");
      if (snippetManifest || snippetBody) {
        snippets = {
          body: snippetBody,
          hits: snippetManifest?.hits ?? [],
          variant: snippetManifest?.variant ?? "C",
          focus: snippetManifest?.focus ?? null,
          pageCount: snippetManifest?.pageCount ?? 0,
        };
      }

      // Provenance + PDF download
      const yamlData = readYaml(path.join(dir, "source.yaml"));
      provenance = extractProvenance(yamlData);

      if (files.includes("original.pdf")) {
        pdfDownloadUrl = filesUrl(`sources/corpus/${primarySlug}/original.pdf`);
      } else if (yamlData) {
        const filesField = yamlData.files as Record<string, unknown> | undefined;
        const mediaRef =
          (yamlData["files.media_reference"] as unknown) ?? filesField?.media_reference;
        if (typeof mediaRef === "string" && PDF_EXT.test(mediaRef)) {
          pdfDownloadUrl = filesUrl(mediaRef);
        }
      }

      // Facsimile images
      const seen = new Set<string>();
      const push = (repoRelPath: string, alt: string, primary: boolean) => {
        if (seen.has(repoRelPath)) return;
        seen.add(repoRelPath);
        facsimiles.push({ src: filesUrl(repoRelPath), alt, primary });
      };

      // 1. Object-shape `files:` — { media_reference, media_reference_crop, media_references }
      const yamlFilesObj =
        yamlData?.files && !Array.isArray(yamlData.files)
          ? (yamlData.files as Record<string, unknown>)
          : {};
      const primaryRefs = toStringArray(yamlFilesObj.media_reference).filter(isImagePath);
      const cropRefs = toStringArray(yamlFilesObj.media_reference_crop).filter(isImagePath);
      const extraRefs = toStringArray(yamlFilesObj.media_references).filter(isImagePath);

      // Order: crops first (more legible), then full pages, then extra refs.
      for (const p of cropRefs) push(p, captionFromMediaPath(p, "detail"), false);
      for (const p of primaryRefs) push(p, captionFromMediaPath(p, "facsimile"), true);
      for (const p of extraRefs) push(p, captionFromMediaPath(p, "facsimile"), true);

      // 2. Array-shape `files: [{path, description}]` — bundle-relative image entries.
      if (Array.isArray(yamlData?.files)) {
        for (const entry of yamlData.files as unknown[]) {
          if (!entry || typeof entry !== "object") continue;
          const e = entry as Record<string, unknown>;
          const p = typeof e.path === "string" ? e.path : null;
          if (!p || !isImagePath(p)) continue;
          const repoRel = p.startsWith("media/")
            ? p
            : `sources/corpus/${primarySlug}/${p}`;
          const desc = typeof e.description === "string" ? e.description : null;
          push(repoRel, desc ?? captionFromMediaPath(p, "facsimile"), true);
        }
      }

      // 3. pages/, pages-jpeg/, pages-png/ inside the bundle.
      //    When Tier C/C+ snippets exist, the pages-png/ images are already
      //    shown inline next to each hit — skip them here to avoid duplication.
      const snippetImageSet = new Set<string>(
        snippets?.hits.flatMap((h) => h.imageUrls) ?? [],
      );
      for (const pagesSub of ["pages", "pages-jpeg", "pages-png"]) {
        if (!subdirs.includes(pagesSub)) continue;
        const pagesDir = path.join(dir, pagesSub);
        try {
          const pageFiles = fs
            .readdirSync(pagesDir)
            .filter((n) => isImagePath(n))
            .sort();
          for (const pn of pageFiles) {
            const rel = `sources/corpus/${primarySlug}/${pagesSub}/${pn}`;
            const url = filesUrl(rel);
            if (pagesSub === "pages-png" && snippetImageSet.has(url)) continue;
            const num = pn.replace(/\.[^.]+$/, "").replace(/^page-?/i, "");
            push(rel, `Page ${num}`.trim(), true);
          }
        } catch {
          /* pages dir unreadable */
        }
      }

      // Title fallbacks for corpus-only bundles
      if (!cardTitle) {
        if (reference) {
          corpusTitle = extractFirstHeading(reference.content);
          if (!corpusBlurb) corpusBlurb = extractBlurb(reference.content);
        }
        if (!corpusTitle && translation) {
          corpusTitle = extractFirstHeading(translation.content);
          if (!corpusBlurb) corpusBlurb = extractBlurb(translation.content);
        }
        if (!corpusTitle && original) {
          corpusTitle = extractFirstHeading(original.content);
          if (!corpusBlurb) corpusBlurb = extractBlurb(original.content);
        }
        if (!corpusTitle && yamlData && typeof yamlData.title === "string") {
          corpusTitle = yamlData.title;
        }
      }
    }
  }

  const title = cardTitle ?? corpusTitle ?? titleFromSlug(slug);
  const blurb = cardBlurb || corpusBlurb;

  return {
    slug,
    title,
    blurb,
    cardContent,
    cardFilePath,
    cardFrontmatter,
    facsimiles,
    translation,
    original,
    reference,
    extract,
    snippets,
    pdfDownloadUrl,
    corpusSlugs: Array.from(allCorpusSlugs),
    primaryCorpusSlug,
    provenance,
  };
}

/** Generate a useful caption from a media path for img alt text. */
function captionFromMediaPath(repoRelPath: string, fallback: string): string {
  const base = repoRelPath.split("/").pop() ?? fallback;
  const noExt = base.replace(/\.[^.]+$/, "");
  return noExt;
}
