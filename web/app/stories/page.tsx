import { SiteNav } from "@/components/SiteNav";
import { buildAllStoryCards } from "@/lib/browse";
import { StoryCardsGrid } from "@/components/StoryCardsGrid";

export default function StoriesIndexPage() {
  const cards = buildAllStoryCards();

  return (
    <>
      <SiteNav />
      <main className="mx-auto max-w-6xl px-4 py-10 md:px-6">
        <header className="mb-10">
          <h1 className="font-serif text-3xl font-bold tracking-tight text-zinc-900 md:text-4xl">
            Stories
          </h1>
          <p className="mt-2 max-w-2xl text-base leading-relaxed text-zinc-500">
            Long-form essays following families across generations, countries, and
            centuries — from Qajar Persia to the Welsh coalfields.
          </p>
        </header>

        <StoryCardsGrid cards={cards} />
      </main>

      <footer className="border-t border-zinc-200/60 bg-zinc-50 py-8 text-center">
        <p className="font-serif text-sm text-zinc-400">
          Lewis · Evans · Zerauschek · Cerpa
        </p>
      </footer>
    </>
  );
}
