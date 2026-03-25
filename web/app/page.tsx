import Link from "next/link";
import { SiteNav } from "@/components/SiteNav";
import { MasterSearch } from "@/components/MasterSearch";
import { NarrativeCarousel, type NarrativeSlide } from "@/components/NarrativeCarousel";
import { RandomizedPortraits, type PortraitEntry } from "@/components/RandomizedPortraits";
import { loadFamilyTree } from "@/lib/tree";
import { buildPhotoInfoMap, focalToObjectPosition } from "@/lib/photos";
import { countBiographicalPersonPages, getNarrativeSlugs } from "@/lib/content";
import { getSiteSearchItems } from "@/lib/siteSearchIndex";
import { readScrollySidecar, resolveScrollySteps } from "@/lib/scrollytelling";
import { readNarrativeOrLineCard } from "@/lib/browse";

function getAllPortraits(): PortraitEntry[] {
  const tree = loadFamilyTree();
  const allIds = Object.keys(tree.people);
  const infoMap = buildPhotoInfoMap(allIds);
  const seen = new Set<string>();
  const out: PortraitEntry[] = [];
  for (const id of allIds) {
    const info = infoMap[id];
    if (!info) continue;
    if (seen.has(info.url)) continue;
    seen.add(info.url);
    const person = tree.people[id];
    if (!person) continue;
    const slug = person.personPage?.replace(/^people\//, "").replace(/\.md$/, "") ?? "";
    if (!slug) continue;
    const pos = focalToObjectPosition(info.focal);
    out.push({ id, name: person.displayName ?? id, photo: info.url, slug, objectPosition: pos !== "50% 50%" ? pos : undefined });
  }
  return out;
}

function getNarrativeSlides(): NarrativeSlide[] {
  const slugs = getNarrativeSlugs();
  return slugs.map((slug) => {
    const sidecar = readScrollySidecar(slug);
    const { title: mdTitle } = readNarrativeOrLineCard("narratives", slug);
    if (sidecar) {
      const resolved = resolveScrollySteps(sidecar);
      return {
        slug,
        title: sidecar.hero.title,
        subtitle: sidecar.hero.subtitle,
        era: sidecar.hero.era,
        heroImage: resolved[0]?.media.src ?? null,
        heroFocal: resolved[0]?.media.focal,
        href: `/narratives/${encodeURIComponent(slug)}`,
      };
    }
    return {
      slug,
      title: mdTitle,
      subtitle: "",
      era: "",
      heroImage: null,
      href: `/narratives/${encodeURIComponent(slug)}`,
    };
  });
}

export default function HomePage() {
  const tree = loadFamilyTree();
  const totalPeople = Object.keys(tree.people).length;
  const totalUnions = Object.keys(tree.unions).length;
  const personPageCount = countBiographicalPersonPages();
  const allPortraits = getAllPortraits();
  const narrativeSlides = getNarrativeSlides();
  const siteSearchItems = getSiteSearchItems();

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SiteNav />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-zinc-100 bg-linear-to-br from-zinc-50 via-white to-sky-50">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
          <p className="mb-3 text-sm font-medium uppercase tracking-widest text-sky-700/70">
            Family history
          </p>
          <h1 className="font-serif text-4xl font-bold tracking-tight text-zinc-900 sm:text-6xl">
            Lewis · Evans · Zerauschek · Cerpa
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-zinc-600">
            Seven generations from South Wales and London to Chile — through Qajar Persia,
            Habsburg Dalmatia, and Baltic Tallinn. Pieced together from parish registers,
            military citations, diplomatic letters, and family portraits.
          </p>
          <MasterSearch items={siteSearchItems} />
          <div className="mt-6 flex items-center gap-6 text-sm text-zinc-500">
            <span><strong className="text-zinc-900">{totalPeople}</strong> people</span>
            <span><strong className="text-zinc-900">{totalUnions}</strong> families</span>
            <span><strong className="text-zinc-900">{personPageCount}</strong> person pages</span>
            <span><strong className="text-zinc-900">{narrativeSlides.length}</strong> narratives</span>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/chart"
              className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10"/><path d="M2 12h20"/></svg>
              Ancestor chart
            </Link>
            <Link
              href="/people"
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50"
            >
              Browse all people
            </Link>
          </div>
        </div>
      </section>

      {/* Narrative carousel */}
      <NarrativeCarousel slides={narrativeSlides} />

      {/* Featured portraits — randomized on each visit */}
      <RandomizedPortraits portraits={allPortraits} />

      {/* Quick links grid */}
      <section className="py-14">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="mb-8 font-serif text-2xl font-bold tracking-tight text-zinc-900">Explore</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {([
              { href: "/people", label: "People", desc: `${personPageCount} biographical pages`, icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
              { href: "/sources", label: "Sources", desc: "60 citation cards", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg> },
              { href: "/topics", label: "Topics", desc: "Places, institutions, themes", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg> },
              { href: "/chart", label: "Ancestor chart", desc: "7-generation fan chart", icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10"/><path d="M2 12h20"/></svg> },
            ]).map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group flex items-start gap-3 rounded-lg border border-zinc-200 bg-white p-4 transition hover:border-sky-200 hover:shadow-sm"
              >
                <span className="mt-0.5 flex-none text-zinc-400 group-hover:text-sky-600 transition">{item.icon}</span>
                <div>
                  <h3 className="font-semibold text-zinc-800 group-hover:text-sky-700">{item.label}</h3>
                  <p className="text-xs text-zinc-500">{item.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-200/60 bg-zinc-50 py-10 text-center">
        <div className="mx-auto flex flex-col items-center gap-2">
          <svg width="24" height="24" viewBox="0 0 32 32" aria-hidden="true" className="text-zinc-300">
            <line x1="16" y1="29" x2="16" y2="18" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
            <line x1="16" y1="18" x2="10" y2="12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
            <line x1="16" y1="18" x2="22" y2="12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
            <line x1="10" y1="12" x2="6" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <line x1="10" y1="12" x2="14" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <line x1="22" y1="12" x2="18" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <line x1="22" y1="12" x2="26" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <circle cx="6" cy="5" r="2.2" fill="currentColor" opacity="0.6"/>
            <circle cx="14" cy="5" r="2.2" fill="currentColor" opacity="0.6"/>
            <circle cx="18" cy="5" r="2.2" fill="currentColor" opacity="0.6"/>
            <circle cx="26" cy="5" r="2.2" fill="currentColor" opacity="0.6"/>
          </svg>
          <p className="font-serif text-sm text-zinc-400">
            Lewis · Evans · Zerauschek · Cerpa
          </p>
          <p className="text-xs text-zinc-400/70">
            {totalPeople} people · {totalUnions} families · built from the vault
          </p>
        </div>
      </footer>
    </div>
  );
}
