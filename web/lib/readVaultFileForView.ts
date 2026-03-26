import fs from "fs";
import path from "path";
import { REPO_ROOT } from "./paths";

/**
 * Enumerate every text file (.md, .yaml, .yml) under `sources/corpus/` and `media/`
 * as POSIX-relative paths from the repo root. Used by `/view/` `generateStaticParams`
 * to pre-render at build time.
 */
export function enumerateViewableFiles(): string[] {
  const exts = new Set([".md", ".yaml", ".yml"]);
  const roots = ["sources/corpus", "media"];
  const results: string[] = [];

  function walk(dir: string) {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        walk(full);
      } else if (e.isFile() && exts.has(path.extname(e.name).toLowerCase())) {
        const rel = path.relative(REPO_ROOT, full).split(path.sep).join("/");
        results.push(rel);
      }
    }
  }

  for (const root of roots) {
    walk(path.join(REPO_ROOT, root));
  }
  return results;
}

/**
 * Read a repo-relative text file. Build-time only — the full repo is on disk
 * during `next build` and `next dev`.
 */
export function readVaultFileUtf8(relPosix: string): string | null {
  const normalized = relPosix.replace(/\\/g, "/").replace(/^\/+/, "");
  const segments = normalized.split("/").filter(Boolean);
  if (segments.some((s) => s === "..")) return null;

  const abs = path.resolve(path.join(REPO_ROOT, ...segments));
  const rootResolved = path.resolve(REPO_ROOT);
  if (abs !== rootResolved && !abs.startsWith(rootResolved + path.sep)) return null;
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) return null;
  return fs.readFileSync(abs, "utf8");
}
