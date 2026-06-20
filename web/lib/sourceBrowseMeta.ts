import type { ResolvedSource } from "@/lib/sourceResolver";

/** Reader-facing label for Sources index tiles (no vault jargon). */
export function sourceBrowseMeta(source: ResolvedSource): string {
  const n = source.corpusSlugs.length;
  const hasCard = source.cardFilePath !== null;
  const hasBundle = source.primaryCorpusSlug !== null;

  if (hasCard && n > 1) return "Index — several records";
  if (hasCard && hasBundle) return "Record";
  if (hasBundle && !hasCard) return "Record";
  if (hasCard && !hasBundle) return "Note";
  return "Record";
}
