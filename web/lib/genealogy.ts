export type Person = {
  id: string;
  displayName: string;
  birthUnionId?: string;
  spouseUnionIds?: string[];
  personPage?: string;
  sex?: string;
  birthDate?: string;
  deathDate?: string;
  birthPlace?: string;
  deathPlace?: string;
  alsoKnownAs?: string[];
};

export type Union = {
  id: string;
  partnerIds: string[];
  childIds: string[];
  marriageDate?: string;
};

export type FamilyTree = {
  schemaVersion: number;
  people: Record<string, Person>;
  unions: Record<string, Union>;
  graph?: { edges: { from: string; to: string; kind: string }[] };
};

export function personSlugFromPage(personPage: string | undefined): string | null {
  if (!personPage?.startsWith("people/") || !personPage.endsWith(".md")) return null;
  return personPage.slice("people/".length, -".md".length);
}

export function getPersonBySlug(tree: FamilyTree, slug: string): Person | undefined {
  const suffix = `people/${slug}.md`;
  return Object.values(tree.people).find((p) => p.personPage === suffix);
}

export function getParents(tree: FamilyTree, personId: string): [Person | null, Person | null] {
  const p = tree.people[personId];
  if (!p?.birthUnionId) return [null, null];
  const u = tree.unions[p.birthUnionId];
  if (!u?.partnerIds?.length) return [null, null];
  const [a, b] = u.partnerIds;
  return [a ? tree.people[a] ?? null : null, b ? tree.people[b] ?? null : null];
}

export function getSpouses(tree: FamilyTree, personId: string): Person[] {
  const p = tree.people[personId];
  if (!p?.spouseUnionIds?.length) return [];
  const out: Person[] = [];
  for (const uid of p.spouseUnionIds) {
    const u = tree.unions[uid];
    if (!u) continue;
    for (const pid of u.partnerIds) {
      if (pid !== personId && tree.people[pid]) out.push(tree.people[pid]);
    }
  }
  return out;
}

export function getChildren(tree: FamilyTree, personId: string): Person[] {
  const p = tree.people[personId];
  if (!p?.spouseUnionIds?.length) return [];
  const out: Person[] = [];
  const seen = new Set<string>();
  for (const uid of p.spouseUnionIds) {
    const u = tree.unions[uid];
    if (!u?.childIds) continue;
    for (const cid of u.childIds) {
      if (!seen.has(cid) && tree.people[cid]) {
        seen.add(cid);
        out.push(tree.people[cid]);
      }
    }
  }
  return out;
}

export type AncestorNode = {
  id: string;
  person: Person | null;
  father: AncestorNode | null;
  mother: AncestorNode | null;
};

export function buildAncestorTree(tree: FamilyTree, rootId: string, maxDepth: number): AncestorNode {
  function walk(id: string, depth: number): AncestorNode {
    const person = tree.people[id] ?? null;
    if (depth >= maxDepth) {
      return { id, person, father: null, mother: null };
    }
    const [f, m] = getParents(tree, id);
    return {
      id,
      person,
      father: f ? walk(f.id, depth + 1) : null,
      mother: m ? walk(m.id, depth + 1) : null,
    };
  }
  return walk(rootId, 0);
}
