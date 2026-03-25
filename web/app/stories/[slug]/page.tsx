import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MarkdownContent } from "@/components/MarkdownContent";
import { PageShell } from "@/components/PageShell";
import { ScrollytellingNarrative } from "@/components/ScrollytellingNarrative";
import { getStorySlugs, readMarkdownFile } from "@/lib/content";
import {
  readScrollySidecar,
  resolveScrollySteps,
  splitMarkdownSections,
} from "@/lib/scrollytelling";
import { repoPath } from "@/lib/paths";
import fs from "fs";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return getStorySlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const sidecar = readScrollySidecar(slug);

  if (sidecar) {
    const resolved = resolveScrollySteps(sidecar);
    const heroSrc = resolved[0]?.media.src;

    return {
      title: sidecar.hero.title,
      description: sidecar.hero.subtitle,
      openGraph: {
        title: sidecar.hero.title,
        description: sidecar.hero.subtitle,
        ...(heroSrc ? { images: [heroSrc] } : {}),
      },
    };
  }

  const abs = repoPath("stories", `${slug}.md`);
  if (!fs.existsSync(abs)) return {};

  const parsed = readMarkdownFile(abs);
  const title =
    (typeof parsed.data.title === "string" && parsed.data.title) ||
    slug.replace(/-/g, " ");

  return { title };
}

export default async function StoryPage({ params }: Props) {
  const { slug } = await params;
  const abs = repoPath("stories", `${slug}.md`);
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
