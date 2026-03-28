import Link from "next/link";
import { SiteNav } from "@/components/SiteNav";

const links = [
  { href: "/chart", label: "Family tree", desc: "7-generation fan chart" },
  { href: "/stories", label: "Stories", desc: "Long-form family essays" },
  { href: "/people", label: "People", desc: "Biographical pages" },
  { href: "/sources", label: "Sources", desc: "Citation cards & corpus" },
];

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SiteNav />

      <main className="flex flex-1 flex-col items-center justify-center px-4 py-20">
        {/* Tree mark */}
        <svg
          width="56"
          height="56"
          viewBox="0 0 32 32"
          aria-hidden="true"
          className="mb-8 text-zinc-300"
        >
          <line x1="16" y1="29" x2="16" y2="18" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          <line x1="16" y1="18" x2="10" y2="12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="16" y1="18" x2="22" y2="12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="10" y1="12" x2="6" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <line x1="10" y1="12" x2="14" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <line x1="22" y1="12" x2="18" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <line x1="22" y1="12" x2="26" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <circle cx="6" cy="5" r="2.2" fill="currentColor" opacity="0.5" />
          <circle cx="14" cy="5" r="2.2" fill="currentColor" opacity="0.5" />
          <circle cx="18" cy="5" r="2.2" fill="currentColor" opacity="0.5" />
          <circle cx="26" cy="5" r="2.2" fill="currentColor" opacity="0.5" />
        </svg>

        <h1 className="font-serif text-3xl font-bold tracking-tight text-zinc-900">
          Page not found
        </h1>
        <p className="mt-3 max-w-md text-center text-base leading-relaxed text-zinc-500">
          This branch of the tree doesn&rsquo;t exist yet — or may have been
          moved while the archive was reorganised.
        </p>

        <div className="mt-10 grid w-full max-w-lg gap-3 sm:grid-cols-2">
          {links.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group rounded-lg border border-zinc-200 bg-white px-4 py-3 text-left transition hover:border-sky-200 hover:shadow-sm"
            >
              <p className="font-semibold text-zinc-800 group-hover:text-sky-700">
                {item.label}
              </p>
              <p className="text-xs text-zinc-500">{item.desc}</p>
            </Link>
          ))}
        </div>

        <Link
          href="/"
          className="mt-8 text-sm font-medium text-sky-600 transition hover:text-sky-800"
        >
          &larr; Back to home
        </Link>
      </main>

      <footer className="border-t border-zinc-200/60 bg-zinc-50 py-8 text-center">
        <p className="font-serif text-sm text-zinc-400">
          Lewis · Evans · Zerauschek · Cerpa
        </p>
      </footer>
    </div>
  );
}
