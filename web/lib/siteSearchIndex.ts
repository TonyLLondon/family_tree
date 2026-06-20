import type { BrowseItem } from "@/components/BrowseGrid";
import {
  getManualSegmentLists,
  getStorySlugs,
  getPeopleSlugs,
  getResearchSegmentLists,
  getSourceSegmentLists,
  getTopicSlugs,
} from "@/lib/content";
import {
  readStoryCard,
  readResearchOrManualCard,
  readSourceCardTitle,
  readTopicCard,
  readVaultIndexCard,
  titleFromSlug,
} from "@/lib/browse";
import { getPersonBySlug, loadFamilyTree } from "@/lib/tree";
import { getAllSourcePageSlugs, resolveSource } from "@/lib/sourceResolver";

const CATEGORY_ORDER = [
  "Home",
  "Chart",
  "Person",
  "Story",
  "Topic",
  "Source",
  "Research",
  "Manual",
] as const;

function categoryRank(meta?: string): number {
  const i = CATEGORY_ORDER.indexOf((meta ?? "") as (typeof CATEGORY_ORDER)[number]);
  return i === -1 ? 100 : i;
}

/** All browsable vault routes in one list for the home-page master search. */
export function getSiteSearchItems(): BrowseItem[] {
  const tree = loadFamilyTree();
  const items: BrowseItem[] = [];

  const { title: homeTitle, blurb: homeBlurb } = readVaultIndexCard();
  items.push({
    id: "home:index",
    title: homeTitle,
    subtitle: homeBlurb || undefined,
    href: "/",
    meta: "Home",
  });

  for (const slug of getPeopleSlugs()) {
    const p = getPersonBySlug(tree, slug);
    const title = p?.displayName ?? titleFromSlug(slug);
    const parts: string[] = [];
    if (p?.birthDate) parts.push(`b. ${p.birthDate}`);
    if (p?.deathDate) parts.push(`d. ${p.deathDate}`);
    if (p?.birthPlace && !p?.deathDate) parts.push(p.birthPlace);
    if (p?.id) parts.push(`Tree ${p.id}`);
    const subtitle = parts.length ? parts.join(" · ") : undefined;
    items.push({
      id: `person:${slug}`,
      title,
      subtitle,
      href: `/people/${encodeURIComponent(slug)}`,
      meta: "Person",
    });
  }

  for (const slug of getStorySlugs()) {
    const { title, blurb } = readStoryCard(slug);
    items.push({
      id: `story:${slug}`,
      title,
      subtitle: blurb || undefined,
      href: `/stories/${encodeURIComponent(slug)}`,
      meta: "Story",
    });
  }

  for (const slug of getTopicSlugs()) {
    if (slug === "index") continue;
    const { title, blurb } = readTopicCard(slug);
    items.push({
      id: `topic:${slug}`,
      title,
      subtitle: blurb || undefined,
      href: `/topics/${encodeURIComponent(slug)}`,
      meta: "Topic",
    });
  }

  const seenSourceHrefs = new Set<string>();

  for (const slug of getAllSourcePageSlugs()) {
    const source = resolveSource(slug);
    if (!source) continue;
    const href = `/sources/${encodeURIComponent(slug)}`;
    if (seenSourceHrefs.has(href)) continue;
    seenSourceHrefs.add(href);
    const parts: string[] = [];
    if (source.blurb) parts.push(source.blurb);
    items.push({
      id: `source:${href}`,
      title: source.title,
      subtitle: parts.length ? parts.join(" · ") : undefined,
      href,
      meta: "Source",
    });
  }

  for (const segs of getSourceSegmentLists()) {
    if (segs.length < 2) continue;
    const { title, blurb } = readSourceCardTitle(segs);
    const href = `/sources/${segs.map(encodeURIComponent).join("/")}`;
    if (seenSourceHrefs.has(href)) continue;
    seenSourceHrefs.add(href);
    const pathHint = segs.join("/");
    items.push({
      id: `source:${href}`,
      title,
      subtitle: blurb ? `${blurb} · ${pathHint}` : pathHint,
      href,
      meta: "Source",
    });
  }

  for (const segs of getResearchSegmentLists()) {
    const { title, blurb } = readResearchOrManualCard("research", segs);
    const href = `/vault/research/${segs.map(encodeURIComponent).join("/")}`;
    items.push({
      id: `research:${href}`,
      title,
      subtitle: blurb || undefined,
      href,
      meta: "Research",
    });
  }

  for (const segs of getManualSegmentLists()) {
    const { title, blurb } = readResearchOrManualCard("manual", segs);
    const href = `/vault/manual/${segs.map(encodeURIComponent).join("/")}`;
    items.push({
      id: `manual:${href}`,
      title,
      subtitle: blurb || undefined,
      href,
      meta: "Manual",
    });
  }

  items.push({
    id: "section:chart",
    title: "Family tree",
    subtitle: "Interactive ancestor fan chart",
    href: "/chart",
    meta: "Chart",
  });

  items.push({
    id: "section:pedigree",
    title: "Pedigree tree",
    subtitle: "Expandable parents, children, siblings; URL saves view",
    href: "/chart/pedigree",
    meta: "Chart",
  });

  return items.sort(
    (a, b) => categoryRank(a.meta) - categoryRank(b.meta) || a.title.localeCompare(b.title)
  );
}
