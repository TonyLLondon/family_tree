import { notFound } from "next/navigation";
import { MarkdownContent } from "@/components/MarkdownContent";
import { PageShell } from "@/components/PageShell";
import {
  getResearchSegmentLists,
  readMarkdownFile,
  resolveTitleAndMarkdownBody,
} from "@/lib/content";
import { repoPath } from "@/lib/paths";
import fs from "fs";
import path from "path";

type Props = { params: Promise<{ slug: string[] }> };

export function generateStaticParams() {
  return getResearchSegmentLists().map((slug) => ({ slug }));
}

export default async function ResearchPage({ params }: Props) {
  const { slug } = await params;
  if (!slug?.length) notFound();
  const rel = path.join("research", ...slug) + ".md";
  const abs = repoPath(rel);
  if (!fs.existsSync(abs)) notFound();

  const parsed = readMarkdownFile(abs);
  const { title, content } = resolveTitleAndMarkdownBody(
    parsed.data,
    parsed.content,
    slug.join(" / ").replace(/-/g, " "),
  );

  return (
    <PageShell title={title}>
      <article className="mx-auto min-w-0 max-w-prose">
        <MarkdownContent content={content} filePath={parsed.filePath} />
      </article>
    </PageShell>
  );
}
