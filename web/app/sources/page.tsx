import { BrowseGrid, type BrowseItem } from "@/components/BrowseGrid";
import { PageShell } from "@/components/PageShell";
import { getSourceSegmentLists, getCorpusSlugs } from "@/lib/content";
import { readSourceCardTitle, readCorpusCard, titleFromSlug } from "@/lib/browse";

export default function SourcesIndexPage() {
  const all = getSourceSegmentLists().sort((a, b) => a.join("/").localeCompare(b.join("/")));

  const cardItems: BrowseItem[] = all.map((segs) => {
    const { title, blurb } = readSourceCardTitle(segs);
    const href = `/sources/${segs.map(encodeURIComponent).join("/")}`;
    return {
      id: href,
      title,
      subtitle: blurb || undefined,
      href,
      meta: segs.length > 1 ? segs.slice(0, -1).map((s) => titleFromSlug(s)).join(" · ") : "Citation card",
    };
  });

  const corpusSlugs = getCorpusSlugs().sort((a, b) => a.localeCompare(b));
  const corpusItems: BrowseItem[] = corpusSlugs.map((slug) => {
    const { title, blurb } = readCorpusCard(slug);
    return {
      id: `corpus:${slug}`,
      title,
      subtitle: blurb || undefined,
      href: `/corpus/${encodeURIComponent(slug)}`,
      meta: "Corpus bundle",
    };
  });

  const items = [...cardItems, ...corpusItems].sort((a, b) =>
    a.title.localeCompare(b.title)
  );

  return (
    <PageShell
      title="Sources"
      subtitle="Citation cards and corpus evidence bundles — search by title, path, or type."
    >
      <BrowseGrid items={items} searchPlaceholder="Search sources and corpus…" />
    </PageShell>
  );
}
