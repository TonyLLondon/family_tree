import { BrowseGrid, type BrowseItem } from "@/components/BrowseGrid";
import { PageShell } from "@/components/PageShell";
import { getAllSourceSlugs, resolveSource } from "@/lib/sourceResolver";

export default function SourcesIndexPage() {
  const slugs = getAllSourceSlugs();

  const items: BrowseItem[] = [];
  for (const slug of slugs) {
    const source = resolveSource(slug);
    if (!source) continue;

    const hasCard = source.cardFilePath !== null;
    const hasBundle = source.primaryCorpusSlug !== null;

    let meta = "Source";
    if (hasCard && hasBundle) meta = "Source + evidence";
    else if (hasBundle) meta = "Evidence bundle";
    else if (hasCard) meta = "Citation card";

    items.push({
      id: slug,
      title: source.title,
      subtitle: source.blurb || undefined,
      href: `/sources/${encodeURIComponent(slug)}`,
      meta,
    });
  }
  items.sort((a, b) => a.title.localeCompare(b.title));

  return (
    <PageShell
      title="Sources"
      subtitle="Primary evidence, citation cards, and corpus evidence bundles backing this family history."
    >
      <BrowseGrid items={items} searchPlaceholder="Search sources…" />
    </PageShell>
  );
}
