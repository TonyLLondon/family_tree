import fs from "fs";
import { repoPath } from "./paths";
import type { FamilyTree } from "./genealogy";

export type { Person, Union, FamilyTree, AncestorNode } from "./genealogy";
export {
  personSlugFromPage,
  getPersonBySlug,
  getParents,
  getSpouses,
  getChildren,
  buildAncestorTree,
  getGenerationCount,
  getCenturySpan,
} from "./genealogy";

let cached: FamilyTree | null = null;

export function loadFamilyTree(): FamilyTree {
  if (cached) return cached;
  const raw = fs.readFileSync(repoPath("family-tree.json"), "utf8");
  cached = JSON.parse(raw) as FamilyTree;
  return cached;
}
