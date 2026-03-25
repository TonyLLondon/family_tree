"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export interface NarrativeCardData {
  slug: string;
  title: string;
  subtitle: string;
  era: string;
  blurb: string;
  heroImage: string | null;
  href: string;
}

export function NarrativeCardsGrid({ cards }: { cards: NarrativeCardData[] }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return cards;
    return cards.filter((c) => {
      const hay = `${c.title} ${c.subtitle} ${c.era} ${c.blurb} ${c.slug}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [cards, q]);

  return (
    <div>
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="w-full max-w-md">
          <label htmlFor="narrative-search" className="sr-only">
            Search narratives
          </label>
          <input
            id="narrative-search"
            type="search"
            autoComplete="off"
            placeholder="Search narratives…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
          />
        </div>
        {q.trim() && (
          <p className="text-right text-sm text-zinc-500">
            {filtered.length} of {cards.length} narratives
          </p>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50 px-4 py-8 text-center text-zinc-500">
          No narratives match &ldquo;{q.trim()}&rdquo;
        </p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2">
          {filtered.map((card) => (
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
      )}
    </div>
  );
}
