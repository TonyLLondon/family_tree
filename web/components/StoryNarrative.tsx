"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MarkdownContent } from "./MarkdownContent";

// ── Types ────────────────────────────────────────────────────────────────────

export interface StoryMedia {
  src: string;
  alt: string;
  caption?: string;
  focal?: [number, number];
}

export interface StoryPage {
  media: StoryMedia;
  era?: string;
}

interface MarkdownSection {
  heading: string;
  slug: string;
  body: string;
}

interface Props {
  hero: { title: string; subtitle: string; era: string };
  sections: MarkdownSection[];
  pages: StoryPage[];
  appendixSections: MarkdownSection[];
  filePath: string;
}

// ── Component ────────────────────────────────────────────────────────────────

export function StoryNarrative({
  hero,
  sections,
  pages,
  appendixSections,
  filePath,
}: Props) {
  const [idx, setIdx] = useState(-1);
  const [lightbox, setLightbox] = useState(false);
  const [swipeHint, setSwipeHint] = useState<"left" | "right" | null>(null);
  const touchStart = useRef({ x: 0, y: 0, t: 0 });
  const textRef = useRef<HTMLDivElement>(null);
  const total = pages.length;
  const hasAppendix = appendixSections.length > 0;
  const maxIdx = hasAppendix ? total : total - 1;

  // ── Navigation (stable callbacks — no idx dependency) ───────────────────

  const next = useCallback(() => {
    setIdx((prev) => Math.min(prev + 1, maxIdx));
  }, [maxIdx]);

  const prev = useCallback(() => {
    setIdx((prev) => Math.max(prev - 1, -1));
  }, []);

  // Scroll text panel to top on page change
  useEffect(() => {
    textRef.current?.scrollTo({ top: 0 });
  }, [idx]);

  // ── URL hash tracking ──────────────────────────────────────────────────

  const mountDone = useRef(false);

  useEffect(() => {
    if (!mountDone.current) {
      mountDone.current = true;
      return;
    }
    if (typeof window === "undefined") return;
    if (idx >= 0 && idx < total && sections[idx]?.slug) {
      history.pushState(null, "", `#${sections[idx].slug}`);
    } else if (idx === total && hasAppendix) {
      history.pushState(null, "", "#appendix");
    } else if (idx === -1) {
      history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}`,
      );
    }
  }, [idx, total, sections, hasAppendix]);

  // Restore from URL hash on mount
  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash) return;
    if (hash === "appendix" && hasAppendix) {
      setIdx(total);
      return;
    }
    const matchIdx = sections.findIndex((s) => s.slug === hash);
    if (matchIdx >= 0 && matchIdx < total) setIdx(matchIdx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle browser back/forward
  useEffect(() => {
    const onPopState = () => {
      const hash = window.location.hash.replace(/^#/, "");
      if (!hash) {
        setIdx(-1);
        return;
      }
      if (hash === "appendix" && hasAppendix) {
        setIdx(total);
        return;
      }
      const matchIdx = sections.findIndex((s) => s.slug === hash);
      if (matchIdx >= 0 && matchIdx < total) setIdx(matchIdx);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [sections, total, hasAppendix]);

  // ── Keyboard ───────────────────────────────────────────────────────────

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

  // ── Trackpad / mouse-wheel horizontal swipe ────────────────────────────

  const wheelAccum = useRef(0);
  const wheelTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wheelLocked = useRef(false);

  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (lightbox || wheelLocked.current) return;
      const absDx = Math.abs(e.deltaX);
      const absDy = Math.abs(e.deltaY);
      if (absDx < 5 || absDx < absDy) return;

      wheelAccum.current += e.deltaX;
      if (wheelTimer.current) clearTimeout(wheelTimer.current);
      wheelTimer.current = setTimeout(() => {
        wheelAccum.current = 0;
      }, 150);

      if (Math.abs(wheelAccum.current) > 120) {
        if (wheelAccum.current > 0) next();
        else prev();
        wheelAccum.current = 0;
        wheelLocked.current = true;
        setTimeout(() => {
          wheelLocked.current = false;
        }, 400);
      }
    };
    window.addEventListener("wheel", onWheel, { passive: true });
    return () => window.removeEventListener("wheel", onWheel);
  }, [next, prev, lightbox]);

  // ── Touch swipe ────────────────────────────────────────────────────────

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStart.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      t: Date.now(),
    };
    setSwipeHint(null);
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - touchStart.current.x;
    const dy = e.touches[0].clientY - touchStart.current.y;
    if (Math.abs(dx) > 20 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      setSwipeHint(dx < 0 ? "left" : "right");
    } else {
      setSwipeHint(null);
    }
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      setSwipeHint(null);
      const dx = e.changedTouches[0].clientX - touchStart.current.x;
      const dy = e.changedTouches[0].clientY - touchStart.current.y;
      const dt = Date.now() - touchStart.current.t;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);
      if (absDx > 40 && absDx > absDy * 1.2 && dt < 500) {
        if (dx < 0) next();
        else prev();
      }
    },
    [next, prev],
  );

  // ── Image preloading (±1 page) ────────────────────────────────────────

  useEffect(() => {
    for (const offset of [-1, 1]) {
      const i = idx + offset;
      if (i >= 0 && i < total) {
        const img = new window.Image();
        img.src = pages[i].media.src;
      }
    }
  }, [idx, pages, total]);

  // ── Render: Cover ──────────────────────────────────────────────────────

  if (idx === -1) {
    return (
      <div
        className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-stone-950 cursor-pointer"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onClick={next}
      >
        {pages.length > 0 && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={pages[0].media.src}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-15 blur-sm pointer-events-none"
            draggable={false}
          />
        )}

        <Link
          href="/stories"
          className="absolute left-4 top-4 text-stone-600 hover:text-stone-400 text-sm transition z-10"
          onClick={(e) => e.stopPropagation()}
        >
          ← Stories
        </Link>

        <div className="relative px-8 text-center max-w-2xl">
          <p className="text-[10px] font-medium uppercase tracking-[0.35em] text-amber-600/60 mb-8">
            {hero.era}
          </p>
          <h1 className="font-serif text-4xl md:text-6xl lg:text-7xl text-stone-100 leading-[1.1] mb-6">
            {hero.title}
          </h1>
          <p className="text-base md:text-lg text-stone-500 leading-relaxed mb-10">
            {hero.subtitle}
          </p>
          <div className="inline-flex flex-col items-center gap-3">
            <button
              onClick={next}
              className="px-8 py-3 rounded-full bg-amber-600/20 hover:bg-amber-600/30 text-amber-200/80 hover:text-amber-100 transition text-sm tracking-wide border border-amber-600/20"
            >
              Begin · {total} pages →
            </button>
            <span className="text-[10px] text-stone-700 tracking-wider">
              click anywhere · arrow keys · swipe
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: Appendix ───────────────────────────────────────────────────

  if (idx === total && hasAppendix) {
    return (
      <div
        className="fixed inset-0 z-40 flex flex-col bg-white"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className="flex items-center justify-between px-3 py-2 md:px-5 md:py-3 shrink-0 border-b border-zinc-200/60">
          <Link
            href="/stories"
            className="text-zinc-400 hover:text-zinc-700 text-xs transition px-2.5 py-1 rounded"
          >
            ← Stories
          </Link>
          <span className="text-[10px] text-zinc-400 font-mono tracking-widest">
            Appendix
          </span>
        </div>

        <div
          ref={textRef}
          className="flex-1 overflow-y-auto overscroll-contain"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <div className="mx-auto max-w-prose px-5 py-8 md:px-8 md:py-12">
            {appendixSections.map((section, i) => (
              <section
                key={section.slug || `appendix-${i}`}
                id={section.slug}
                className="mb-10 border-b border-zinc-100 pb-10 last:border-0"
              >
                <h2 className="font-serif text-xl md:text-2xl text-zinc-900 leading-tight mb-5">
                  {section.heading}
                </h2>
                <div className="prose prose-sm md:prose-base max-w-none prose-p:text-zinc-600 prose-strong:text-zinc-800 prose-a:text-amber-700 prose-a:no-underline hover:prose-a:text-amber-600">
                  <MarkdownContent content={section.body} filePath={filePath} />
                </div>
              </section>
            ))}
          </div>
        </div>

        <button
          onClick={prev}
          className="absolute left-2 md:left-3 top-1/2 -translate-y-1/2 z-40 w-10 h-10 md:w-11 md:h-11 flex items-center justify-center rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-400 hover:text-zinc-700 transition text-lg md:text-xl"
          aria-label="Back to pages"
        >
          ‹
        </button>

        {/* progress bar */}
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-zinc-100">
          <div
            className="h-full bg-amber-600/40 transition-all duration-300"
            style={{ width: "100%" }}
          />
        </div>
      </div>
    );
  }

  // ── Render: Page view (side-by-side) ───────────────────────────────────

  const pg = pages[idx];
  const sec = sections[idx];
  const canGoNext = idx < maxIdx;

  return (
    <>
      <style>{`
        @keyframes storyFade {
          from { opacity: 0; transform: translateX(6px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .story-fade { animation: storyFade .3s ease-out both; }
      `}</style>

      <div
        className="fixed inset-0 z-40 flex flex-col md:flex-row bg-stone-950"
        style={{ touchAction: "pan-y" }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
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

        {/* swipe edge indicators (mobile) */}
        <div
          className="md:hidden absolute left-0 top-0 bottom-0 w-8 z-30 pointer-events-none transition-opacity duration-150"
          style={{ opacity: swipeHint === "right" && idx > 0 ? 0.6 : 0 }}
        >
          <div className="h-full w-full bg-linear-to-r from-white/15 to-transparent flex items-center justify-start pl-1">
            <span className="text-white/60 text-xl">‹</span>
          </div>
        </div>
        <div
          className="md:hidden absolute right-0 top-0 bottom-0 w-8 z-30 pointer-events-none transition-opacity duration-150"
          style={{
            opacity: swipeHint === "left" && canGoNext ? 0.6 : 0,
          }}
        >
          <div className="h-full w-full bg-linear-to-l from-white/15 to-transparent flex items-center justify-end pr-1">
            <span className="text-white/60 text-xl">›</span>
          </div>
        </div>

        {/* image panel */}
        <div className="relative w-full md:w-[55%] h-[50vh] md:h-full shrink-0 bg-black/40 flex items-center justify-center">
          <button
            type="button"
            className="absolute inset-0 flex items-center justify-center cursor-zoom-in focus:outline-none"
            onClick={() => setLightbox(true)}
            aria-label="Zoom image"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={idx}
              src={pg.media.src}
              alt={pg.media.alt}
              className="max-h-[calc(100%-1.5rem)] max-w-[calc(100%-1.5rem)] object-contain story-fade"
              style={
                pg.media.focal
                  ? {
                      objectPosition: `${Math.round(pg.media.focal[0] * 100)}% ${Math.round(pg.media.focal[1] * 100)}%`,
                    }
                  : undefined
              }
              draggable={false}
            />
          </button>

          {pg.media.caption && (
            <div
              className="absolute bottom-3 right-3 z-10 max-w-xs rounded-lg bg-black/50 px-3 py-2 text-[11px] leading-relaxed text-white/70 backdrop-blur-sm"
              style={{
                bottom: "max(0.75rem, env(safe-area-inset-bottom))",
                right: "max(0.75rem, env(safe-area-inset-right))",
              }}
            >
              {pg.media.caption}
            </div>
          )}
        </div>

        {/* text panel */}
        <div
          ref={textRef}
          className="flex-1 overflow-y-auto overscroll-contain border-t border-white/4 md:border-t-0 md:border-l md:border-white/6 pb-16 md:pb-0"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {sec ? (
            <div key={idx} className="p-5 md:p-8 lg:p-12 story-fade">
              {pg.era && (
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-600/50 mb-4">
                  {pg.era}
                </p>
              )}
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

              {idx === total - 1 && hasAppendix && (
                <div className="mt-8 pt-6 border-t border-white/5">
                  <button
                    onClick={next}
                    className="text-amber-600/60 hover:text-amber-400 text-sm transition"
                  >
                    Continue to appendix →
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div
              key={idx}
              className="flex h-full items-center justify-center p-8 story-fade"
            >
              <p className="text-stone-600 text-sm italic text-center max-w-xs">
                {pg.media.alt}
              </p>
            </div>
          )}
        </div>

        {/* prev / next arrows */}
        {idx > 0 && (
          <button
            onClick={prev}
            className="absolute left-2 md:left-3 top-1/2 -translate-y-1/2 z-40 w-10 h-10 md:w-11 md:h-11 flex items-center justify-center rounded-full bg-black/40 md:bg-white/8 hover:bg-white/20 text-white/60 hover:text-white backdrop-blur-sm transition text-lg md:text-xl"
            aria-label="Previous"
          >
            ‹
          </button>
        )}
        {canGoNext && (
          <button
            onClick={next}
            className="absolute right-2 md:right-3 top-1/2 -translate-y-1/2 z-40 w-10 h-10 md:w-11 md:h-11 flex items-center justify-center rounded-full bg-black/40 md:bg-white/8 hover:bg-white/20 text-white/60 hover:text-white backdrop-blur-sm transition text-lg md:text-xl"
            aria-label="Next"
          >
            ›
          </button>
        )}

        {/* progress bar */}
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/5 z-50">
          <div
            className="h-full bg-amber-600/30 transition-all duration-300"
            style={{ width: `${((idx + 1) / total) * 100}%` }}
          />
        </div>
      </div>

      {/* lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/95 backdrop-blur-sm"
          onClick={() => setLightbox(false)}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={(e) => {
            setSwipeHint(null);
            const dx = e.changedTouches[0].clientX - touchStart.current.x;
            const dy = e.changedTouches[0].clientY - touchStart.current.y;
            const dt = Date.now() - touchStart.current.t;
            const absDx = Math.abs(dx);
            const absDy = Math.abs(dy);
            if (absDx > 40 && absDx > absDy * 1.2 && dt < 500) {
              setLightbox(false);
              if (dx < 0) next();
              else prev();
            }
          }}
          role="dialog"
          aria-modal="true"
        >
          <button
            onClick={() => setLightbox(false)}
            className="absolute right-4 top-4 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white/60 hover:text-white hover:bg-white/20 transition text-xl"
            aria-label="Close"
          >
            ×
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={pg.media.src}
            alt={pg.media.alt}
            className="max-h-[95vh] max-w-[95vw] object-contain"
            onClick={(e) => e.stopPropagation()}
            draggable={false}
          />
        </div>
      )}
    </>
  );
}
