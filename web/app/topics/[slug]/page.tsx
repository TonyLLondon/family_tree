import { notFound } from "next/navigation";
import { MarkdownContent } from "@/components/MarkdownContent";
import { PageShell } from "@/components/PageShell";
import { getTopicSlugs, readMarkdownFile, resolveTitleAndMarkdownBody } from "@/lib/content";
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
  const { title, content } = resolveTitleAndMarkdownBody(
    parsed.data,
    parsed.content,
    slug.replace(/-/g, " "),
  );

  return (
    <PageShell title={title}>
      <article className="mx-auto min-w-0 max-w-prose">
        <MarkdownContent content={content} filePath={parsed.filePath} />
      </article>
    </PageShell>
  );
}
