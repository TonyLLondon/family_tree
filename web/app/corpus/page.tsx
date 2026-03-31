import { BrowseGrid, type BrowseItem } from "@/components/BrowseGrid";
import { PageShell } from "@/components/PageShell";
import { getCorpusSlugs } from "@/lib/content";
import { readCorpusCard } from "@/lib/browse";

export default function CorpusIndexPage() {
  const slugs = getCorpusSlugs().sort((a, b) => a.localeCompare(b));

  const items: BrowseItem[] = slugs.map((slug) => {
    const { title, blurb } = readCorpusCard(slug);
    return {
      id: slug,
      title,
      subtitle: blurb || undefined,
      href: `/sources/${encodeURIComponent(slug)}`,
      meta: "Evidence bundle",
    };
  });

  return (
    <PageShell
      title="Evidence bundles"
      subtitle="Offline evidence — PDF extracts, transcriptions, and provenance backing the sources used in research."
    >
      <BrowseGrid items={items} searchPlaceholder="Search evidence bundles…" />
    </PageShell>
  );
}
