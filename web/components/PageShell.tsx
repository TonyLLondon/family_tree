import { SiteNav } from "./SiteNav";

export function PageShell({
  children,
  title,
  subtitle,
  hideHeader,
}: {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  hideHeader?: boolean;
}) {
  return (
    <>
      <SiteNav />
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto min-w-0 max-w-6xl flex-1 px-4 py-8 outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
      >
        {!hideHeader && (
          <header className="mb-8 border-b border-zinc-200 pb-6">
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900">{title}</h1>
            {subtitle ? <p className="mt-2 text-zinc-500">{subtitle}</p> : null}
          </header>
        )}
        {children}
      </main>
      <footer className="border-t border-zinc-200/60 bg-zinc-50 py-8 text-center">
        <p className="font-serif text-sm text-zinc-400">
          Lewis · Evans · Zerauschek · Cerpa
        </p>
      </footer>
    </>
  );
}
