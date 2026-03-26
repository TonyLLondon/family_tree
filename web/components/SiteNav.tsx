"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useState } from "react";

const links = [
  { href: "/chart", label: "Family tree" },
  { href: "/stories", label: "Stories" },
  { href: "/map", label: "Map" },
  { href: "/people", label: "People" },
  { href: "/chart/lineages", label: "Bloodlines" },
  { href: "/topics", label: "Topics" },
  { href: "/sources", label: "Sources" },
] as const;

function MenuIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    );
  }
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

export function SiteNav() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPathname, setMenuPathname] = useState(pathname);
  const panelId = useId();

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  if (pathname !== menuPathname) {
    setMenuPathname(pathname);
    setMenuOpen(false);
  }

  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  const barBg =
    "bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80";

  return (
    <header className={`sticky top-0 z-40 border-b border-zinc-200/80 ${barBg}`}>
      <div className="relative mx-auto max-w-6xl">
        <div
          className={`relative z-60 flex items-center justify-between gap-3 px-4 py-2.5 md:justify-start ${barBg}`}
        >
          <Link
            href="/"
            className="flex items-center gap-2 text-base font-bold tracking-tight text-zinc-900 transition hover:text-sky-700"
            onClick={closeMenu}
          >
            <svg width="20" height="20" viewBox="0 0 32 32" aria-hidden="true" className="flex-none">
              <line x1="16" y1="29" x2="16" y2="18" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.8"/>
              <line x1="16" y1="18" x2="10" y2="12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" opacity="0.7"/>
              <line x1="16" y1="18" x2="22" y2="12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" opacity="0.7"/>
              <line x1="10" y1="12" x2="6" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.55"/>
              <line x1="10" y1="12" x2="14" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.55"/>
              <line x1="22" y1="12" x2="18" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.55"/>
              <line x1="22" y1="12" x2="26" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.55"/>
              <circle cx="6" cy="5" r="2.2" fill="#0ea5e9"/>
              <circle cx="14" cy="5" r="2.2" fill="#0ea5e9"/>
              <circle cx="18" cy="5" r="2.2" fill="#0ea5e9"/>
              <circle cx="26" cy="5" r="2.2" fill="#0ea5e9"/>
            </svg>
            <span className="font-serif">Family history</span>
          </Link>

          <button
            type="button"
            className="-mr-1 inline-flex items-center justify-center rounded-md p-2 text-zinc-700 transition hover:bg-zinc-100 hover:text-zinc-900 md:hidden"
            aria-expanded={menuOpen}
            aria-controls={panelId}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <MenuIcon open={menuOpen} />
          </button>

          <nav
            className="hidden flex-wrap items-center gap-0.5 text-[13px] md:ml-4 md:flex"
            aria-label="Main"
          >
            {links.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="rounded-md px-2.5 py-1.5 font-medium text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>

        {menuOpen ? (
          <>
            <button
              type="button"
              className="fixed inset-0 z-50 bg-zinc-900/40 md:hidden"
              aria-label="Close menu"
              onClick={closeMenu}
            />
            <nav
              id={panelId}
              className="absolute left-0 right-0 top-full z-70 border-b border-zinc-200 bg-white shadow-lg md:hidden"
              aria-label="Main"
            >
              <div className="mx-auto flex max-w-6xl flex-col px-4 py-3 text-[15px]">
                {links.map(({ href, label }) => (
                  <Link
                    key={href}
                    href={href}
                    className="rounded-md px-2 py-3 font-medium text-zinc-700 transition hover:bg-zinc-50 hover:text-zinc-900"
                    onClick={closeMenu}
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </nav>
          </>
        ) : null}
      </div>
    </header>
  );
}
