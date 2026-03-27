import fs from "fs";
import path from "path";
import { repoPath, WEB_ROOT } from "./paths";

/**
 * Each entry in photo-map.json is either:
 *   - null                              → no photo
 *   - "media/path/to/image.jpg"         → default center focal point [0.5, 0.5]
 *   - { src: "media/...", focal: [x,y], zoom?: n } → custom focal point (0–1 normalised)
 *     zoom > 1 crops tighter around the focal point (useful for faces in group photos).
 */
type RawPhotoEntry = string | { src: string; focal?: [number, number]; zoom?: number } | null;
type RawPhotoMap = Record<string, RawPhotoEntry>;

export type PhotoInfo = { url: string; focal: [number, number]; zoom: number };

let cached: RawPhotoMap | null = null;
let cachedMtimeMs: number | null = null;

function loadRawPhotoMap(): RawPhotoMap {
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
  cached = JSON.parse(fs.readFileSync(mapPath, "utf8")) as RawPhotoMap;
  cachedMtimeMs = mtimeMs;
  return cached;
}

/** @deprecated – still used by person-page sidebar; returns bare path strings. */
export type PhotoMap = Record<string, string | null>;
export function loadPhotoMap(): PhotoMap {
  const raw = loadRawPhotoMap();
  const out: PhotoMap = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v == null) out[k] = null;
    else if (typeof v === "string") out[k] = v;
    else out[k] = v.src;
  }
  return out;
}

function parseEntry(v: RawPhotoEntry): { src: string; focal: [number, number]; zoom: number } | null {
  if (v == null) return null;
  if (typeof v === "string") return { src: v, focal: [0.5, 0.5], zoom: 1 };
  return { src: v.src, focal: v.focal ?? [0.5, 0.5], zoom: v.zoom ?? 1 };
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
  if (typeof repoRelative !== "string") return null;
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

export function photoInfoForPerson(personId: string): PhotoInfo | null {
  const raw = loadRawPhotoMap();
  const parsed = parseEntry(raw[personId]);
  if (!parsed) return null;
  const url = photoRepoFilePublicUrl(parsed.src);
  if (!url) return null;
  return { url, focal: parsed.focal, zoom: parsed.zoom };
}

export function focalToObjectPosition(focal: [number, number]): string {
  return `${Math.round(focal[0] * 100)}% ${Math.round(focal[1] * 100)}%`;
}

/** Build a map of person-id → { url, focal } for the chart, resolving both string and object entries. */
export function buildPhotoInfoMap(personIds: string[]): Record<string, PhotoInfo | null> {
  const raw = loadRawPhotoMap();
  const out: Record<string, PhotoInfo | null> = {};
  for (const id of personIds) {
    const parsed = parseEntry(raw[id]);
    if (!parsed) {
      out[id] = null;
      continue;
    }
    const url = photoRepoFilePublicUrl(parsed.src);
    if (!url) {
      out[id] = null;
      continue;
    }
    out[id] = { url, focal: parsed.focal, zoom: parsed.zoom };
  }
  return out;
}
