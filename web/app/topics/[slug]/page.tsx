import { notFound } from "next/navigation";
import { MarkdownContent } from "@/components/MarkdownContent";
import { PageShell } from "@/components/PageShell";
import { getTopicSlugs, readMarkdownFile } from "@/lib/content";
import { repoPath } from "@/lib/paths";
import fs from "fs";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return getTopicSlugs()
    .filter((s) => s !== "index")
    .map((slug) => ({ slug }));
}

export default async function TopicPage({ params }: Props) {
  const { slug } = await params;
  if (slug === "index") notFound();
  const abs = repoPath("topics", `${slug}.md`);
  if (!fs.existsSync(abs)) notFound();

  const parsed = readMarkdownFile(abs);
  const title =
    (typeof parsed.data.title === "string" && parsed.data.title) ||
    slug.replace(/-/g, " ");

  return (
    <PageShell title={title}>
      <MarkdownContent content={parsed.content} filePath={parsed.filePath} />
    </PageShell>
  );
}
