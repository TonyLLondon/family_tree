"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type BrowseItem = {
  id: string;
  title: string;
  subtitle?: string;
  href: string;
  meta?: string;
  heroImage?: string | null;
  heroFocal?: [number, number];
};

/** Items loaded per step — cursor is the slice end index into the filtered list. */
const BATCH_SIZE = 24;
const SCROLL_ROOT_MARGIN = "480px";
const INTERSECTION_THROTTLE_MS = 180;

export function BrowseGrid({
  items,
  emptyMessage = "No matches.",
  searchPlaceholder = "Search…",
}: {
  items: BrowseItem[];
  emptyMessage?: string;
  searchPlaceholder?: string;
}) {
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(BATCH_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const lastAutoLoadRef = useRef(0);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((it) => {
      const hay = `${it.title} ${it.subtitle ?? ""} ${it.meta ?? ""} ${it.href}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [items, q]);

  useEffect(() => {
    setCursor(BATCH_SIZE);
  }, [q, items]);

  const visible = useMemo(() => filtered.slice(0, cursor), [filtered, cursor]);
  const hasMore = cursor < filtered.length;
  const remaining = filtered.length - cursor;

  const loadMore = useCallback(() => {
    setCursor((c) => Math.min(c + BATCH_SIZE, filtered.length));
  }, [filtered.length]);

  useEffect(() => {
    if (!hasMore) return;
    const node = sentinelRef.current;
    if (!node) return;

    const obs = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        const now = Date.now();
        if (now - lastAutoLoadRef.current < INTERSECTION_THROTTLE_MS) return;
        lastAutoLoadRef.current = now;
        setCursor((c) => Math.min(c + BATCH_SIZE, filtered.length));
      },
      { root: null, rootMargin: SCROLL_ROOT_MARGIN, threshold: 0 }
    );

    obs.observe(node);
    return () => obs.disconnect();
  }, [hasMore, filtered.length, visible.length]);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="w-full max-w-md">
          <label htmlFor="browse-search" className="sr-only">
            Search
          </label>
          <input
            id="browse-search"
            type="search"
            autoComplete="off"
            placeholder={searchPlaceholder}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
          />
        </div>
        <div className="text-right text-sm text-zinc-500">
          {filtered.length === 0 ? (
            <span>0 entries</span>
          ) : filtered.length === items.length ? (
            <span>
              {hasMore ? (
                <>
                  Showing <strong className="text-zinc-700">{visible.length}</strong> of {filtered.length}
                </>
              ) : (
                <span>{filtered.length} entries</span>
              )}
            </span>
          ) : (
            <span>
              {hasMore ? (
                <>
                  Showing <strong className="text-zinc-700">{visible.length}</strong> of {filtered.length} matches
                  <span className="text-zinc-400"> · {items.length} total</span>
                </>
              ) : (
                <>
                  {filtered.length} matches <span className="text-zinc-400">· {items.length} total</span>
                </>
              )}
            </span>
          )}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50 px-4 py-8 text-center text-zinc-500">{emptyMessage}</p>
      ) : (
        <>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((it) => (
              <li key={it.id}>
                {it.heroImage ? (
                  <Link
                    href={it.href}
                    className="group relative flex min-h-[220px] flex-col justify-end overflow-hidden rounded-2xl shadow-md ring-1 ring-black/5 transition hover:shadow-xl hover:ring-black/10 md:min-h-[260px]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={it.heroImage}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105 group-active:scale-105"
                      style={it.heroFocal ? { objectPosition: `${Math.round(it.heroFocal[0] * 100)}% ${Math.round(it.heroFocal[1] * 100)}%` } : undefined}
                      draggable={false}
                    />
                    <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/40 to-black/10" />
                    <div className="relative z-10 p-5 md:p-6">
                      {it.meta && (
                        <span className="mb-1.5 inline-block text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">
                          {it.meta}
                        </span>
                      )}
                      <h2 className="text-base font-bold leading-snug text-white md:text-lg">{it.title}</h2>
                      {it.subtitle && (
                        <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-white/75">{it.subtitle}</p>
                      )}
                    </div>
                  </Link>
                ) : (
                  <Link
                    href={it.href}
                    className="group flex h-full flex-col rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-sky-200 hover:shadow-md"
                  >
                    <span className="flex items-start justify-between gap-2">
                      <h2 className="text-base font-semibold leading-snug text-zinc-900 group-hover:text-sky-700">{it.title}</h2>
                      <span className="mt-0.5 flex-none text-zinc-300 transition group-hover:text-sky-500" aria-hidden>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M9 18l6-6-6-6" />
                        </svg>
                      </span>
                    </span>
                    {it.meta ? <p className="mt-1 text-xs font-medium uppercase tracking-wide text-zinc-400">{it.meta}</p> : null}
                    {it.subtitle ? <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-zinc-600">{it.subtitle}</p> : null}
                  </Link>
                )}
              </li>
            ))}
          </ul>

          {hasMore ? (
            <div className="mt-10 flex flex-col items-center gap-4">
              <button
                type="button"
                onClick={loadMore}
                className="rounded-lg border border-zinc-300 bg-white px-6 py-2.5 text-sm font-semibold text-zinc-800 shadow-sm transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-800"
              >
                Load more ({remaining} remaining)
              </button>
              <p className="text-xs text-zinc-400">Or keep scrolling — more load automatically near the bottom</p>
              <div ref={sentinelRef} className="h-4 w-full max-w-2xl shrink-0" aria-hidden />
            </div>
          ) : filtered.length > BATCH_SIZE ? (
            <p className="mt-8 text-center text-sm text-zinc-400">All {filtered.length} entries loaded</p>
          ) : null}
        </>
      )}
    </div>
  );
}
