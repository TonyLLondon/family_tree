import { notFound } from "next/navigation";
import { MarkdownContent } from "@/components/MarkdownContent";
import { PageShell } from "@/components/PageShell";
import { getResearchSegmentLists, readMarkdownFile } from "@/lib/content";
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
  const title =
    (typeof parsed.data.title === "string" && parsed.data.title) ||
    slug.join(" / ").replace(/-/g, " ");

  return (
    <PageShell title={title}>
      <MarkdownContent content={parsed.content} filePath={parsed.filePath} />
    </PageShell>
  );
}
