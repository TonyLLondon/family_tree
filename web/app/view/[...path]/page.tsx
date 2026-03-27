import path from "path";
import Link from "next/link";
import { notFound } from "next/navigation";
import matter from "gray-matter";
import { enumerateViewableFiles, readVaultFileUtf8 } from "@/lib/readVaultFileForView";
import { decodeUriPathSegment } from "@/lib/vaultLinks";
import { MarkdownContent } from "@/components/MarkdownContent";
import { SiteNav } from "@/components/SiteNav";

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
      stories: "/stories",
      topics: "/topics",
    };
    const h = hubs[segments[0]!];
    return h ?? null;
  }

  return null;
}

type Props = { params: Promise<{ path: string[] }> };

export function generateStaticParams() {
  return enumerateViewableFiles().map((rel) => ({
    path: rel.split("/"),
  }));
}

export default async function FileViewPage({ params }: Props) {
  const { path: segments } = await params;
  if (!segments?.length) notFound();

  const decoded = segments.map((s) => decodeUriPathSegment(s));
  const rel = decoded.join("/");

  const raw = readVaultFileUtf8(rel);
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
    <header className="mb-8 border-b border-zinc-200 pb-5">
      <nav aria-label="Path" className="mb-3 flex flex-wrap items-baseline gap-x-0 gap-y-1 text-sm">
        {crumbs.map((seg, i) => {
          const href = getBreadcrumbHref(crumbs, i);
          const isCurrent = i === crumbs.length - 1;
          return (
            <span key={i} className="inline-flex items-baseline">
              {i > 0 && (
                <span className="mx-1.5 select-none text-zinc-300" aria-hidden>
                  /
                </span>
              )}
              {href ? (
                <Link
                  href={href}
                  className="font-medium text-sky-800 underline decoration-sky-300 decoration-2 underline-offset-2 hover:text-sky-950 hover:decoration-sky-600"
                >
                  {seg}
                </Link>
              ) : (
                <span
                  className={
                    isCurrent
                      ? "font-semibold text-zinc-950"
                      : "text-zinc-600"
                  }
                >
                  {seg}
                </span>
              )}
            </span>
          );
        })}
      </nav>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-sans text-2xl font-bold tracking-tight text-zinc-950">
          {crumbs[crumbs.length - 1]}
        </h1>
        <a
          href={rawUrl}
          className="inline-flex shrink-0 items-center justify-center rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 shadow-sm transition hover:border-zinc-400 hover:bg-zinc-50"
        >
          View raw file
        </a>
      </div>
    </header>
  );
}

function FrontmatterTable({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data);
  if (entries.length === 0) return null;

  return (
    <section
      className="mb-8 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm ring-1 ring-zinc-950/5"
      aria-label="YAML front matter"
    >
      <div className="border-b border-zinc-100 bg-zinc-50 px-4 py-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-700">
          Front matter
        </h2>
      </div>
      <table className="w-full text-sm">
        <tbody>
          {entries.map(([key, value]) => (
            <tr key={key} className="border-b border-zinc-100 last:border-0">
              <th
                scope="row"
                className="w-40 max-w-[45%] whitespace-nowrap px-4 py-2.5 text-left align-top font-mono text-xs font-semibold text-zinc-800 sm:w-48"
              >
                {key}
              </th>
              <td className="px-4 py-2.5 align-top text-zinc-900">
                <span className="wrap-break-word font-mono text-xs leading-relaxed sm:text-sm">
                  {typeof value === "object"
                    ? JSON.stringify(value, null, 2)
                    : String(value)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function corpusBundleHref(filePath: string): string | null {
  const m = filePath.match(/^sources\/corpus\/([^/]+)/);
  return m ? `/corpus/${encodeURIComponent(m[1]!)}` : null;
}

function MachineExtractNotice({ filePath }: { filePath: string }) {
  const isLikelyMachineExtract = /\/extracted\.(pdf|web)\.md$/i.test(filePath);
  if (!isLikelyMachineExtract) return null;

  const bundleHref = corpusBundleHref(filePath);

  return (
    <div className="mb-8 rounded-xl border border-amber-200/90 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-sm ring-1 ring-amber-950/5">
      <p className="m-0 font-medium leading-snug">
        This file is <strong className="font-semibold">machine-extracted</strong> from a PDF or
        web capture. OCR and layout conversion often produce broken words and stray symbols the
        extractor could not interpret. For clean reading, use the original scan or HTML in this
        evidence bundle.
      </p>
      {bundleHref ? (
        <p className="mb-0 mt-2">
          <Link
            href={bundleHref}
            className="font-semibold text-sky-800 underline decoration-sky-400 decoration-2 underline-offset-2 hover:text-sky-950"
          >
            Back to bundle file list
          </Link>
        </p>
      ) : null}
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
        <MachineExtractNotice filePath={filePath} />
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
