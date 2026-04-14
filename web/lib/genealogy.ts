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
  burialPlace?: string;
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

/** Other children of the same birth union (same parents), excluding `personId`. */
export function getSiblings(tree: FamilyTree, personId: string): Person[] {
  const p = tree.people[personId];
  if (!p?.birthUnionId) return [];
  const u = tree.unions[p.birthUnionId];
  if (!u?.childIds?.length) return [];
  const out: Person[] = [];
  for (const cid of u.childIds) {
    if (cid === personId) continue;
    const c = tree.people[cid];
    if (c) out.push(c);
  }
  return out;
}

export type AncestorNode = {
  id: string;
  person: Person | null;
  father: AncestorNode | null;
  mother: AncestorNode | null;
};

export function getGenerationCount(tree: FamilyTree): number {
  const gen = new Map<string, number>();
  const roots = Object.keys(tree.people).filter((id) => {
    const p = tree.people[id];
    return !p.birthUnionId || !(p.birthUnionId in tree.unions);
  });
  const queue = roots.map((id) => {
    gen.set(id, 0);
    return id;
  });
  let head = 0;
  while (head < queue.length) {
    const pid = queue[head++];
    const p = tree.people[pid];
    for (const uid of p.spouseUnionIds ?? []) {
      const u = tree.unions[uid];
      if (!u) continue;
      for (const cid of u.childIds ?? []) {
        if (!gen.has(cid)) {
          gen.set(cid, gen.get(pid)! + 1);
          queue.push(cid);
        }
      }
    }
  }
  let max = 0;
  gen.forEach((v) => { if (v > max) max = v; });
  return max + 1;
}

export function getYearSpan(tree: FamilyTree): number {
  let min = Infinity;
  let max = -Infinity;
  const yearRe = /\b(\d{4})\b/;
  for (const p of Object.values(tree.people)) {
    for (const d of [p.birthDate, p.deathDate]) {
      if (!d) continue;
      const m = yearRe.exec(d);
      if (m) {
        const y = parseInt(m[1], 10);
        if (y < min) min = y;
        if (y > max) max = y;
      }
    }
  }
  if (!isFinite(min) || !isFinite(max)) return 0;
  const raw = max - min;
  return Math.round(raw / 100) * 100;
}

/**
 * The current focus plus every strict ancestor via birth parents only (walk upward).
 * Does not include siblings, descendants, spouses who are not on that chain, etc.
 */
export function collectDirectAncestorIds(tree: FamilyTree, focusId: string): Set<string> {
  const out = new Set<string>();
  let layer = new Set<string>();
  if (tree.people[focusId]) layer.add(focusId);
  while (layer.size > 0) {
    for (const id of layer) out.add(id);
    const next = new Set<string>();
    for (const id of layer) {
      const [f, m] = getParents(tree, id);
      if (f) next.add(f.id);
      if (m) next.add(m.id);
    }
    layer = next;
  }
  return out;
}

/**
 * Among `ancestorId`'s children, the one who lies on the strict birth line toward `focusId`
 * (i.e. is in collectDirectAncestorIds(focusId)). When the card is the focused person
 * (`ancestorId === focusId`), `lineSubjectId` supplies whose descendant line to follow
 * (e.g. default pedigree subject); otherwise that parameter is ignored.
 */
export function lineageChildTowardFocus(
  tree: FamilyTree,
  ancestorId: string,
  focusId: string,
  lineSubjectId?: string | null,
): Person | null {
  let referenceForPath = focusId;
  if (ancestorId === focusId) {
    if (!lineSubjectId || !tree.people[lineSubjectId] || lineSubjectId === ancestorId) {
      return null;
    }
    referenceForPath = lineSubjectId;
  }

  const ancestors = collectDirectAncestorIds(tree, referenceForPath);
  if (!ancestors.has(ancestorId)) return null;

  const kids = getChildren(tree, ancestorId);
  const onPath = kids.filter((c) => ancestors.has(c.id));
  if (onPath.length !== 1) return null;
  return onPath[0]!;
}

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
