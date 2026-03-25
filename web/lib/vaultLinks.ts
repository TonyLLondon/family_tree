import path from "path";
import { visit } from "unist-util-visit";
import type { Root } from "mdast";

/** Rewrite repo-relative markdown links to site routes and `/files/...` for binaries. */
export function remarkVaultLinks(currentFileRelPosix: string) {
  return function attacher() {
    return function transformer(tree: Root) {
      visit(tree, "link", (node: { url?: string }) => {
        const url = node.url;
        if (!url) return;
        if (/^https?:\/\//i.test(url) || url.startsWith("mailto:") || url.startsWith("/")) return;
        const next = resolveVaultHref(currentFileRelPosix, url);
        if (next) node.url = next;
      });
      visit(tree, "image", (node: { url?: string }) => {
        const url = node.url;
        if (!url) return;
        if (/^https?:\/\//i.test(url) || url.startsWith("/")) return;
        const next = resolveVaultHref(currentFileRelPosix, url) ?? resolveFileOnlyHref(currentFileRelPosix, url);
        if (next) node.url = next;
      });
    };
  };
}

function toFilesUrl(relPosix: string): string {
  return `/files/${relPosix.split("/").map(encodeURIComponent).join("/")}`;
}

function resolveFileOnlyHref(currentFileRelPosix: string, raw: string): string | undefined {
  const pathPart = raw.split("#")[0] ?? raw;
  const dir = path.posix.dirname(currentFileRelPosix);
  const joined = path.posix.normalize(path.posix.join(dir, pathPart));
  if (joined.startsWith("..")) return undefined;
  if (joined.startsWith("media/") || joined.startsWith("archive/")) {
    return toFilesUrl(joined);
  }
  return undefined;
}

export function resolveVaultHref(currentFileRelPosix: string, raw: string): string | undefined {
  const [pathPart, hash] = raw.split("#");
  const hashSuffix = hash ? `#${hash}` : "";
  const dir = path.posix.dirname(currentFileRelPosix);
  let joined = path.posix.normalize(path.posix.join(dir, pathPart));
  if (joined.startsWith("..")) return undefined;

  joined = joined.replace(/\/$/, "");

  if (joined === "family-tree.json") return `/chart${hashSuffix}`;
  if (joined === "index.md") return `/${hashSuffix}`;

  const mdRoute = (
    prefix: string,
    basePath: string,
    indexSlug?: string
  ): string | undefined => {
    if (!joined.startsWith(prefix) || !joined.endsWith(".md")) return undefined;
    const inner = joined.slice(prefix.length, -".md".length);
    if (indexSlug && inner === indexSlug) return `${basePath}${hashSuffix}`;
    return `${basePath}/${inner}${hashSuffix}`;
  };

  const people = mdRoute("people/", "/people");
  if (people) return people;

  const nar = mdRoute("stories/", "/stories");
  if (nar) return nar;

  const lines = mdRoute("lines/", "/lines");
  if (lines) return lines;

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
    if (slug) return `/corpus/${encodeURIComponent(slug)}${hashSuffix}`;
  }

  if (joined.startsWith("sources/") && joined.endsWith(".md") && !joined.startsWith("sources/corpus/")) {
    const inner = joined.slice("sources/".length, -".md".length);
    const segments = inner.split("/").map((s) => encodeURIComponent(s));
    return `/sources/${segments.join("/")}${hashSuffix}`;
  }

  if (
    joined.startsWith("archive/") ||
    joined.startsWith("media/") ||
    joined.startsWith("scripts/") ||
    /\.(ged|pdf|png|jpe?g|jfif|tif|tiff|webp|gif|xml|html|txt)$/i.test(joined)
  ) {
    return `${toFilesUrl(joined)}${hashSuffix}`;
  }

  return undefined;
}
