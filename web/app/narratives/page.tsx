import Link from "next/link";
import { SiteNav } from "@/components/SiteNav";
import { getNarrativeSlugs } from "@/lib/content";
import { readScrollySidecar, resolveScrollySteps } from "@/lib/scrollytelling";
import { readNarrativeOrLineCard } from "@/lib/browse";

interface NarrativeCard {
  slug: string;
  title: string;
  subtitle: string;
  era: string;
  blurb: string;
  heroImage: string | null;
  href: string;
}

function buildCards(): NarrativeCard[] {
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

        <div className="grid gap-6 sm:grid-cols-2">
          {cards.map((card) => (
            <Link
              key={card.slug}
              href={card.href}
              className="group relative flex min-h-[280px] flex-col justify-end overflow-hidden rounded-2xl shadow-md ring-1 ring-black/5 transition hover:shadow-xl hover:ring-black/10 md:min-h-[320px]"
            >
              {card.heroImage ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={card.heroImage}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    draggable={false}
                  />
                  <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/40 to-black/10" />
                  <div className="relative z-10 p-6 md:p-8">
                    {card.era && (
                      <span className="mb-2 inline-block text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">
                        {card.era}
                      </span>
                    )}
                    <h2 className="text-xl font-bold leading-snug text-white md:text-2xl">
                      {card.title}
                    </h2>
                    {card.subtitle && (
                      <p className="mt-1.5 text-sm leading-relaxed text-white/75">
                        {card.subtitle}
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex flex-1 flex-col justify-end bg-zinc-100 p-6 md:p-8">
                  <h2 className="text-xl font-bold leading-snug text-zinc-900 group-hover:text-sky-700 md:text-2xl">
                    {card.title}
                  </h2>
                  {card.blurb && (
                    <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-zinc-500">
                      {card.blurb}
                    </p>
                  )}
                </div>
              )}
            </Link>
          ))}
        </div>
      </main>

      <footer className="border-t border-zinc-100 bg-zinc-50 py-6 text-center text-xs text-zinc-400">
        Family history archive — built from the vault
      </footer>
    </>
  );
}
