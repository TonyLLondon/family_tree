"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { BrowseItem } from "@/components/BrowseGrid";

const MAX_RESULTS = 80;

function matchesQuery(it: BrowseItem, needle: string): boolean {
  const hay = `${it.title} ${it.subtitle ?? ""} ${it.meta ?? ""} ${it.href}`.toLowerCase();
  return hay.includes(needle);
}

export function MasterSearch({ items }: { items: BrowseItem[] }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const needle = q.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!needle) return [];
    return items.filter((it) => matchesQuery(it, needle));
  }, [items, needle]);

  const visible = filtered.slice(0, MAX_RESULTS);
  const overflow = filtered.length - visible.length;

  useEffect(() => {
    if (needle) setOpen(true);
  }, [needle]);

  useEffect(() => {
    const onDoc = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
  }, []);

  const onKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setQ("");
      setOpen(false);
      inputRef.current?.blur();
    }
  }, []);

  return (
    <div ref={rootRef} className="relative mt-8 max-w-2xl">
      <label htmlFor="master-search" className="sr-only">
        Search the site
      </label>
      <div className="relative">
        <span
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
          aria-hidden
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </span>
        <input
          ref={inputRef}
          id="master-search"
          type="search"
          autoComplete="off"
          placeholder="Search people, sources, stories, corpus, research…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => needle && setOpen(true)}
          onKeyDown={onKeyDown}
          className="w-full rounded-xl border border-zinc-200 bg-white py-3 pl-11 pr-4 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
        />
      </div>

      {open && needle ? (
        <div
          className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[min(70vh,28rem)] overflow-auto rounded-xl border border-zinc-200 bg-white py-2 shadow-lg"
          role="listbox"
          aria-label="Search results"
        >
          {visible.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-zinc-500">No matches.</p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {visible.map((it) => (
                <li key={it.id} role="option">
                  <Link
                    href={it.href}
                    onClick={() => {
                      setOpen(false);
                      setQ("");
                    }}
                    className="block px-4 py-3 transition hover:bg-sky-50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <span className="font-medium text-zinc-900">{it.title}</span>
                        {it.subtitle ? (
                          <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-zinc-500">{it.subtitle}</p>
                        ) : null}
                      </div>
                      {it.meta ? (
                        <span className="flex-none rounded-md bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                          {it.meta}
                        </span>
                      ) : null}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {filtered.length > 0 ? (
            <p className="border-t border-zinc-100 px-4 py-2 text-center text-[11px] text-zinc-400">
              {filtered.length} result{filtered.length === 1 ? "" : "s"}
              {overflow > 0 ? ` · first ${visible.length} shown — keep typing to narrow` : ""}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
