import Link from "next/link";
import { notFound } from "next/navigation";
import { MarkdownContent } from "@/components/MarkdownContent";
import { PageShell } from "@/components/PageShell";
import { getSourceSegmentLists, readMarkdownFile } from "@/lib/content";
import { repoPath } from "@/lib/paths";
import {
  getAllSourcePageSlugs,
  resolveSource,
  type FacsimileImage,
  type SourceBodyContent,
  type SourceSnippets,
} from "@/lib/sourceResolver";
import { getSourceBacklinks, type Backlink } from "@/lib/backlinks";
import fs from "fs";
import path from "path";

/** Remove the first `# …` heading from markdown body (the page header already shows it). */
function stripFirstH1(md: string): string {
  const lines = md.split(/\r?\n/);
  const idx = lines.findIndex((l) => /^#\s+/.test(l));
  if (idx === -1) return md;
  lines.splice(idx, 1);
  if (idx < lines.length && lines[idx]?.trim() === "") lines.splice(idx, 1);
  return lines.join("\n");
}

type Props = { params: Promise<{ slug: string[] }> };

export function generateStaticParams() {
  const unified = getAllSourcePageSlugs().map((s) => ({ slug: [s] }));

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

const KIND_BADGES: Record<string, string> = {
  pdf: "PDF",
  web: "Web capture",
  scan: "Scan",
  image: "Image",
  book: "Book",
  "book-chapter": "Book chapter",
  census: "Census",
  "parish-register": "Parish register",
  baptism: "Baptism record",
  marriage: "Marriage record",
  burial: "Burial record",
  death: "Death record",
  birth: "Birth record",
  periodical: "Periodical",
  spreadsheet: "Spreadsheet",
  doc: "Document",
  photo: "Photograph",
};

function UnifiedSourcePage({ slug }: { slug: string }) {
  const source = resolveSource(slug);
  if (!source) notFound();

  const backlinks = getSourceBacklinks(
    source.cardFilePath ? slug : null,
    source.corpusSlugs,
  );

  const kindRaw =
    source.cardFrontmatter?.kind ?? source.cardFrontmatter?.source_type;
  const kindLabel =
    typeof kindRaw === "string"
      ? KIND_BADGES[kindRaw] ?? kindRaw.charAt(0).toUpperCase() + kindRaw.slice(1)
      : null;

  return (
    <PageShell title={source.title} hideHeader>
      <article className="mx-auto max-w-4xl">
        {/* ---------------- Header ---------------- */}
        <header className="mb-8 border-b border-zinc-200 pb-6">
          {kindLabel && (
            <div className="flex flex-wrap items-start gap-2">
              <span className="inline-flex items-center rounded-md bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-700 ring-1 ring-sky-200">
                {kindLabel}
              </span>
            </div>
          )}
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-zinc-900">
            {source.title}
          </h1>
          {(source.provenance || source.pdfDownloadUrl) && (
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-500">
              {source.provenance?.webpageUrl && (
                <a
                  href={source.provenance.webpageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="underline decoration-zinc-300 hover:text-zinc-700"
                >
                  Original source
                </a>
              )}
              {source.provenance?.primaryPdfUrl && (
                <a
                  href={source.provenance.primaryPdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="underline decoration-zinc-300 hover:text-zinc-700"
                >
                  Original PDF
                </a>
              )}
              {source.pdfDownloadUrl && !source.provenance?.primaryPdfUrl && (
                <a
                  href={source.pdfDownloadUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="underline decoration-zinc-300 hover:text-zinc-700"
                >
                  Download PDF
                </a>
              )}
              {source.provenance?.fetchDate && (
                <span>Fetched {source.provenance.fetchDate}</span>
              )}
            </div>
          )}
        </header>

        {/* ---------------- Backlinks ---------------- */}
        {backlinks.length > 0 && <BacklinksSection backlinks={backlinks} />}

        {/* ---------------- Summary (citation card prose) ---------------- */}
        {source.cardContent && source.cardFilePath && (
          <section className="mb-10">
            <div className="prose prose-zinc max-w-none">
              <MarkdownContent
                content={stripFirstH1(source.cardContent)}
                filePath={source.cardFilePath}
              />
            </div>
          </section>
        )}

        {/* ---------------- Facsimile gallery ---------------- */}
        {source.facsimiles.length > 0 && (
          <FacsimileGallery facsimiles={source.facsimiles} />
        )}

        {/* ---------------- Tier C / C+ excerpts (per-hit transcription paired with page images) ---------------- */}
        {source.snippets && (
          <SnippetsSection snippets={source.snippets} />
        )}

        {/* ---------------- Transcription (original-language, e.g. Italian) ---------------- */}
        {source.original && (
          <BodySection
            body={source.original}
            heading="Transcription"
            tone="primary"
          />
        )}

        {/* ---------------- Translation (English) ---------------- */}
        {source.translation && (
          <BodySection
            body={source.translation}
            heading="Translation"
            tone="primary"
          />
        )}

        {/* ---------------- Notes, depth & cross-references (English commentary) ---------------- */}
        {source.reference && (
          <BodySection
            body={source.reference}
            heading="Context & cross-references"
            tone="secondary"
          />
        )}

        {/* ---------------- Machine extract (with warning) ---------------- */}
        {source.extract && (
          <BodySection
            body={source.extract}
            heading={source.extract.label}
            tone="secondary"
            machine
            collapsible
          />
        )}

        {/* ---------------- Empty state ---------------- */}
        {!source.cardContent &&
          !source.translation &&
          !source.original &&
          !source.reference &&
          !source.extract &&
          !source.snippets &&
          source.facsimiles.length === 0 && (
            <div className="mb-10 rounded-lg border border-dashed border-zinc-200 bg-zinc-50 px-4 py-8 text-center text-zinc-500">
              No content available for this source yet.
            </div>
          )}
      </article>
    </PageShell>
  );
}

/* ------------------------------------------------------------------ */
/*  Facsimile gallery                                                  */
/* ------------------------------------------------------------------ */

function FacsimileGallery({ facsimiles }: { facsimiles: FacsimileImage[] }) {
  return (
    <section className="mb-10">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {facsimiles.map((f) => (
          <figure
            key={f.src}
            className={
              facsimiles.length === 1
                ? "col-span-full"
                : f.primary
                  ? "col-span-full sm:col-span-2"
                  : ""
            }
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <a
              href={f.src}
              target="_blank"
              rel="noreferrer"
              className="block overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 transition hover:shadow-md"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={f.src}
                alt={f.alt}
                className="h-auto w-full object-contain"
                loading="lazy"
              />
            </a>
            {f.alt && (
              <figcaption className="mt-1.5 text-xs text-zinc-500">
                {f.alt}
              </figcaption>
            )}
          </figure>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Snippets section (Tier C / C+ — per-hit transcription + image)    */
/* ------------------------------------------------------------------ */

function SnippetsSection({ snippets }: { snippets: SourceSnippets }) {
  const headingSuffix =
    snippets.focus && snippets.focus.terms.length > 0
      ? ` · focus: ${snippets.focus.terms.map((t) => `"${t}"`).join(", ")}`
      : "";

  return (
    <section className="mb-10">
      <h2 className="mb-2 text-2xl font-bold text-zinc-900">
        Excerpts
        <span className="ml-2 text-sm font-normal text-zinc-500">
          · {snippets.hits.length}{" "}
          {snippets.hits.length === 1 ? "hit" : "hits"}
          {headingSuffix}
        </span>
      </h2>
      <p className="mb-6 text-sm text-zinc-500">
        Selective extraction from a long document. Each excerpt below is the
        portion of the page that mentions the focus term, with the rendered
        page image alongside.
      </p>

      {snippets.body && (
        <div className="prose prose-zinc mb-8 max-w-none">
          <MarkdownContent
            content={stripFirstH1(snippets.body.content)}
            filePath={snippets.body.filePath}
          />
        </div>
      )}

      {snippets.hits.length > 0 && (
        <ol className="space-y-8">
          {snippets.hits.map((h) => (
            <li
              key={h.id}
              className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
            >
              <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="rounded bg-zinc-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-zinc-600">
                  {h.id}
                </span>
                <span className="text-sm font-semibold text-zinc-800">
                  Page {h.anchorPage}
                </span>
                {h.terms.length > 0 && (
                  <span className="text-xs text-zinc-500">
                    matched: {h.terms.map((t) => `"${t}"`).join(", ")}
                  </span>
                )}
              </div>

              <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
                <div className="space-y-2">
                  {h.imageUrls.length > 0 ? (
                    h.imageUrls.map((src) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <a
                        key={src}
                        href={src}
                        target="_blank"
                        rel="noreferrer"
                        className="block overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 transition hover:shadow-md"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={src}
                          alt={`Page ${h.anchorPage} (rendered)`}
                          className="h-auto w-full object-contain"
                          loading="lazy"
                        />
                      </a>
                    ))
                  ) : (
                    <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50 px-4 py-8 text-center text-xs text-zinc-500">
                      No page image rendered yet.
                    </div>
                  )}
                </div>

                <div className="text-sm">
                  {h.preview && (
                    <p className="mb-2 italic text-zinc-600">
                      &ldquo;{h.preview}&rdquo;
                    </p>
                  )}
                  <p className="text-xs text-zinc-500">
                    Search aid only — text-layer / OCR slice. The transcription
                    above (when present) is what the agent read from the page
                    image.
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Body section (one for each of translation / original / reference) */
/* ------------------------------------------------------------------ */

function BodySection({
  body,
  heading,
  tone,
  collapsible = false,
  machine = false,
}: {
  body: SourceBodyContent;
  heading: string;
  tone: "primary" | "secondary";
  collapsible?: boolean;
  machine?: boolean;
}) {
  const inner = (
    <>
      {machine && (
        <div className="mb-6 rounded-xl border border-amber-200/90 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-sm ring-1 ring-amber-950/5">
          <p className="m-0 font-medium leading-snug">
            This content is <strong className="font-semibold">machine-extracted</strong>{" "}
            from a PDF or web capture. OCR and layout conversion often produce broken
            words and stray symbols.
          </p>
        </div>
      )}
      <div className="prose prose-zinc max-w-none">
        <MarkdownContent
          content={stripFirstH1(body.content)}
          filePath={body.filePath}
        />
      </div>
    </>
  );

  const headerClass =
    tone === "primary"
      ? "mb-4 text-2xl font-bold text-zinc-900"
      : "mb-4 text-xl font-bold text-zinc-900";

  if (collapsible) {
    return (
      <section className="mb-10">
        <details className="group rounded-xl border border-zinc-200 bg-white">
          <summary className="cursor-pointer select-none px-5 py-3 text-base font-semibold text-zinc-800 hover:text-zinc-950">
            {heading}
            {body.language && (
              <span className="ml-2 text-sm font-normal text-zinc-500">
                · {body.label}
              </span>
            )}
          </summary>
          <div className="border-t border-zinc-200 px-5 py-5">{inner}</div>
        </details>
      </section>
    );
  }

  return (
    <section className="mb-10">
      <h2 className={headerClass}>
        {heading}
        {body.language && (
          <span className="ml-2 text-sm font-normal text-zinc-500">
            · {body.label}
          </span>
        )}
      </h2>
      {inner}
    </section>
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
