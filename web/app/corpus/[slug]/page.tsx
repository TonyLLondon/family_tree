import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/PageShell";
import { getCorpusSlugs } from "@/lib/content";
import { repoPath } from "@/lib/paths";
import fs from "fs";
type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return getCorpusSlugs().map((slug) => ({ slug }));
}

export default async function CorpusBundlePage({ params }: Props) {
  const { slug } = await params;
  const dir = repoPath("sources", "corpus", slug);
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) notFound();

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = entries
    .filter((e) => e.isFile())
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b));
  const subdirs = entries
    .filter((e) => e.isDirectory() && !e.name.startsWith("."))
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b));

  return (
    <PageShell title={`Corpus · ${slug}`} subtitle={`sources/corpus/${slug}/`}>
      {subdirs.length > 0 ? (
        <section className="mb-8">
          <h2 className="mb-2 text-lg font-semibold">Folders</h2>
          <ul className="list-disc pl-5 text-sm">
            {subdirs.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </section>
      ) : null}
      <section>
        <h2 className="mb-2 text-lg font-semibold">Files</h2>
        <ul className="space-y-1 text-sm">
          {files.map((name) => {
            const rel = `sources/corpus/${slug}/${name}`;
            const href = `/files/${rel.split("/").map(encodeURIComponent).join("/")}`;
            return (
              <li key={name}>
                <Link href={href} className="text-sky-700 hover:underline dark:text-sky-400">
                  {name}
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </PageShell>
  );
}
