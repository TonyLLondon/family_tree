import { SiteNav } from "@/components/SiteNav";
import { buildAllStoryCards } from "@/lib/browse";
import { StoryCardsGrid } from "@/components/StoryCardsGrid";

export default function StoriesIndexPage() {
  const cards = buildAllStoryCards();

  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <SiteNav />
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto min-w-0 max-w-6xl flex-1 px-4 py-10 md:px-6 outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
      >
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
    </div>
  );
}
