import { notFound } from "next/navigation";
import { MarkdownContent } from "@/components/MarkdownContent";
import { PageShell } from "@/components/PageShell";
import { getSourceSegmentLists, readMarkdownFile } from "@/lib/content";
import { repoPath } from "@/lib/paths";
import fs from "fs";
import path from "path";

type Props = { params: Promise<{ slug: string[] }> };

export function generateStaticParams() {
  return getSourceSegmentLists().map((slug) => ({ slug }));
}

export default async function SourceCardPage({ params }: Props) {
  const { slug } = await params;
  if (!slug?.length) notFound();

  const rel = path.join("sources", ...slug) + ".md";
  const abs = repoPath(rel);
  if (!fs.existsSync(abs)) notFound();

  const parsed = readMarkdownFile(abs);
  const title =
    (typeof parsed.data.title === "string" && parsed.data.title) ||
    slug[slug.length - 1]!.replace(/-/g, " ");

  return (
    <PageShell title={title}>
      <article className="mx-auto max-w-prose">
        <MarkdownContent content={parsed.content} filePath={parsed.filePath} />
      </article>
    </PageShell>
  );
}
