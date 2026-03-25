import path from "path";
import { fileURLToPath } from "url";

const _here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Absolute path to the Next.js app directory (`…/family_tree/web`).
 * Does not use `process.cwd()` — that can be the repo root or another cwd when the dev server starts.
 */
export const WEB_ROOT = path.resolve(_here, "..");

/** Vault / repository root (parent of `web/`). */
export const REPO_ROOT = path.resolve(WEB_ROOT, "..");

export function repoPath(...segments: string[]): string {
  return path.join(REPO_ROOT, ...segments);
}
