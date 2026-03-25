import { BrowseGrid, type BrowseItem } from "@/components/BrowseGrid";
import { PageShell } from "@/components/PageShell";
import { getSourceSegmentLists } from "@/lib/content";
import { readSourceCardTitle, titleFromSlug } from "@/lib/browse";

export default function SourcesIndexPage() {
  const all = getSourceSegmentLists().sort((a, b) => a.join("/").localeCompare(b.join("/")));

  const items: BrowseItem[] = all.map((segs) => {
    const { title, blurb } = readSourceCardTitle(segs);
    const href = `/sources/${segs.map(encodeURIComponent).join("/")}`;
    return {
      id: href,
      title,
      subtitle: blurb || undefined,
      href,
      meta: segs.length > 1 ? segs.slice(0, -1).map((s) => titleFromSlug(s)).join(" · ") : undefined,
    };
  });

  return (
    <PageShell
      title="Sources"
      subtitle="Citation cards with links into the corpus, media, and people — search and browse by title."
    >
      <BrowseGrid items={items} searchPlaceholder="Search sources by title or path…" />
    </PageShell>
  );
}
