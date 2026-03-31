import Link from "next/link";
import { notFound } from "next/navigation";
import { MarkdownContent } from "@/components/MarkdownContent";
import { PageShell } from "@/components/PageShell";
import { getSourceSegmentLists, readMarkdownFile } from "@/lib/content";
import { repoPath } from "@/lib/paths";
import { getAllSourceSlugs, resolveSource } from "@/lib/sourceResolver";
import { getSourceBacklinks, type Backlink } from "@/lib/backlinks";
import fs from "fs";
import path from "path";

type Props = { params: Promise<{ slug: string[] }> };

export function generateStaticParams() {
  const unified = getAllSourceSlugs().map((s) => ({ slug: [s] }));

  const legacy = getSourceSegmentLists()
    .filter((segs) => segs.length > 1)
    .map((slug) => ({ slug }));

  return [...unified, ...legacy];
}

export default async function SourcePage({ params }: Props) {
  const { slug } = await params;
  if (!slug?.length) notFound();

  if (slug.length === 1) {
    return <UnifiedSourcePage slug={slug[0]!} />;
  }

  return <LegacySourceCardPage segments={slug} />;
}

/* ------------------------------------------------------------------ */
/*  Unified source page (single slug)                                  */
/* ------------------------------------------------------------------ */

function UnifiedSourcePage({ slug }: { slug: string }) {
  const source = resolveSource(slug);
  if (!source) notFound();

  const backlinks = getSourceBacklinks(
    source.cardFilePath ? slug : null,
    source.corpusSlugs,
  );

  const kindLabels: Record<string, string> = {
    pdf: "PDF",
    web: "Web capture",
    scan: "Scan",
    image: "Image",
    book: "Book",
    "book-chapter": "Book chapter",
    census: "Census",
    "parish-register": "Parish register",
    baptism: "Baptism record",
    periodical: "Periodical",
    spreadsheet: "Spreadsheet",
    doc: "Document",
    photo: "Photograph",
  };

  const kind =
    source.cardFrontmatter?.kind ??
    source.cardFrontmatter?.source_type;
  const kindLabel =
    typeof kind === "string"
      ? kindLabels[kind] ?? kind.charAt(0).toUpperCase() + kind.slice(1)
      : null;

  return (
    <PageShell title={source.title} hideHeader>
      <article className="mx-auto max-w-4xl">
        {/* Header */}
        <header className="mb-8 border-b border-zinc-200 pb-6">
          <div className="flex flex-wrap items-start gap-2">
            {kindLabel && (
              <span className="inline-flex items-center rounded-md bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-700 ring-1 ring-sky-200">
                {kindLabel}
              </span>
            )}
            {source.hasPdf && (
              <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
                PDF available
              </span>
            )}
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-zinc-900">
            {source.title}
          </h1>
          {source.provenance && (
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-500">
              {source.provenance.webpageUrl && (
                <a
                  href={source.provenance.webpageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="underline decoration-zinc-300 hover:text-zinc-700"
                >
                  Original source
                </a>
              )}
              {source.provenance.primaryPdfUrl && (
                <a
                  href={source.provenance.primaryPdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="underline decoration-zinc-300 hover:text-zinc-700"
                >
                  Original PDF
                </a>
              )}
              {source.provenance.fetchDate && (
                <span>Fetched {source.provenance.fetchDate}</span>
              )}
            </div>
          )}
        </header>

        {/* PDF download */}
        {source.hasPdf && source.pdfUrl && (
          <div className="mb-8 flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="flex-none text-red-500" aria-hidden>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M14 2v6h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <text x="7" y="18" fontSize="6" fontWeight="bold" fill="currentColor">PDF</text>
            </svg>
            <div className="flex-1">
              <p className="text-sm font-medium text-zinc-800">Original document available</p>
            </div>
            <a
              href={source.pdfUrl}
              className="inline-flex items-center rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 shadow-sm transition hover:border-zinc-400 hover:bg-zinc-50"
            >
              View PDF
            </a>
          </div>
        )}

        {/* Citation card content */}
        {source.cardContent && source.cardFilePath && (
          <section className="mb-10">
            <div className="prose prose-zinc max-w-none">
              <MarkdownContent content={source.cardContent} filePath={source.cardFilePath} />
            </div>
          </section>
        )}

        {/* Corpus evidence content (only if different from card) */}
        {source.corpusContent && source.corpusContentFilePath && (
          <section className="mb-10">
            {source.cardContent && (
              <h2 className="mb-4 text-xl font-bold text-zinc-900">
                {source.corpusContentLabel ?? "Evidence"}
              </h2>
            )}
            {source.isMachineExtract && (
              <div className="mb-6 rounded-xl border border-amber-200/90 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-sm ring-1 ring-amber-950/5">
                <p className="m-0 font-medium leading-snug">
                  This content is <strong className="font-semibold">machine-extracted</strong> from
                  a PDF or web capture. OCR and layout conversion often produce broken words and
                  stray symbols. For clean reading, use the original document above.
                </p>
              </div>
            )}
            <div className="prose prose-zinc max-w-none">
              <MarkdownContent
                content={source.corpusContent}
                filePath={source.corpusContentFilePath}
              />
            </div>
          </section>
        )}

        {/* No content at all */}
        {!source.cardContent && !source.corpusContent && (
          <div className="mb-10 rounded-lg border border-dashed border-zinc-200 bg-zinc-50 px-4 py-8 text-center text-zinc-500">
            No content available for this source yet.
          </div>
        )}

        {/* Backlinks */}
        {backlinks.length > 0 && <BacklinksSection backlinks={backlinks} />}

        {/* Bundle files (collapsed) */}
        {source.primaryCorpusSlug && source.bundleFiles.length > 0 && (
          <BundleFilesSection
            slug={source.primaryCorpusSlug}
            files={source.bundleFiles}
            subdirs={source.bundleSubdirs}
          />
        )}
      </article>
    </PageShell>
  );
}

/* ------------------------------------------------------------------ */
/*  Backlinks section                                                  */
/* ------------------------------------------------------------------ */

const KIND_LABELS: Record<string, string> = {
  people: "Person",
  stories: "Story",
  topics: "Topic",
};

function BacklinksSection({ backlinks }: { backlinks: Backlink[] }) {
  return (
    <section className="mb-10">
      <h2 className="mb-4 text-lg font-bold text-zinc-900">Referenced by</h2>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {backlinks.map((bl) => (
          <Link
            key={bl.href}
            href={bl.href}
            className="group flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm transition hover:border-sky-200 hover:shadow-sm"
          >
            <span className="flex-none rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500 group-hover:bg-sky-50 group-hover:text-sky-600">
              {KIND_LABELS[bl.kind] ?? bl.kind}
            </span>
            <span className="truncate font-medium text-zinc-800 group-hover:text-sky-700">
              {bl.title}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Bundle files section (collapsed)                                   */
/* ------------------------------------------------------------------ */

function BundleFilesSection({
  slug,
  files,
  subdirs,
}: {
  slug: string;
  files: string[];
  subdirs: string[];
}) {
  return (
    <details className="group mb-10 rounded-xl border border-zinc-200 bg-zinc-50">
      <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-zinc-700 hover:text-zinc-900">
        <span className="ml-1">Bundle files</span>
        <span className="ml-2 text-xs font-normal text-zinc-400">
          sources/corpus/{slug}/
        </span>
      </summary>
      <div className="border-t border-zinc-200 px-4 py-3">
        {subdirs.length > 0 && (
          <div className="mb-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Folders
            </p>
            <ul className="list-disc pl-5 text-sm text-zinc-600">
              {subdirs.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          </div>
        )}
        <ul className="space-y-1 text-sm">
          {files.map((name) => {
            const isRenderable = /\.(md|yaml|yml)$/i.test(name);
            const rel = `sources/corpus/${slug}/${name}`;
            const href = isRenderable
              ? `/view/${rel.split("/").map(encodeURIComponent).join("/")}`
              : `/files/${rel.split("/").map(encodeURIComponent).join("/")}`;
            return (
              <li key={name}>
                <Link
                  href={href}
                  className="text-sky-700 hover:underline dark:text-sky-400"
                >
                  {name}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </details>
  );
}

/* ------------------------------------------------------------------ */
/*  Legacy multi-segment source card (fallback)                        */
/* ------------------------------------------------------------------ */

function LegacySourceCardPage({ segments }: { segments: string[] }) {
  const rel = path.join("sources", ...segments) + ".md";
  const abs = repoPath(rel);
  if (!fs.existsSync(abs)) notFound();

  const parsed = readMarkdownFile(abs);
  const title =
    (typeof parsed.data.title === "string" && parsed.data.title) ||
    segments[segments.length - 1]!.replace(/-/g, " ");

  return (
    <PageShell title={title}>
      <article className="mx-auto max-w-prose">
        <MarkdownContent content={parsed.content} filePath={parsed.filePath} />
      </article>
    </PageShell>
  );
}
