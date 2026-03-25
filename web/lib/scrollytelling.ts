import fs from "fs";
import { repoPath } from "./paths";
import { photoPublicPath } from "./photos";

// ── Types ────────────────────────────────────────────────────────────────────

export interface ScrollyMedia {
  src: string;
  alt: string;
  caption?: string;
  focal?: [number, number];
}

export interface ScrollyStep {
  media: ScrollyMedia;
  era?: string;
}

export interface ScrollySidecar {
  hero: {
    title: string;
    subtitle: string;
    era: string;
  };
  scrollyStepCount: number;
  steps: ScrollyStep[];
}

export interface MarkdownSection {
  heading: string;
  slug: string;
  body: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ── Markdown section splitter ────────────────────────────────────────────────

export function splitMarkdownSections(content: string): {
  title: string;
  intro: string;
  sections: MarkdownSection[];
} {
  const lines = content.split("\n");

  let title = "";
  let startIdx = 0;
  if (lines[0]?.startsWith("# ")) {
    title = lines[0].replace(/^# /, "").trim();
    startIdx = 1;
  }

  const rest = lines.slice(startIdx).join("\n");
  const parts = rest.split(/^(## .+)$/m);

  const intro = parts[0].replace(/^\s*---\s*$/gm, "").trim();
  const sections: MarkdownSection[] = [];

  for (let i = 1; i < parts.length; i += 2) {
    const heading = parts[i].replace(/^## /, "").trim();
    const body = (parts[i + 1] || "").replace(/^\s*---\s*$/gm, "").trim();
    sections.push({ heading, slug: slugify(heading), body });
  }

  return { title, intro, sections };
}

// ── Sidecar reader ───────────────────────────────────────────────────────────

export function readScrollySidecar(slug: string): ScrollySidecar | null {
  const p = repoPath("narratives", `${slug}.scrolly.json`);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf8")) as ScrollySidecar;
}

/**
 * Resolve repo-relative media paths in sidecar steps to public `/files/…` URLs.
 */
export function resolveScrollySteps(sidecar: ScrollySidecar): ScrollyStep[] {
  return sidecar.steps.map((step) => ({
    ...step,
    media: {
      ...step.media,
      src: photoPublicPath(step.media.src),
    },
  }));
}
