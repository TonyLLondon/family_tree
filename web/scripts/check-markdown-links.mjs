#!/usr/bin/env node
/**
 * Pre-build: validate internal links in each corpus bundle reference.md
 * (sources/corpus/<slug>/reference.md), same rules as web/lib/vaultLinks.ts.
 * Require repo targets to exist; forbid path-like link text ending in .md.
 *
 * Run: node web/scripts/check-markdown-links.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");

function decodeVaultRelativePath(rel) {
  let s = rel;
  for (let i = 0; i < 4; i++) {
    try {
      const next = decodeURIComponent(s);
      if (next === s) break;
      s = next;
    } catch {
      break;
    }
  }
  return s;
}

/** Mirrors web/lib/vaultLinks.ts — resolveVaultHref */
function resolveVaultHref(currentFileRelPosix, raw) {
  const [pathPartRaw, hash] = raw.split("#");
  const pathPart = pathPartRaw ?? "";
  const hashSuffix = hash ? `#${hash}` : "";
  const dir = path.posix.dirname(currentFileRelPosix);
  let joined = path.posix.normalize(
    path.posix.join(dir, decodeVaultRelativePath(pathPart)),
  );
  if (joined.startsWith("..")) return undefined;

  if (joined.startsWith("sources/media/")) {
    joined = joined.slice("sources/".length);
  }

  if (joined.startsWith("sources/corpus/media/")) {
    joined = joined.slice("sources/corpus/".length);
  }

  joined = joined.replace(/\/$/, "");

  const corpusMis = joined.match(
    /^sources\/corpus\/(people|stories|topics|sources)\/(.+)$/,
  );
  if (corpusMis) {
    const bucket = corpusMis[1];
    const rest = corpusMis[2];
    if (bucket === "people") joined = `people/${rest}`;
    else if (bucket === "stories") joined = `stories/${rest}`;
    else if (bucket === "topics") joined = `topics/${rest}`;
    else joined = `sources/${rest}`;
  } else if (joined.startsWith("sources/people/")) {
    joined = joined.slice("sources/".length);
  } else if (joined.startsWith("sources/stories/")) {
    joined = joined.slice("sources/".length);
  } else if (joined.startsWith("sources/topics/")) {
    joined = joined.slice("sources/".length);
  }

  if (joined === "index.md") return `/${hashSuffix}`;

  const mdRoute = (prefix, basePath, indexSlug) => {
    if (!joined.startsWith(prefix) || !joined.endsWith(".md")) return undefined;
    const inner = joined.slice(prefix.length, -".md".length);
    if (indexSlug && inner === indexSlug) return `${basePath}${hashSuffix}`;
    return `${basePath}/${inner}${hashSuffix}`;
  };

  let u = mdRoute("people/", "/people");
  if (u) return u;
  u = mdRoute("stories/", "/stories");
  if (u) return u;

  if (joined.startsWith("topics/") && joined.endsWith(".md")) {
    const inner = joined.slice("topics/".length, -".md".length);
    if (inner === "index") return `/topics${hashSuffix}`;
    return `/topics/${inner}${hashSuffix}`;
  }

  if (joined.startsWith("manual/") && joined.endsWith(".md")) {
    return `/vault/manual/${joined.slice("manual/".length, -".md".length)}${hashSuffix}`;
  }

  if (joined.startsWith("research/") && joined.endsWith(".md")) {
    return `/vault/research/${joined.slice("research/".length, -".md".length)}${hashSuffix}`;
  }

  if (joined.startsWith("sources/corpus/")) {
    const rest = joined.slice("sources/corpus/".length);
    const slug = rest.split("/")[0];
    if (slug) return `/sources/${encodeURIComponent(slug)}${hashSuffix}`;
  }

  if (
    joined.startsWith("sources/") &&
    joined.endsWith(".md") &&
    !joined.startsWith("sources/corpus/")
  ) {
    const inner = joined.slice("sources/".length, -".md".length);
    const segments = inner.split("/").map((s) => encodeURIComponent(s));
    return `/sources/${segments.join("/")}${hashSuffix}`;
  }

  if (
    joined.startsWith("archive/") ||
    joined.startsWith("media/") ||
    joined.startsWith("scripts/") ||
    /\.(ged|json|pdf|png|jpe?g|jfif|tif|tiff|webp|gif|xml|html|txt)$/i.test(
      joined,
    )
  ) {
    return `/files/${joined.split("/").map(encodeURIComponent).join("/")}${hashSuffix}`;
  }

  return undefined;
}

function posixRepoPath(absPath) {
  return path.relative(repoRoot, absPath).split(path.sep).join("/");
}

function collectCorpusReferenceFiles() {
  const out = [];
  const corpusRoot = path.join(repoRoot, "sources", "corpus");
  if (!fs.existsSync(corpusRoot)) return out;
  for (const ent of fs.readdirSync(corpusRoot, { withFileTypes: true })) {
    if (!ent.isDirectory() || ent.name.startsWith(".")) continue;
    const ref = path.join(corpusRoot, ent.name, "reference.md");
    if (fs.existsSync(ref)) out.push(posixRepoPath(ref));
  }
  return out;
}

const LINK_RE = /(?<!!)\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

/** Link display must not be a repo path ending in .md (reader-facing hygiene). */
function badLinkText(text) {
  const t = text.trim();
  return /^(people|sources)\/[^\s]+\.md$/i.test(t);
}

function filesUrlPathExists(urlPath) {
  const [p] = urlPath.split("#");
  if (!p.startsWith("/files/")) return false;
  const rel = p
    .slice("/files/".length)
    .split("/")
    .map((seg) => decodeURIComponent(seg))
    .join("/");
  if (rel.includes("..")) return false;
  return fs.existsSync(path.join(repoRoot, ...rel.split("/")));
}

function routeTargetExists(urlPath) {
  const [p] = urlPath.split("#");
  if (p.startsWith("/people/")) {
    const slug = decodeURIComponent(p.slice("/people/".length));
    if (!slug || slug.includes("/")) return false;
    return fs.existsSync(path.join(repoRoot, "people", `${slug}.md`));
  }
  if (p.startsWith("/stories/")) {
    const slug = decodeURIComponent(p.slice("/stories/".length));
    if (!slug || slug.includes("/")) return false;
    return fs.existsSync(path.join(repoRoot, "stories", `${slug}.md`));
  }
  if (p.startsWith("/topics/")) {
    const slug = decodeURIComponent(p.slice("/topics/".length));
    if (!slug || slug.includes("/")) return false;
    return fs.existsSync(path.join(repoRoot, "topics", `${slug}.md`));
  }
  if (p.startsWith("/sources/")) {
    const rest = p.slice("/sources/".length);
    const segments = rest.split("/").filter(Boolean).map((s) => decodeURIComponent(s));
    if (segments.length === 0) return false;
    if (segments.length === 1) {
      const a = segments[0];
      const corpusDir = path.join(repoRoot, "sources", "corpus", a);
      const card = path.join(repoRoot, "sources", `${a}.md`);
      return fs.existsSync(corpusDir) || fs.existsSync(card);
    }
    const relMd = path.join(repoRoot, "sources", ...segments) + ".md";
    return fs.existsSync(relMd);
  }
  if (p.startsWith("/files/")) {
    return filesUrlPathExists(urlPath);
  }
  if (p.startsWith("/vault/")) return true;
  return p === "/" || p === "";
}

function main() {
  const errors = [];
  const files = collectCorpusReferenceFiles();

  for (const fileRel of files) {
    const abs = path.join(repoRoot, ...fileRel.split("/"));
    const body = fs.readFileSync(abs, "utf8");
    let m;
    LINK_RE.lastIndex = 0;
    while ((m = LINK_RE.exec(body)) !== null) {
      const linkText = m[1];
      const href = m[2];
      if (!href || href.startsWith("#")) continue;
      if (/^https?:\/\//i.test(href) || href.startsWith("mailto:")) continue;

      if (badLinkText(linkText)) {
        errors.push(
          `${fileRel}: link text must not look like a repo path ending in .md: "${linkText}"`,
        );
      }

      if (href.startsWith("/")) {
        if (!routeTargetExists(href)) {
          errors.push(`${fileRel}: broken absolute link ${href}`);
        }
        continue;
      }

      const resolved = resolveVaultHref(fileRel.replace(/\\/g, "/"), href);
      if (!resolved) {
        errors.push(
          `${fileRel}: unresolved vault link (breaks on site): (${href}) near "${linkText.slice(0, 48)}…"`,
        );
        continue;
      }
      if (
        resolved.startsWith("/people/") ||
        resolved.startsWith("/sources/") ||
        resolved.startsWith("/stories/") ||
        resolved.startsWith("/topics/") ||
        resolved.startsWith("/files/")
      ) {
        if (!routeTargetExists(resolved)) {
          errors.push(`${fileRel}: broken target ${href} → ${resolved}`);
        }
      }
    }
  }

  if (errors.length) {
    console.error(`check-markdown-links: ${errors.length} issue(s)\n`);
    for (const e of errors) console.error(e);
    process.exit(1);
  }
  console.log(
    `check-markdown-links: OK (${files.length} corpus reference.md files)`,
  );
}

main();
