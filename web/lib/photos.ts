import fs from "fs";
import path from "path";
import { repoPath, WEB_ROOT } from "./paths";

export type PhotoMap = Record<string, string | null>;

let cached: PhotoMap | null = null;
let cachedMtimeMs: number | null = null;

export function loadPhotoMap(): PhotoMap {
  const mapPath = path.join(WEB_ROOT, "photo-map.json");
  if (!fs.existsSync(mapPath)) {
    cached = {};
    cachedMtimeMs = null;
    return cached;
  }
  const mtimeMs = fs.statSync(mapPath).mtimeMs;
  if (cached != null && cachedMtimeMs === mtimeMs) {
    return cached;
  }
  cached = JSON.parse(fs.readFileSync(mapPath, "utf8")) as PhotoMap;
  cachedMtimeMs = mtimeMs;
  return cached;
}

/** Public URL path for a repo-relative media path (served via `/files/...`). */
export function photoPublicPath(repoRelative: string): string {
  const normalized = repoRelative.replace(/^\/+/, "");
  const segments = normalized.split("/").map(encodeURIComponent);
  return `/files/${segments.join("/")}`;
}

/**
 * Public URL for a repo-relative file with `?v=mtime` so browsers refetch after the file is replaced.
 */
export function photoRepoFilePublicUrl(repoRelative: string): string | null {
  const normalized = repoRelative.replace(/^\/+/, "");
  const abs = repoPath(normalized);
  let st: fs.Stats;
  try {
    st = fs.statSync(abs);
  } catch {
    return null;
  }
  if (!st.isFile()) return null;
  const v = Math.floor(st.mtimeMs);
  return `${photoPublicPath(normalized)}?v=${v}`;
}

export function photoUrlForPerson(personId: string): string | null {
  const rel = loadPhotoMap()[personId];
  if (rel == null || rel === "") return null;
  return photoRepoFilePublicUrl(rel);
}
