import path from "path";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import matter from "gray-matter";
import { readVaultFileUtf8ForView } from "@/lib/readVaultFileForView";
import { decodeUriPathSegment } from "@/lib/vaultLinks";
import { MarkdownContent } from "@/components/MarkdownContent";
import { SiteNav } from "@/components/SiteNav";

/** Parent segments → first-party list/hub routes (never implemented as <a> in the original header). */
function getBreadcrumbHref(segments: string[], index: number): string | null {
  if (index >= segments.length - 1) return null;

  const prefix = segments.slice(0, index + 1).join("/");

  if (prefix === "sources") return "/sources";
  if (prefix === "sources/corpus") return "/corpus";
  if (prefix.startsWith("sources/corpus/")) {
    const bundleSlug = prefix.slice("sources/corpus/".length).split("/")[0]!;
    return `/corpus/${encodeURIComponent(bundleSlug)}`;
  }

  if (segments[0] === "sources") {
    const rest = segments.slice(1, index + 1);
    return `/sources/${rest.map(encodeURIComponent).join("/")}`;
  }

  if (index === 0) {
    const hubs: Record<string, string> = {
      people: "/people",
      lines: "/lines",
      stories: "/stories",
      topics: "/topics",
    };
    const h = hubs[segments[0]!];
    return h ?? null;
  }

  return null;
}

type Props = { params: Promise<{ path: string[] }> };

export default async function FileViewPage({ params }: Props) {
  const { path: segments } = await params;
  if (!segments?.length) notFound();

  const decoded = segments.map((s) => decodeUriPathSegment(s));
  const rel = decoded.join("/");

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  const selfOrigin = host ? `${proto}://${host}` : undefined;

  const raw = await readVaultFileUtf8ForView(rel, selfOrigin);
  if (raw === null) notFound();

  const ext = path.extname(rel).toLowerCase();
  const rawUrl = `/files/${decoded.map(encodeURIComponent).join("/")}?raw`;

  if (ext === ".md") {
    return <MarkdownView raw={raw} filePath={rel} rawUrl={rawUrl} />;
  }

  return <YamlView raw={raw} filePath={rel} rawUrl={rawUrl} />;
}

function FileHeader({
  filePath,
  rawUrl,
}: {
  filePath: string;
  rawUrl: string;
}) {
  const crumbs = filePath.split("/");
  return (
    <header className="mb-6 border-b border-zinc-200 pb-4 dark:border-zinc-700">
      <nav className="mb-2 flex flex-wrap items-center gap-1 text-sm text-zinc-400">
        {crumbs.map((seg, i) => {
          const href = getBreadcrumbHref(crumbs, i);
          const isCurrent = i === crumbs.length - 1;
          return (
            <span key={i} className="inline-flex items-center">
              {i > 0 && <span className="mx-1">/</span>}
              {href ? (
                <Link
                  href={href}
                  className="text-zinc-500 hover:text-zinc-800 hover:underline dark:text-zinc-400 dark:hover:text-zinc-200"
                >
                  {seg}
                </Link>
              ) : (
                <span className={isCurrent ? "text-zinc-700 font-medium dark:text-zinc-200" : ""}>{seg}</span>
              )}
            </span>
          );
        })}
      </nav>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          {crumbs[crumbs.length - 1]}
        </h1>
        <a
          href={rawUrl}
          className="rounded border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-500 transition hover:bg-zinc-50 hover:text-zinc-700 dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        >
          Raw
        </a>
      </div>
    </header>
  );
}

function FrontmatterTable({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data);
  if (entries.length === 0) return null;

  return (
    <div className="mb-6 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50/50 dark:border-zinc-700 dark:bg-zinc-900/50">
      <table className="w-full text-sm">
        <tbody>
          {entries.map(([key, value]) => (
            <tr key={key} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
              <td className="whitespace-nowrap px-4 py-2 font-mono text-xs font-medium text-zinc-500 dark:text-zinc-400">
                {key}
              </td>
              <td className="px-4 py-2 text-zinc-700 dark:text-zinc-200">
                {typeof value === "object"
                  ? JSON.stringify(value, null, 2)
                  : String(value)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MarkdownView({
  raw,
  filePath,
  rawUrl,
}: {
  raw: string;
  filePath: string;
  rawUrl: string;
}) {
  const { data, content } = matter(raw);
  const hasFrontmatter = Object.keys(data).length > 0;

  return (
    <>
      <SiteNav />
      <main className="mx-auto max-w-6xl flex-1 px-4 py-8">
        <FileHeader filePath={filePath} rawUrl={rawUrl} />
        {hasFrontmatter && <FrontmatterTable data={data} />}
        <MarkdownContent content={content} filePath={filePath} />
      </main>
    </>
  );
}

function YamlView({
  raw,
  filePath,
  rawUrl,
}: {
  raw: string;
  filePath: string;
  rawUrl: string;
}) {
  return (
    <>
      <SiteNav />
      <main className="mx-auto max-w-6xl flex-1 px-4 py-8">
        <FileHeader filePath={filePath} rawUrl={rawUrl} />
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900">
          <pre className="p-4 text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
            <code>{raw}</code>
          </pre>
        </div>
      </main>
    </>
  );
}
