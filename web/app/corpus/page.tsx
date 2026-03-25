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
      href: `/corpus/${encodeURIComponent(slug)}`,
      meta: "Corpus bundle",
    };
  });

  return (
    <PageShell
      title="Corpus"
      subtitle="Offline evidence bundles — PDF extracts, transcriptions, and provenance under sources/corpus/."
    >
      <BrowseGrid items={items} searchPlaceholder="Search corpus bundles…" />
    </PageShell>
  );
}
