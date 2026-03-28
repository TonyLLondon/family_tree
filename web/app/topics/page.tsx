import Link from "next/link";
import { BrowseGrid, type BrowseItem } from "@/components/BrowseGrid";
import { PageShell } from "@/components/PageShell";
import { getTopicSlugs } from "@/lib/content";
import { readTopicCard } from "@/lib/browse";
import { photoPublicPath } from "@/lib/photos";

export default function TopicsHubPage() {
  const slugs = getTopicSlugs()
    .filter((s) => s !== "index")
    .sort((a, b) => a.localeCompare(b));

  const items: BrowseItem[] = slugs.map((slug) => {
    const { title, blurb, heroImage } = readTopicCard(slug);
    return {
      id: slug,
      title,
      subtitle: blurb || undefined,
      href: `/topics/${encodeURIComponent(slug)}`,
      heroImage: heroImage ? photoPublicPath(heroImage) : undefined,
    };
  });

  return (
    <PageShell
      title="Topics"
      subtitle="Places, institutions, and cross-cutting themes — each page links people, sources, and stories."
    >
      <BrowseGrid items={items} searchPlaceholder="Search topics…" />
      <p className="mt-10 border-t border-zinc-100 pt-6 text-sm text-zinc-500">
        Folder layout and vault conventions:{" "}
        <Link href="/files/topics/index.md" className="font-medium text-sky-700 hover:underline">
          topics/index.md
        </Link>{" "}
        (raw markdown).
      </p>
    </PageShell>
  );
}
