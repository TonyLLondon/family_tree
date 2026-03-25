"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

export interface NarrativeSlide {
  slug: string;
  title: string;
  subtitle: string;
  era: string;
  heroImage: string | null;
  heroFocal?: [number, number];
  href: string;
}

function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function NarrativeCarousel({ slides }: { slides: NarrativeSlide[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [shuffled, setShuffled] = useState(slides);

  useEffect(() => {
    setShuffled(shuffle(slides));
  }, [slides]);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [updateScrollState]);

  const scroll = useCallback((direction: -1 | 1) => {
    const el = scrollRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>(":scope > a");
    const cardWidth = card?.offsetWidth ?? 380;
    el.scrollBy({ left: direction * (cardWidth + 20), behavior: "smooth" });
  }, []);

  if (shuffled.length === 0) return null;

  return (
    <section className="border-b border-zinc-100 py-14">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-zinc-900">
              Narratives
            </h2>
            <p className="mt-1 text-zinc-500">
              Long-form essays weaving together the evidence
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              aria-label="Previous"
              onClick={() => scroll(-1)}
              disabled={!canScrollLeft}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-600 shadow-sm transition hover:bg-zinc-50 disabled:cursor-default disabled:opacity-30"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <button
              type="button"
              aria-label="Next"
              onClick={() => scroll(1)}
              disabled={!canScrollRight}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-600 shadow-sm transition hover:bg-zinc-50 disabled:cursor-default disabled:opacity-30"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>
        </div>

        <div
          ref={scrollRef}
          className="flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth pb-4"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {shuffled.map((s) => (
            <Link
              key={s.slug}
              href={s.href}
              className="group relative flex-none snap-start overflow-hidden rounded-2xl shadow-md ring-1 ring-black/5 transition hover:shadow-xl hover:ring-black/10"
              style={{ width: "min(380px, 80vw)", height: "280px" }}
            >
              {s.heroImage ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={s.heroImage}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    style={s.heroFocal ? { objectPosition: `${Math.round(s.heroFocal[0] * 100)}% ${Math.round(s.heroFocal[1] * 100)}%` } : undefined}
                    draggable={false}
                  />
                  <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/40 to-black/5" />
                </>
              ) : (
                <div className="absolute inset-0 bg-linear-to-br from-zinc-200 to-zinc-300" />
              )}
              <div className="relative z-10 flex h-full flex-col justify-end p-6">
                {s.era && (
                  <span className="mb-2 inline-block text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">
                    {s.era}
                  </span>
                )}
                <h3 className="text-lg font-bold leading-snug text-white drop-shadow-sm">
                  {s.title}
                </h3>
                {s.subtitle && (
                  <p className="mt-1 text-sm leading-relaxed text-white/75">
                    {s.subtitle}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
