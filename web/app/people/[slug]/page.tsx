import Link from "next/link";
import { notFound } from "next/navigation";
import { MarkdownContent } from "@/components/MarkdownContent";
import { ClickableImage } from "@/components/ClickableImage";
import { PageShell } from "@/components/PageShell";
import { readMarkdownFile } from "@/lib/content";
import { repoPath } from "@/lib/paths";
import { photoInfoForPerson, focalToObjectPosition } from "@/lib/photos";
import { getParents, getSpouses, getChildren, getPersonBySlug, loadFamilyTree, personSlugFromPage } from "@/lib/tree";
import type { Person } from "@/lib/tree";
import fs from "fs";
import path from "path";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  const dir = repoPath("people");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => ({ slug: path.basename(f, ".md") }));
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

export default async function PersonPage({ params }: Props) {
  const { slug } = await params;
  const abs = repoPath("people", `${slug}.md`);
  if (!fs.existsSync(abs)) notFound();

  const parsed = readMarkdownFile(abs);
  const tree = loadFamilyTree();
  const person = getPersonBySlug(tree, slug);
  const title =
    (typeof parsed.data.name === "string" && parsed.data.name) ||
    person?.displayName ||
    slug.replace(/-/g, " ");
  const treeId = typeof parsed.data.treeId === "string" ? parsed.data.treeId : person?.id;
  const pInfo = treeId ? photoInfoForPerson(treeId) : null;
  const photo = pInfo?.url ?? null;
  const photoPos = pInfo ? focalToObjectPosition(pInfo.focal) : undefined;
  const [father, mother] = treeId ? getParents(tree, treeId) : [null, null];
  const spouses = treeId ? getSpouses(tree, treeId) : [];
  const children = treeId ? getChildren(tree, treeId) : [];

  const fatherSlug = father ? personSlugFromPage(father.personPage) : null;
  const motherSlug = mother ? personSlugFromPage(mother.personPage) : null;

  return (
    <PageShell title={title} subtitle={treeId ? `Tree id ${treeId}` : "Not linked in family-tree.json"}>
      <div className="mb-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_240px]">
        <MarkdownContent content={parsed.content} filePath={parsed.filePath} />
        <aside className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4 text-sm">
          {photo ? (
            <ClickableImage src={photo} alt={title} className="w-full rounded-lg border border-zinc-200 object-cover" style={photoPos ? { objectPosition: photoPos } : undefined} />
          ) : null}

          {person ? (
            <dl className="space-y-2">
              {person.birthDate ? (
                <>
                  <dt className="font-medium text-zinc-500">Born</dt>
                  <dd>{person.birthDate}{person.birthPlace ? ` · ${person.birthPlace}` : ""}</dd>
                </>
              ) : null}
              {person.deathDate ? (
                <>
                  <dt className="font-medium text-zinc-500">Died</dt>
                  <dd>{person.deathDate}{person.deathPlace ? ` · ${person.deathPlace}` : ""}</dd>
                </>
              ) : null}
            </dl>
          ) : null}

          {(father || mother) && (
            <div>
              <p className="mb-1.5 font-medium text-zinc-500">Parents</p>
              <ul className="space-y-1">
                {father && (
                  <li>{fatherSlug ? <Link href={`/people/${fatherSlug}`} className="text-sky-700 hover:underline">{father.displayName}</Link> : <span className="text-zinc-400">{father.displayName ?? "Unknown"}</span>}</li>
                )}
                {mother && (
                  <li>{motherSlug ? <Link href={`/people/${motherSlug}`} className="text-sky-700 hover:underline">{mother.displayName}</Link> : <span className="text-zinc-400">{mother.displayName ?? "Unknown"}</span>}</li>
                )}
              </ul>
            </div>
          )}

          {spouses.length > 0 && (
            <div>
              <p className="mb-1.5 font-medium text-zinc-500">{spouses.length === 1 ? "Spouse" : "Spouses"}</p>
              <ul className="space-y-1">
                {spouses.map((s) => <li key={s.id}><PersonLink person={s} /></li>)}
              </ul>
            </div>
          )}

          {children.length > 0 && (
            <div>
              <p className="mb-1.5 font-medium text-zinc-500">Children</p>
              <ul className="space-y-1">
                {children.map((c) => <li key={c.id}><PersonLink person={c} /></li>)}
              </ul>
            </div>
          )}

          <div className="flex flex-col gap-2 border-t border-zinc-100 pt-3">
            <Link href="/chart" className="text-sky-700 hover:underline">Ancestor chart</Link>
            <Link href="/people" className="text-sky-700 hover:underline">All people</Link>
          </div>
        </aside>
      </div>
    </PageShell>
  );
}
