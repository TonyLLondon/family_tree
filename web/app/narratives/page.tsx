import { SiteNav } from "@/components/SiteNav";
import { getNarrativeSlugs } from "@/lib/content";
import { readScrollySidecar, resolveScrollySteps } from "@/lib/scrollytelling";
import { readNarrativeOrLineCard } from "@/lib/browse";
import {
  NarrativeCardsGrid,
  type NarrativeCardData,
} from "@/components/NarrativeCardsGrid";

function buildCards(): NarrativeCardData[] {
  const slugs = getNarrativeSlugs();

  return slugs.map((slug) => {
    const sidecar = readScrollySidecar(slug);
    const { title: mdTitle, blurb } = readNarrativeOrLineCard("narratives", slug);

    if (sidecar) {
      const resolved = resolveScrollySteps(sidecar);
      return {
        slug,
        title: sidecar.hero.title,
        subtitle: sidecar.hero.subtitle,
        era: sidecar.hero.era,
        blurb,
        heroImage: resolved[0]?.media.src ?? null,
        href: `/narratives/${encodeURIComponent(slug)}`,
      };
    }

    return {
      slug,
      title: mdTitle,
      subtitle: "",
      era: "",
      blurb,
      heroImage: null,
      href: `/narratives/${encodeURIComponent(slug)}`,
    };
  });
}

export default function NarrativesIndexPage() {
  const cards = buildCards();

  return (
    <>
      <SiteNav />
      <main className="mx-auto max-w-6xl px-4 py-10 md:px-6">
        <header className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 md:text-4xl">
            Narratives
          </h1>
          <p className="mt-2 max-w-2xl text-base leading-relaxed text-zinc-500">
            Long-form essays following families across generations, countries, and
            centuries — from Qajar Persia to the Welsh coalfields.
          </p>
        </header>

        <NarrativeCardsGrid cards={cards} />
      </main>

      <footer className="border-t border-zinc-100 bg-zinc-50 py-6 text-center text-xs text-zinc-400">
        Family history archive — built from the vault
      </footer>
    </>
  );
}
