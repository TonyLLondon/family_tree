/**
 * Copies binary/media directories from the vault (repo root) into
 * web/public/files/ so Next.js serves them as static CDN assets on Vercel.
 *
 * Run automatically before `next build` via the package.json build script.
 * During local dev the /files/[...path] API route reads from the filesystem
 * directly, so this step is only required for production builds.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(webRoot, "..");
const dest = path.join(webRoot, "public", "files");

const DIRS_TO_COPY = [
  "media",
  "sources/corpus",
];

/** Repo-root files mirrored to public/files/ (same paths as /files/... on the site). */
const ROOT_FILES_TO_COPY = ["family-tree.json"];

function rmrf(p) {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
}

function copyDir(src, dst) {
  if (!fs.existsSync(src)) {
    console.log(`  skip (not found): ${src}`);
    return;
  }
  fs.mkdirSync(dst, { recursive: true });
  fs.cpSync(src, dst, { recursive: true });
}

console.log("copy-static-files: cleaning public/files/ …");
rmrf(dest);

for (const rel of DIRS_TO_COPY) {
  const src = path.join(repoRoot, rel);
  const dst = path.join(dest, rel);
  console.log(`  ${rel}/ → public/files/${rel}/`);
  copyDir(src, dst);
}

for (const rel of ROOT_FILES_TO_COPY) {
  const src = path.join(repoRoot, rel);
  const dst = path.join(dest, rel);
  if (!fs.existsSync(src)) {
    console.log(`  skip (not found): ${rel}`);
    continue;
  }
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
  console.log(`  ${rel} → public/files/${rel}`);
}

console.log("copy-static-files: done");
