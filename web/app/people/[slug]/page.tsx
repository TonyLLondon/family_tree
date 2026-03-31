import Link from "next/link";
import { notFound } from "next/navigation";
import { MarkdownContent } from "@/components/MarkdownContent";
import { ClickableImage } from "@/components/ClickableImage";
import { PageShell } from "@/components/PageShell";
import { getPeopleSlugs, readMarkdownFile } from "@/lib/content";
import { repoPath } from "@/lib/paths";
import { photoInfoForPerson, focalToObjectPosition } from "@/lib/photos";
import { getParents, getSpouses, getChildren, getPersonBySlug, loadFamilyTree, personSlugFromPage } from "@/lib/tree";
import type { Person } from "@/lib/tree";
import fs from "fs";
import path from "path";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return getPeopleSlugs().map((slug) => ({ slug }));
}

function PersonLink({ person }: { person: Person }) {
  const slug = personSlugFromPage(person.personPage);
  if (slug) {
    return (
      <Link href={`/people/${slug}`} className="text-sky-700 hover:underline">
        {person.displayName}
      </Link>
    );
  }
  return <span className="text-zinc-600">{person.displayName}</span>;
}

type Vitals = {
  birthDate?: string;
  birthPlace?: string;
  deathDate?: string;
  deathPlace?: string;
  burialPlace?: string;
};

function vitalsFromFrontmatter(data: Record<string, unknown>): Vitals {
  const str = (v: unknown) => (typeof v === "string" ? v.trim() || undefined : typeof v === "number" ? String(v) : undefined);
  return {
    birthDate: str(data.born),
    birthPlace: str(data.birth_place),
    deathDate: str(data.died),
    deathPlace: str(data.death_place),
    burialPlace: str(data.burial),
  };
}

function mergeVitals(person: Person | undefined, fm: Vitals): Vitals {
  return {
    birthDate: person?.birthDate || fm.birthDate,
    birthPlace: person?.birthPlace || fm.birthPlace,
    deathDate: person?.deathDate || fm.deathDate,
    deathPlace: person?.deathPlace || fm.deathPlace,
    burialPlace: person?.burialPlace || fm.burialPlace,
  };
}

function VitalsLine({ vitals }: { vitals: Vitals }) {
  const parts: string[] = [];
  if (vitals.birthDate) {
    let s = `b. ${vitals.birthDate}`;
    if (vitals.birthPlace) s += `, ${vitals.birthPlace}`;
    parts.push(s);
  }
  if (vitals.deathDate) {
    let s = `d. ${vitals.deathDate}`;
    if (vitals.deathPlace) s += `, ${vitals.deathPlace}`;
    parts.push(s);
  }
  if (vitals.burialPlace) {
    parts.push(`bur. ${vitals.burialPlace}`);
  }
  if (parts.length === 0) return null;
  return <p className="text-sm text-zinc-500">{parts.join(" · ")}</p>;
}

function stripLeadingH1(md: string): string {
  return md.replace(/^\s*#\s+.+\n+/, "");
}

function FamilyLinks({
  label,
  people,
}: {
  label: string;
  people: (Person | null)[];
}) {
  const valid = people.filter((p): p is Person => p !== null);
  if (valid.length === 0) return null;
  return (
    <div>
      <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
        {label}
      </span>
      <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-sm">
        {valid.map((p) => (
          <PersonLink key={p.id} person={p} />
        ))}
      </div>
    </div>
  );
}

export default async function PersonPage({ params }: Props) {
  const { slug } = await params;
  const abs = repoPath("people", `${slug}.md`);
  if (!fs.existsSync(abs)) notFound();

  const parsed = readMarkdownFile(abs);
  if (parsed.data.published === false) notFound();
  const tree = loadFamilyTree();
  const person = getPersonBySlug(tree, slug);
  const title =
    person?.displayName ||
    (typeof parsed.data.name === "string" && parsed.data.name) ||
    slug.replace(/-/g, " ");
  const role = typeof parsed.data.role === "string" ? parsed.data.role : null;
  const treeId = typeof parsed.data.treeId === "string" ? parsed.data.treeId : person?.id;
  const pInfo = treeId ? photoInfoForPerson(treeId) : null;
  const photo = pInfo?.url ?? null;
  const photoPos = pInfo ? focalToObjectPosition(pInfo.focal) : undefined;
  const [father, mother] = treeId ? getParents(tree, treeId) : [null, null];
  const spouses = treeId ? getSpouses(tree, treeId) : [];
  const children = treeId ? getChildren(tree, treeId) : [];

  const hasFamily = father || mother || spouses.length > 0 || children.length > 0;
  const aka = person?.alsoKnownAs;
  const vitals = mergeVitals(person, vitalsFromFrontmatter(parsed.data));
  const articleContent = stripLeadingH1(parsed.content);

  return (
    <PageShell title={title} hideHeader>
      {/* Breadcrumb */}
      <nav className="mb-4 text-sm text-zinc-400" aria-label="Breadcrumb">
        <Link href="/people" className="hover:text-zinc-600 transition">
          People
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-zinc-600">{title}</span>
      </nav>

      {/* Hero card */}
      <section className="mb-10 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="flex flex-col sm:flex-row">
          {photo && (
            <div className="flex-none sm:w-52 md:w-64">
              <ClickableImage
                src={photo}
                alt={title}
                className="h-64 w-full object-cover sm:h-full sm:rounded-l-2xl"
                style={photoPos ? { objectPosition: photoPos } : undefined}
              />
            </div>
          )}

          <div className="flex min-w-0 flex-1 flex-col justify-center gap-3 p-5 sm:p-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
                {title}
              </h1>
              {aka && aka.length > 0 && (
                <p className="mt-0.5 text-sm italic text-zinc-400">
                  {aka.join(" · ")}
                </p>
              )}
              {role && (
                <p className="mt-1 text-sm font-medium text-zinc-500">{role}</p>
              )}
            </div>

            <VitalsLine vitals={vitals} />

            {hasFamily && (
              <div className="flex flex-col gap-2 border-t border-zinc-100 pt-3">
                <FamilyLinks label="Parents" people={[father, mother]} />
                <FamilyLinks
                  label={spouses.length === 1 ? "Spouse" : "Spouses"}
                  people={spouses}
                />
                <FamilyLinks label="Children" people={children} />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Article body */}
      <article className="mx-auto max-w-prose">
        <MarkdownContent content={articleContent} filePath={parsed.filePath} />
      </article>
    </PageShell>
  );
}
