import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MarkdownContent } from "@/components/MarkdownContent";
import { PageShell } from "@/components/PageShell";
import {
  StoryNarrative,
  type StoryPage,
} from "@/components/StoryNarrative";
import { getStorySlugs, readMarkdownFile } from "@/lib/content";
import {
  readScrollySidecar,
  resolveScrollySteps,
  resolveScrapbookPages,
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
    const heroSrc =
      sidecar.layout === "scrapbook" && sidecar.pages?.[0]
        ? sidecar.pages[0].image
        : sidecar.steps[0]?.media.src;

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

    let storyPages: StoryPage[];
    let pagedSections: typeof sections;
    let appendixSections: typeof sections;

    if (sidecar.layout === "scrapbook" && sidecar.pages) {
      storyPages = resolveScrapbookPages(sidecar).map((p) => ({
        media: { src: p.image, alt: p.alt },
      }));
      pagedSections = sections;
      appendixSections = [];
    } else {
      storyPages = resolveScrollySteps(sidecar).map((s) => ({
        media: s.media,
        era: s.era,
      }));
      pagedSections = sections.slice(0, sidecar.scrollyStepCount);
      appendixSections = sections.slice(sidecar.scrollyStepCount);
    }

    return (
      <StoryNarrative
        hero={sidecar.hero}
        sections={pagedSections}
        pages={storyPages}
        appendixSections={appendixSections}
        filePath={parsed.filePath}
      />
    );
  }

  const title =
    (typeof parsed.data.title === "string" && parsed.data.title) ||
    slug.replace(/-/g, " ");

  return (
    <PageShell title={title}>
      <article className="mx-auto max-w-prose">
        <MarkdownContent content={parsed.content} filePath={parsed.filePath} />
      </article>
    </PageShell>
  );
}
