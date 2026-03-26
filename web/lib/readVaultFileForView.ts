import fs from "fs";
import path from "path";
import { REPO_ROOT, WEB_ROOT } from "./paths";

function normalizedSegments(relPosix: string): string[] | null {
  const normalized = relPosix.replace(/\\/g, "/").replace(/^\/+/, "");
  const segments = normalized.split("/").filter(Boolean);
  if (segments.some((s) => s === "..")) return null;
  return segments;
}

function tryReadUtf8UnderRoot(root: string, segments: string[]): string | null {
  const abs = path.resolve(path.join(root, ...segments));
  const rootResolved = path.resolve(root);
  if (abs !== rootResolved && !abs.startsWith(rootResolved + path.sep)) return null;
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) return null;
  return fs.readFileSync(abs, "utf8");
}

/**
 * Load repo-relative text for `/view/...`: full tree (dev), then prebuild `public/files`,
 * then same-origin `/files/...?raw` when the serverless bundle has no corpus/media bytes.
 */
export async function readVaultFileUtf8ForView(
  relPosix: string,
  selfOrigin: string | undefined
): Promise<string | null> {
  const segments = normalizedSegments(relPosix);
  if (!segments) return null;

  const fromRepo = tryReadUtf8UnderRoot(REPO_ROOT, segments);
  if (fromRepo !== null) return fromRepo;

  const publicFilesRoot = path.join(WEB_ROOT, "public", "files");
  const fromPublic = tryReadUtf8UnderRoot(publicFilesRoot, segments);
  if (fromPublic !== null) return fromPublic;

  if (!selfOrigin) return null;

  const origin = selfOrigin.replace(/\/$/, "");
  const url = `${origin}/files/${segments.map(encodeURIComponent).join("/")}?raw`;
  const res = await fetch(url, { next: { revalidate: 300 } });
  if (!res.ok) return null;
  return res.text();
}
