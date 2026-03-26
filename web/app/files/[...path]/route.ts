import fs from "fs";
import path from "path";
import { REPO_ROOT } from "@/lib/paths";
import { decodeUriPathSegment } from "@/lib/vaultLinks";

const MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".jfif": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".tif": "image/tiff",
  ".tiff": "image/tiff",
  ".ged": "text/plain",
  ".txt": "text/plain",
  ".html": "text/html",
  ".xml": "application/xml",
  ".md": "text/markdown; charset=utf-8",
  ".yaml": "text/yaml; charset=utf-8",
  ".yml": "text/yaml; charset=utf-8",
};

export async function GET(
  _req: Request,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await context.params;
  if (!segments?.length) {
    return new Response("Not found", { status: 404 });
  }

  const decoded = segments.map((s) => decodeUriPathSegment(s));
  const rel = decoded.join(path.sep);
  const abs = path.resolve(path.join(REPO_ROOT, rel));
  const rootResolved = path.resolve(REPO_ROOT);

  if (!abs.startsWith(rootResolved + path.sep) && abs !== rootResolved) {
    return new Response("Forbidden", { status: 403 });
  }

  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
    return new Response("Not found", { status: 404 });
  }

  const buf = fs.readFileSync(abs);
  const ext = path.extname(abs).toLowerCase();
  const contentType = MIME[ext] ?? "application/octet-stream";

  return new Response(buf, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
