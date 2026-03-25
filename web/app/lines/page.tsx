import { BrowseGrid, type BrowseItem } from "@/components/BrowseGrid";
import { PageShell } from "@/components/PageShell";
import { getLineSlugs } from "@/lib/content";
import { readStoryOrLineCard } from "@/lib/browse";

export default function LinesIndexPage() {
  const slugs = getLineSlugs().sort((a, b) => a.localeCompare(b));

  const items: BrowseItem[] = slugs.map((slug) => {
    const { title, blurb } = readStoryOrLineCard("lines", slug);
    return {
      id: slug,
      title,
      subtitle: blurb || undefined,
      href: `/lines/${encodeURIComponent(slug)}`,
    };
  });

  return (
    <PageShell title="Lines" subtitle="Regional and thematic hubs — Persia, Dalmatia, Wales & Europe, and more.">
      <BrowseGrid items={items} searchPlaceholder="Search line hubs…" />
    </PageShell>
  );
}
