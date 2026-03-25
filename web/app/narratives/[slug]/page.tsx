import { notFound } from "next/navigation";
import { MarkdownContent } from "@/components/MarkdownContent";
import { PageShell } from "@/components/PageShell";
import { ScrollytellingNarrative } from "@/components/ScrollytellingNarrative";
import { getNarrativeSlugs, readMarkdownFile } from "@/lib/content";
import {
  readScrollySidecar,
  resolveScrollySteps,
  splitMarkdownSections,
} from "@/lib/scrollytelling";
import { repoPath } from "@/lib/paths";
import fs from "fs";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return getNarrativeSlugs().map((slug) => ({ slug }));
}

export default async function NarrativePage({ params }: Props) {
  const { slug } = await params;
  const abs = repoPath("narratives", `${slug}.md`);
  if (!fs.existsSync(abs)) notFound();

  const parsed = readMarkdownFile(abs);
  const sidecar = readScrollySidecar(slug);

  if (sidecar) {
    const { sections } = splitMarkdownSections(parsed.content);
    const resolvedSteps = resolveScrollySteps(sidecar);

    return (
      <ScrollytellingNarrative
        hero={sidecar.hero}
        sections={sections}
        steps={resolvedSteps}
        scrollyStepCount={sidecar.scrollyStepCount}
        filePath={parsed.filePath}
      />
    );
  }

  const title =
    (typeof parsed.data.title === "string" && parsed.data.title) ||
    slug.replace(/-/g, " ");

  return (
    <PageShell title={title}>
      <MarkdownContent content={parsed.content} filePath={parsed.filePath} />
    </PageShell>
  );
}
