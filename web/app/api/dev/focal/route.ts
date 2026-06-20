import fs from "fs";
import { PHOTO_MAP_PATH, loadRawPhotoMap, type RawPhotoMap } from "@/lib/photos";

/**
 * Dev-only editor backend for chart face framing (`photo-map.json`).
 * Writes are refused in production so the deployed site stays read-only.
 */
function devOnlyGuard(): Response | null {
  if (process.env.NODE_ENV === "production") {
    return new Response("Focal editor is disabled in production", { status: 403 });
  }
  return null;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0.5;
  return Math.min(1, Math.max(0, n));
}

type SaveBody = {
  id?: string;
  src?: string;
  focal?: [number, number];
  zoom?: number;
};

function formatEntry(v: RawPhotoMap[string]): string {
  if (v == null) return "null";
  if (typeof v === "string") return JSON.stringify(v);
  const parts = [`"src": ${JSON.stringify(v.src)}`];
  if (v.focal) parts.push(`"focal": [${v.focal[0]}, ${v.focal[1]}]`);
  if (v.zoom != null && v.zoom !== 1) parts.push(`"zoom": ${v.zoom}`);
  return `{ ${parts.join(", ")} }`;
}

/** Keep the compact, one-line-per-entry aligned style of photo-map.json so saves produce minimal diffs. */
function serializePhotoMap(map: RawPhotoMap): string {
  const keys = Object.keys(map);
  const tokens = keys.map((k) => `${JSON.stringify(k)}:`);
  const col = Math.max(...tokens.map((t) => t.length)) + 2;
  const lines = keys.map((k, i) => {
    const pad = " ".repeat(Math.max(1, col - tokens[i].length));
    return `  ${tokens[i]}${pad}${formatEntry(map[k])}`;
  });
  return `{\n${lines.join(",\n")}\n}\n`;
}

export async function POST(req: Request) {
  const blocked = devOnlyGuard();
  if (blocked) return blocked;

  let body: SaveBody;
  try {
    body = (await req.json()) as SaveBody;
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const { id, src } = body;
  if (!id || !src) {
    return Response.json({ ok: false, error: "id and src are required" }, { status: 400 });
  }

  const fx = clamp01(Number(body.focal?.[0]));
  const fy = clamp01(Number(body.focal?.[1]));
  const zoomRaw = Number(body.zoom);
  const zoom = Number.isFinite(zoomRaw) ? Math.min(8, Math.max(1, zoomRaw)) : 1;

  const focal: [number, number] = [Number(fx.toFixed(2)), Number(fy.toFixed(2))];
  const entry: { src: string; focal: [number, number]; zoom?: number } = { src, focal };
  if (zoom !== 1) entry.zoom = Number(zoom.toFixed(2));

  const map: RawPhotoMap = loadRawPhotoMap();
  map[id] = entry;

  fs.writeFileSync(PHOTO_MAP_PATH, serializePhotoMap(map), "utf8");

  return Response.json({ ok: true, id, entry });
}
