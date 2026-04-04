"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MarkdownContent } from "./MarkdownContent";

interface ScrapbookPage {
  image: string;
  alt: string;
}

interface MarkdownSection {
  heading: string;
  slug: string;
  body: string;
}

interface Props {
  hero: { title: string; subtitle: string; era: string };
  sections: MarkdownSection[];
  pages: ScrapbookPage[];
  filePath: string;
}

export function ScrapbookNarrative({
  hero,
  sections,
  pages,
  filePath,
}: Props) {
  const [idx, setIdx] = useState(-1);
  const [lightbox, setLightbox] = useState(false);
  const touchStart = useRef({ x: 0, y: 0 });
  const textRef = useRef<HTMLDivElement>(null);
  const total = pages.length;

  const go = useCallback(
    (target: number) => {
      const clamped = Math.max(-1, Math.min(target, total - 1));
      if (clamped === idx) return;
      setIdx(clamped);
      textRef.current?.scrollTo({ top: 0 });
    },
    [idx, total],
  );

  const next = useCallback(() => go(idx + 1), [go, idx]);
  const prev = useCallback(() => go(idx - 1), [go, idx]);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        prev();
      } else if (e.key === "Escape" && lightbox) {
        setLightbox(false);
      }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [next, prev, lightbox]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStart.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const dx = e.changedTouches[0].clientX - touchStart.current.x;
      const dy = e.changedTouches[0].clientY - touchStart.current.y;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        if (dx < 0) next();
        else prev();
      }
    },
    [next, prev],
  );

  useEffect(() => {
    for (const offset of [-1, 1]) {
      const i = idx + offset;
      if (i >= 0 && i < total) {
        const img = new window.Image();
        img.src = pages[i].image;
      }
    }
  }, [idx, pages, total]);

  /* ── cover ── */
  if (idx === -1) {
    return (
      <div
        className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-stone-950"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <Link
          href="/stories"
          className="absolute left-4 top-4 text-stone-600 hover:text-stone-400 text-sm transition"
        >
          ← Stories
        </Link>
        <div className="px-8 text-center max-w-2xl">
          <p className="text-[10px] font-medium uppercase tracking-[0.35em] text-amber-600/60 mb-8">
            {hero.era}
          </p>
          <h1 className="font-serif text-4xl md:text-6xl lg:text-7xl text-stone-100 leading-[1.1] mb-6">
            {hero.title}
          </h1>
          <p className="text-base md:text-lg text-stone-500 leading-relaxed mb-16">
            {hero.subtitle}
          </p>
          <button
            onClick={next}
            className="group text-stone-600 hover:text-stone-400 transition text-sm"
          >
            <span className="tracking-wide">{total} pages</span>
            <span className="ml-3 inline-block group-hover:translate-x-1 transition-transform">
              →
            </span>
          </button>
        </div>
      </div>
    );
  }

  /* ── page view ── */
  const pg = pages[idx];
  const sec = sections[idx];

  return (
    <>
      <style>{`
        @keyframes scrapFade {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .scrap-fade { animation: scrapFade .25s ease-out both; }
      `}</style>

      <div className="fixed inset-0 z-40 flex flex-col md:flex-row bg-stone-950">
        {/* top bar */}
        <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-3 py-2 md:px-5 md:py-3 pointer-events-none">
          <Link
            href="/stories"
            className="pointer-events-auto text-white/30 hover:text-white/70 text-xs transition bg-black/30 backdrop-blur-sm px-2.5 py-1 rounded"
          >
            ← Stories
          </Link>
          <span className="text-[10px] text-white/20 font-mono tracking-widest">
            {idx + 1}&#8201;/&#8201;{total}
          </span>
        </div>

        {/* image panel — swipe target on mobile */}
        <div
          className="relative w-full md:w-[55%] h-[50vh] md:h-full shrink-0 bg-black/40 flex items-center justify-center"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <button
            type="button"
            className="absolute inset-0 flex items-center justify-center cursor-zoom-in focus:outline-none"
            onClick={() => setLightbox(true)}
            aria-label="Zoom image"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={idx}
              src={pg.image}
              alt={pg.alt}
              className="max-h-[calc(100%-1.5rem)] max-w-[calc(100%-1.5rem)] object-contain scrap-fade"
              draggable={false}
            />
          </button>
        </div>

        {/* text panel */}
        <div
          ref={textRef}
          className="flex-1 overflow-y-auto overscroll-contain border-t border-white/4 md:border-t-0 md:border-l md:border-white/6"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {sec ? (
            <div key={idx} className="p-5 md:p-8 lg:p-12 scrap-fade">
              <h2 className="font-serif text-xl md:text-2xl lg:text-3xl text-stone-100 leading-tight mb-6">
                {sec.heading}
              </h2>
              <div
                className={[
                  "prose prose-sm md:prose-base prose-invert max-w-none",
                  "prose-blockquote:border-l-amber-600/40",
                  "prose-blockquote:bg-amber-950/20",
                  "prose-blockquote:py-2 prose-blockquote:px-4",
                  "prose-blockquote:rounded-r",
                  "prose-blockquote:font-serif",
                  "prose-blockquote:text-stone-300/90",
                  "prose-blockquote:not-italic",
                  "prose-p:text-stone-400",
                  "prose-em:text-amber-200/60",
                  "prose-strong:text-stone-200",
                  "prose-a:text-amber-400/70 prose-a:no-underline hover:prose-a:text-amber-300",
                ].join(" ")}
              >
                <MarkdownContent content={sec.body} filePath={filePath} />
              </div>
            </div>
          ) : (
            <div
              key={idx}
              className="flex h-full items-center justify-center p-8 scrap-fade"
            >
              <p className="text-stone-600 text-sm italic text-center max-w-xs">
                {pg.alt}
              </p>
            </div>
          )}
        </div>

        {/* desktop prev arrow — anchored to left edge of text panel */}
        {idx > 0 && (
          <button
            onClick={prev}
            className="hidden md:flex absolute left-3 top-1/2 -translate-y-1/2
              w-10 h-10 items-center justify-center rounded-full
              bg-white/5 hover:bg-white/15 text-white/40 hover:text-white/80
              backdrop-blur-sm transition text-lg"
            aria-label="Previous page"
          >
            ‹
          </button>
        )}
        {idx < total - 1 && (
          <button
            onClick={next}
            className="hidden md:flex absolute right-3 top-1/2 -translate-y-1/2
              w-10 h-10 items-center justify-center rounded-full
              bg-white/5 hover:bg-white/15 text-white/40 hover:text-white/80
              backdrop-blur-sm transition text-lg"
            aria-label="Next page"
          >
            ›
          </button>
        )}

        {/* mobile bottom nav */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-2.5 pointer-events-none">
          <button
            onClick={prev}
            disabled={idx <= 0}
            className="pointer-events-auto w-9 h-9 flex items-center justify-center rounded-full
              bg-white/10 text-white/50 active:bg-white/25 disabled:opacity-0
              transition text-lg backdrop-blur-sm"
            aria-label="Previous"
          >
            ‹
          </button>
          <span className="text-[10px] text-white/20 font-mono">
            {idx + 1} / {total}
          </span>
          <button
            onClick={next}
            disabled={idx >= total - 1}
            className="pointer-events-auto w-9 h-9 flex items-center justify-center rounded-full
              bg-white/10 text-white/50 active:bg-white/25 disabled:opacity-0
              transition text-lg backdrop-blur-sm"
            aria-label="Next"
          >
            ›
          </button>
        </div>
      </div>

      {/* lightbox — pinch-zoom on mobile for reading handwriting */}
      {lightbox && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/95 backdrop-blur-sm"
          onClick={() => setLightbox(false)}
          role="dialog"
          aria-modal="true"
        >
          <button
            onClick={() => setLightbox(false)}
            className="absolute right-4 top-4 w-10 h-10 flex items-center justify-center rounded-full
              bg-white/10 text-white/60 hover:text-white hover:bg-white/20 transition text-xl"
            aria-label="Close"
          >
            ×
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={pg.image}
            alt={pg.alt}
            className="max-h-[95vh] max-w-[95vw] object-contain"
            onClick={(e) => e.stopPropagation()}
            draggable={false}
          />
        </div>
      )}
    </>
  );
}
