import { BrowseGrid, type BrowseItem } from "@/components/BrowseGrid";
import { PageShell } from "@/components/PageShell";
import { sourceBrowseMeta } from "@/lib/sourceBrowseMeta";
import {
  SOURCE_CATEGORY_LABEL,
  type SourceBrowseCategory,
  inferSourceBrowseCategory,
  sourceCategorySortIndex,
} from "@/lib/sourceBrowseFilters";
import { getAllSourcePageSlugs, resolveSource } from "@/lib/sourceResolver";

/**
 * Full catalog: every `/sources/[slug]` (root cards + all corpus folders). See
 * `getAllSourcePageSlugs` in sourceResolver — do not use getAllSourceSlugs here.
 */
export default function SourcesIndexPage() {
  const slugs = getAllSourcePageSlugs();

  const items: BrowseItem[] = [];
  for (const slug of slugs) {
    const source = resolveSource(slug);
    if (!source) continue;

    const cat = inferSourceBrowseCategory(slug, source);
    items.push({
      id: slug,
      title: source.title,
      subtitle: source.blurb || undefined,
      href: `/sources/${encodeURIComponent(slug)}`,
      meta: sourceBrowseMeta(source),
      filterKey: cat,
    });
  }
  items.sort((a, b) => {
    const ac = a.filterKey ? sourceCategorySortIndex(a.filterKey as SourceBrowseCategory) : 999;
    const bc = b.filterKey ? sourceCategorySortIndex(b.filterKey as SourceBrowseCategory) : 999;
    if (ac !== bc) return ac - bc;
    return a.title.localeCompare(b.title);
  });

  return (
    <PageShell
      title="Sources"
      subtitle="Original records, transcriptions, scans, and notes we cite across people, topics, and stories. Use filters to narrow by record type, or search by title and text."
    >
      <BrowseGrid
        items={items}
        searchPlaceholder="Search records and notes…"
        filterLabels={SOURCE_CATEGORY_LABEL}
        filterTitle="Record type"
      />
    </PageShell>
  );
}
