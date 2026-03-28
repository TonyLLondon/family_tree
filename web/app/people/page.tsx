import { BrowseGrid, type BrowseItem } from "@/components/BrowseGrid";
import { PageShell } from "@/components/PageShell";
import { getPeopleSlugs } from "@/lib/content";
import { titleFromSlug } from "@/lib/browse";
import { getPersonBySlug, loadFamilyTree } from "@/lib/tree";
import { photoInfoForPerson } from "@/lib/photos";

export default function PeopleIndexPage() {
  const slugs = getPeopleSlugs().sort((a, b) => a.localeCompare(b));
  const tree = loadFamilyTree();

  const items: BrowseItem[] = slugs.map((slug) => {
    const p = getPersonBySlug(tree, slug);
    const title = p?.displayName ?? titleFromSlug(slug);
    const parts: string[] = [];
    if (p?.birthDate) parts.push(`b. ${p.birthDate}`);
    if (p?.deathDate) parts.push(`d. ${p.deathDate}`);
    if (p?.birthPlace && !p?.deathDate) parts.push(p.birthPlace);
    const subtitle = parts.length ? parts.join(" · ") : undefined;
    const photo = p?.id ? photoInfoForPerson(p.id) : null;
    return {
      id: slug,
      title,
      subtitle,
      href: `/people/${encodeURIComponent(slug)}`,
      meta: p?.id ? `Tree ${p.id}` : undefined,
      heroImage: photo?.url ?? undefined,
      heroFocal: photo?.focal,
    };
  });

  return (
    <PageShell
      title="People"
      subtitle="Biographical articles linked to the structured tree — search by name, place, or tree id."
    >
      <BrowseGrid items={items} searchPlaceholder="Search people…" />
    </PageShell>
  );
}
