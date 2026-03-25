import { SiteNav } from "./SiteNav";

export function PageShell({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <>
      <SiteNav />
      <main className="mx-auto max-w-6xl flex-1 px-4 py-8">
        <header className="mb-8 border-b border-zinc-200 pb-6">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">{title}</h1>
          {subtitle ? <p className="mt-2 text-zinc-500">{subtitle}</p> : null}
        </header>
        {children}
      </main>
      <footer className="border-t border-zinc-100 bg-zinc-50 py-6 text-center text-xs text-zinc-400">
        Family history archive — built from the vault
      </footer>
    </>
  );
}
