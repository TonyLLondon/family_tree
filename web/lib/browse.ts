import fs from "fs";
import path from "path"; // path.join for corpus files
import { readMarkdownFile as readMd } from "./content";
import { repoPath } from "./paths";

/** First markdown H1 line in body (after frontmatter). */
export function extractFirstHeading(markdownBody: string): string | null {
  const lines = markdownBody.split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^#\s+(.+)$/);
    if (m) return m[1].trim();
  }
  return null;
}

/** Strip noise from machine extracts for card snippets. */
export function sanitizeCardSnippet(s: string): string {
  return s
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`[^`]+`/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** First paragraph of prose (skips headings, lists, empty lines). */
export function extractBlurb(markdownBody: string, maxLen = 220): string {
  const lines = markdownBody.split(/\r?\n/);
  const buf: string[] = [];
  let inFence = false;
  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const t = line.trim();
    if (!t || t.startsWith("#") || t.startsWith("|") || t.startsWith("- ") || t.startsWith("* ")) continue;
    if (/^[-*_]{3,}$/.test(t)) continue;
    if (/^<!--/.test(t) || /-->$/.test(t)) continue;
    buf.push(t);
    if (buf.join(" ").length >= maxLen) break;
  }
  let s = sanitizeCardSnippet(buf.join(" "));
  if (s.length > maxLen) s = s.slice(0, maxLen - 1).trimEnd() + "…";
  return s;
}

const SMALL = new Set(["a", "an", "the", "and", "or", "of", "in", "on", "at", "to", "for", "de", "la", "le", "von", "van", "da"]);

/** Human-readable title from a slug (kebab-case). */
export function titleFromSlug(slug: string): string {
  return slug
    .split(/[-_/]+/)
    .filter(Boolean)
    .map((w, i) => {
      const lower = w.toLowerCase();
      if (i > 0 && SMALL.has(lower)) return lower;
      if (/^i\d+$/i.test(w)) return w.toUpperCase();
      if (lower === "nypl") return "NYPL";
      if (lower === "uk") return "UK";
      if (lower === "wwii" || lower === "ww2") return "WWII";
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(" ");
}

export function readSourceCardTitle(segments: string[]): { title: string; blurb: string } {
  if (segments.length === 0) return { title: "Source", blurb: "" };
  const file = `${segments[segments.length - 1]}.md`;
  const dirs = segments.slice(0, -1);
  const abs = dirs.length ? repoPath("sources", ...dirs, file) : repoPath("sources", file);
  if (!fs.existsSync(abs)) {
    return { title: titleFromSlug(segments[segments.length - 1] ?? ""), blurb: segments.join(" · ") };
  }
  const parsed = readMd(abs);
  const h1 = extractFirstHeading(parsed.content);
  const title = h1 ?? titleFromSlug(segments[segments.length - 1] ?? "source");
  const blurb = extractBlurb(parsed.content);
  return { title, blurb };
}

export function readTopicCard(slug: string): { title: string; blurb: string } {
  const abs = repoPath("topics", `${slug}.md`);
  if (!fs.existsSync(abs)) return { title: titleFromSlug(slug), blurb: "" };
  const parsed = readMd(abs);
  const h1 = extractFirstHeading(parsed.content);
  return { title: h1 ?? titleFromSlug(slug), blurb: extractBlurb(parsed.content) };
}

export function readStoryOrLineCard(dir: "stories" | "lines", slug: string): { title: string; blurb: string } {
  const abs = repoPath(dir, `${slug}.md`);
  if (!fs.existsSync(abs)) return { title: titleFromSlug(slug), blurb: "" };
  const parsed = readMd(abs);
  const h1 = extractFirstHeading(parsed.content);
  return { title: h1 ?? titleFromSlug(slug), blurb: extractBlurb(parsed.content) };
}

export function readCorpusCard(slug: string): { title: string; blurb: string } {
  const base = repoPath("sources", "corpus", slug);
  if (!fs.existsSync(base)) return { title: titleFromSlug(slug), blurb: "" };
  const candidates = ["reference.md", "README.md", "extracted.web.md", "extracted.pdf.md"];
  for (const name of candidates) {
    const p = path.join(base, name);
    if (fs.existsSync(p)) {
      const parsed = readMd(p);
      const h1 = extractFirstHeading(parsed.content);
      const blurb = extractBlurb(parsed.content);
      if (h1 || blurb) return { title: h1 ?? titleFromSlug(slug), blurb };
    }
  }
  return { title: titleFromSlug(slug), blurb: "" };
}

export function readVaultIndexCard(): { title: string; blurb: string } {
  const abs = repoPath("index.md");
  if (!fs.existsSync(abs)) return { title: "Vault home", blurb: "" };
  const parsed = readMd(abs);
  const h1 = extractFirstHeading(parsed.content);
  return { title: h1 ?? "Vault home", blurb: extractBlurb(parsed.content) };
}

export function readResearchOrManualCard(
  kind: "research" | "manual",
  segments: string[]
): { title: string; blurb: string } {
  if (segments.length === 0) return { title: kind === "research" ? "Research" : "Manual", blurb: "" };
  const abs = path.join(repoPath(kind), ...segments) + ".md";
  if (!fs.existsSync(abs)) {
    return { title: titleFromSlug(segments[segments.length - 1] ?? ""), blurb: segments.join(" / ") };
  }
  const parsed = readMd(abs);
  const h1 = extractFirstHeading(parsed.content);
  return { title: h1 ?? titleFromSlug(segments[segments.length - 1] ?? ""), blurb: extractBlurb(parsed.content) };
}
