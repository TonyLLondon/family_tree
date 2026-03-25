import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { REPO_ROOT, repoPath } from "./paths";

export type ParsedMd = {
  slug: string;
  data: Record<string, unknown>;
  content: string;
  filePath: string;
};

function listMdFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.endsWith(".md"))
    .map((d) => path.join(dir, d.name));
}

/** Markdown in `people/` that is planning/meta, not a biographical page. */
const NON_BIOGRAPHICAL_PEOPLE_SLUGS = new Set([
  "ancestor-coverage-list",
  "person-pages-extension-plan",
]);

export function getPeopleSlugs(): string[] {
  const dir = repoPath("people");
  return listMdFiles(dir).map((f) => path.basename(f, ".md"));
}

/** Person files under `people/*.md` minus planning stubs (for site stats). */
export function countBiographicalPersonPages(): number {
  return getPeopleSlugs().filter((s) => !NON_BIOGRAPHICAL_PEOPLE_SLUGS.has(s)).length;
}

export function getStorySlugs(): string[] {
  const dir = repoPath("stories");
  return listMdFiles(dir).map((f) => path.basename(f, ".md"));
}

export function getLineSlugs(): string[] {
  const dir = repoPath("lines");
  return listMdFiles(dir).map((f) => path.basename(f, ".md"));
}

export function getTopicSlugs(): string[] {
  const dir = repoPath("topics");
  return listMdFiles(dir).map((f) => path.basename(f, ".md"));
}

export type SourceSegments = string[];

function walkSourcesMarkdown(dir: string, baseRel: string): SourceSegments[] {
  const out: SourceSegments[] = [];
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    const rel = path.join(baseRel, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "corpus") continue;
      out.push(...walkSourcesMarkdown(full, rel));
    } else if (ent.isFile() && ent.name.endsWith(".md")) {
      const relPosix = rel.split(path.sep).join("/");
      const parts = relPosix.replace(/\.md$/, "").split("/");
      out.push(parts);
    }
  }
  return out;
}

export function getSourceSegmentLists(): SourceSegments[] {
  return walkSourcesMarkdown(repoPath("sources"), "");
}

export function readMarkdownFile(absPath: string): ParsedMd {
  const raw = fs.readFileSync(absPath, "utf8");
  const { data, content } = matter(raw);
  return {
    slug: path.basename(absPath, ".md"),
    data,
    content,
    filePath: path.relative(REPO_ROOT, absPath),
  };
}

export function readVaultMarkdown(relFromRepo: string): ParsedMd | null {
  const abs = repoPath(relFromRepo);
  if (!fs.existsSync(abs)) return null;
  return readMarkdownFile(abs);
}

export function getCorpusSlugs(): string[] {
  const dir = repoPath("sources", "corpus");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((name) => !name.startsWith("."));
}

function walkMarkdownRecursive(dir: string, baseRel: string): SourceSegments[] {
  const out: SourceSegments[] = [];
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    const rel = path.join(baseRel, ent.name);
    if (ent.isDirectory()) {
      out.push(...walkMarkdownRecursive(full, rel));
    } else if (ent.isFile() && ent.name.endsWith(".md")) {
      const relPosix = rel.split(path.sep).join("/");
      const parts = relPosix.replace(/\.md$/, "").split("/");
      out.push(parts);
    }
  }
  return out;
}

/** All `research` markdown files as segment arrays (e.g. iran-qajar / memo). */
export function getResearchSegmentLists(): SourceSegments[] {
  return walkMarkdownRecursive(repoPath("research"), "");
}

/** All markdown files under manual/. */
export function getManualSegmentLists(): SourceSegments[] {
  return walkMarkdownRecursive(repoPath("manual"), "");
}
