import type { BrowseItem } from "@/components/BrowseGrid";
import {
  getCorpusSlugs,
  getLineSlugs,
  getManualSegmentLists,
  getNarrativeSlugs,
  getPeopleSlugs,
  getResearchSegmentLists,
  getSourceSegmentLists,
  getTopicSlugs,
} from "@/lib/content";
import {
  readCorpusCard,
  readNarrativeOrLineCard,
  readResearchOrManualCard,
  readSourceCardTitle,
  readTopicCard,
  readVaultIndexCard,
  titleFromSlug,
} from "@/lib/browse";
import { getPersonBySlug, loadFamilyTree } from "@/lib/tree";

const CATEGORY_ORDER = [
  "Home",
  "Chart",
  "Person",
  "Narrative",
  "Line",
  "Topic",
  "Source",
  "Corpus",
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

  for (const slug of getNarrativeSlugs()) {
    const { title, blurb } = readNarrativeOrLineCard("narratives", slug);
    items.push({
      id: `narrative:${slug}`,
      title,
      subtitle: blurb || undefined,
      href: `/narratives/${encodeURIComponent(slug)}`,
      meta: "Narrative",
    });
  }

  for (const slug of getLineSlugs()) {
    const { title, blurb } = readNarrativeOrLineCard("lines", slug);
    items.push({
      id: `line:${slug}`,
      title,
      subtitle: blurb || undefined,
      href: `/lines/${encodeURIComponent(slug)}`,
      meta: "Line",
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

  for (const segs of getSourceSegmentLists()) {
    const { title, blurb } = readSourceCardTitle(segs);
    const href = `/sources/${segs.map(encodeURIComponent).join("/")}`;
    const pathHint = segs.join("/");
    items.push({
      id: `source:${href}`,
      title,
      subtitle: blurb ? `${blurb} · ${pathHint}` : pathHint,
      href,
      meta: "Source",
    });
  }

  for (const slug of getCorpusSlugs()) {
    const { title, blurb } = readCorpusCard(slug);
    items.push({
      id: `corpus:${slug}`,
      title,
      subtitle: blurb || undefined,
      href: `/corpus/${encodeURIComponent(slug)}`,
      meta: "Corpus",
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
    title: "Ancestor chart",
    subtitle: "Interactive fan chart from the structured family tree",
    href: "/chart",
    meta: "Chart",
  });

  return items.sort(
    (a, b) => categoryRank(a.meta) - categoryRank(b.meta) || a.title.localeCompare(b.title)
  );
}
