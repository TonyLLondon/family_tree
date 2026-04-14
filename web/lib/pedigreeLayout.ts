import type { FamilyTree, Person } from "@/lib/genealogy";
import { getChildren, getParents, getSiblings, getSpouses } from "@/lib/genealogy";

const CARD_W = 200;
/** Avatar row + spacer + 2×2 toolbar; foreignObject uses flex spacer so rows never overlap. */
const CARD_H = 162;
const ROW_GAP = 64;
const H_GAP = 14;
/** Horizontal gap between unrelated clusters (different couples / sibling groups). */
const CLUSTER_GAP = 44;

export type PedigreeUrlState = {
  focus: string;
  parents: Set<string>;
  children: Set<string>;
  siblings: Set<string>;
  spouses: Set<string>;
  /** Explicitly hidden cards (removed from the graph; pruned to focus-connected component). */
  dismissed: Set<string>;
  /** d3 zoom scale */
  k: number;
  /** d3 zoom translate */
  x: number;
  y: number;
};

export const DEFAULT_PEDIGREE_FOCUS = "I7";

/**
 * How many ancestor steps to open when `parents` is omitted from the URL.
 * 3 ⇒ focus + parents + grandparents + great-grandparents (when present).
 */
export const DEFAULT_PEDIGREE_ANCESTOR_GENERATIONS = 3;

/**
 * Person ids to mark as “expand parents” so the visible graph includes `generations`
 * full ancestor steps above `focusId` (BFS over parent links).
 */
export function defaultParentsExpansionForFocus(
  tree: FamilyTree,
  focusId: string,
  generations: number,
): Set<string> {
  const out = new Set<string>();
  let layer = new Set<string>([focusId]);
  for (let g = 0; g < generations; g++) {
    for (const id of layer) {
      out.add(id);
    }
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

export function parsePedigreeSearchParams(searchParams: URLSearchParams, tree: FamilyTree): PedigreeUrlState {
  let focus = searchParams.get("focus")?.trim() || DEFAULT_PEDIGREE_FOCUS;
  if (!tree.people[focus]) focus = DEFAULT_PEDIGREE_FOCUS;

  const splitCsv = (key: string) =>
    new Set(
      (searchParams.get(key) ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter((id) => id.length > 0 && tree.people[id]),
    );

  const kRaw = parseFloat(searchParams.get("k") ?? "");
  const xRaw = parseFloat(searchParams.get("x") ?? "");
  const yRaw = parseFloat(searchParams.get("y") ?? "");
  const k = !Number.isFinite(kRaw) || kRaw < 0.15 || kRaw > 24 ? 1 : kRaw;
  const x = !Number.isFinite(xRaw) ? 0 : xRaw;
  const y = !Number.isFinite(yRaw) ? 0 : yRaw;

  const parents = searchParams.has("parents")
    ? splitCsv("parents")
    : defaultParentsExpansionForFocus(tree, focus, DEFAULT_PEDIGREE_ANCESTOR_GENERATIONS);

  const dismissed = splitCsv("dismissed");
  dismissed.delete(focus);

  return {
    focus,
    parents,
    children: splitCsv("children"),
    siblings: splitCsv("siblings"),
    spouses: splitCsv("spouses"),
    dismissed,
    k,
    x,
    y,
  };
}

export function serializePedigreeSearchParams(state: PedigreeUrlState): string {
  const p = new URLSearchParams();
  p.set("focus", state.focus);
  const dis = [...state.dismissed].sort().join(",");
  if (dis) p.set("dismissed", dis);
  const sp = [...state.spouses].sort().join(",");
  if (sp) p.set("spouses", sp);
  const ch = [...state.children].sort().join(",");
  if (ch) p.set("children", ch);
  const sib = [...state.siblings].sort().join(",");
  if (sib) p.set("siblings", sib);
  const par = [...state.parents].sort().join(",");
  if (par) p.set("parents", par);
  const nearK = Math.abs(state.k - 1) < 0.0005;
  const nearO = Math.abs(state.x) < 0.02 && Math.abs(state.y) < 0.02;
  if (!nearK || !nearO) {
    p.set("k", state.k.toFixed(3));
    /** Match anchored pan math (avoid rounding drift across repeated toggles). */
    p.set("x", state.x.toFixed(2));
    p.set("y", state.y.toFixed(2));
  }
  return p.toString();
}

export function clonePedigreeUrlState(s: PedigreeUrlState): PedigreeUrlState {
  return {
    focus: s.focus,
    parents: new Set(s.parents),
    children: new Set(s.children),
    siblings: new Set(s.siblings),
    spouses: new Set(s.spouses),
    dismissed: new Set(s.dismissed),
    k: s.k,
    x: s.x,
    y: s.y,
  };
}

/** Keep only people reachable from `focusId` using parent / child / sibling / spouse edges within `visible`. */
function pruneVisibleToFocusComponent(tree: FamilyTree, visible: Set<string>, focusId: string): Set<string> {
  const keep = new Set<string>();
  const stack: string[] = [focusId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (!visible.has(id) || keep.has(id)) continue;
    keep.add(id);
    const [f, m] = getParents(tree, id);
    for (const pa of [f, m]) {
      if (pa && visible.has(pa.id)) stack.push(pa.id);
    }
    for (const c of getChildren(tree, id)) {
      if (visible.has(c.id)) stack.push(c.id);
    }
    for (const s of getSiblings(tree, id)) {
      if (visible.has(s.id)) stack.push(s.id);
    }
    for (const sp of getSpouses(tree, id)) {
      if (visible.has(sp.id)) stack.push(sp.id);
    }
  }
  return keep;
}

/** Transitive visible set from focus + expansion toggles, minus dismissed, then focus-connected prune. */
export function computeVisiblePeople(
  tree: FamilyTree,
  focusId: string,
  parents: Set<string>,
  children: Set<string>,
  siblings: Set<string>,
  spouses: Set<string>,
  dismissed: Set<string>,
): Set<string> {
  const visible = new Set<string>();
  if (!tree.people[focusId]) return visible;

  let changed = true;
  visible.add(focusId);
  while (changed) {
    changed = false;
    for (const id of [...visible]) {
      if (parents.has(id)) {
        const [f, m] = getParents(tree, id);
        for (const pa of [f, m]) {
          if (pa && !visible.has(pa.id)) {
            visible.add(pa.id);
            changed = true;
          }
        }
      }
      if (children.has(id)) {
        for (const c of getChildren(tree, id)) {
          if (!visible.has(c.id)) {
            visible.add(c.id);
            changed = true;
          }
        }
      }
      if (siblings.has(id)) {
        for (const s of getSiblings(tree, id)) {
          if (!visible.has(s.id)) {
            visible.add(s.id);
            changed = true;
          }
        }
      }
      if (spouses.has(id)) {
        for (const sp of getSpouses(tree, id)) {
          if (!visible.has(sp.id)) {
            visible.add(sp.id);
            changed = true;
          }
        }
      }
    }
  }

  for (const id of dismissed) {
    if (id !== focusId) visible.delete(id);
  }
  if (!visible.has(focusId)) visible.add(focusId);

  return pruneVisibleToFocusComponent(tree, visible, focusId);
}

export type PedigreeScene = {
  nodes: PedigreeNodeLayout[];
  edges: PedigreeEdge[];
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  ox: number;
  oy: number;
  visible: Set<string>;
};

/**
 * Single pipeline for “what the chart renders”: visibility → depths → layout → framing offset.
 * Call this for URL state and for anchored camera math so they cannot drift apart.
 */
export function buildPedigreeScene(
  tree: FamilyTree,
  state: Pick<PedigreeUrlState, "focus" | "parents" | "children" | "siblings" | "spouses" | "dismissed">,
  viewW: number,
  viewH: number,
  pad: number,
): PedigreeScene {
  const visible = computeVisiblePeople(
    tree,
    state.focus,
    state.parents,
    state.children,
    state.siblings,
    state.spouses,
    state.dismissed,
  );
  const depth = assignDepths(tree, visible, state.focus);
  const layout = layoutPedigree(tree, visible, depth);
  const { minX, maxX, minY, maxY } = layout.bounds;
  const bw = maxX - minX + pad * 2;
  const bh = maxY - minY + pad * 2;
  const ox = (viewW - bw) / 2 - minX + pad;
  const oy = pad - minY;
  return { ...layout, ox, oy, visible };
}

/** Card centre in the coordinate system inside `#pedigree-zoom-root` (before d3 translate/scale). */
export function pedigreeCardCenterInZoomRoot(
  scene: PedigreeScene,
  personId: string,
): { x: number; y: number } | null {
  const node = scene.nodes.find((n) => n.id === personId);
  if (!node) return null;
  return { x: scene.ox + node.x + CARD_W / 2, y: scene.oy + node.y + CARD_H / 2 };
}

/**
 * Apply `next` branch/dismiss state while keeping scale `k` and adjusting `x`/`y` so `anchorId`’s card centre
 * stays fixed in SVG viewBox space (d3: x_screen = x_world * k + tx). If the anchor vanishes, uses focus.
 */
export function anchoredPedigreePan(
  tree: FamilyTree,
  current: PedigreeUrlState,
  next: PedigreeUrlState,
  anchorId: string,
  viewW: number,
  viewH: number,
  pad: number,
): PedigreeUrlState {
  const k = current.k;
  const tx0 = current.x;
  const ty0 = current.y;

  const scene0 = buildPedigreeScene(tree, current, viewW, viewH, pad);
  const w0 = pedigreeCardCenterInZoomRoot(scene0, anchorId);
  if (!w0) {
    return { ...next, k, x: tx0, y: ty0 };
  }
  const sx = w0.x * k + tx0;
  const sy = w0.y * k + ty0;

  const scene1 = buildPedigreeScene(tree, next, viewW, viewH, pad);
  let w1 = pedigreeCardCenterInZoomRoot(scene1, anchorId);
  if (!w1) w1 = pedigreeCardCenterInZoomRoot(scene1, next.focus);
  if (!w1) {
    return { ...next, k, x: tx0, y: ty0 };
  }
  return {
    ...next,
    k,
    x: sx - w1.x * k,
    y: sy - w1.y * k,
  };
}

/**
 * Pan/zoom only: centre this person’s card in the viewport. Does not change `focus` or branch toggles.
 * Uses the same world space as d3 (`#pedigree-zoom-root` content).
 */
export function recenterPedigreeCameraOnPerson(
  tree: FamilyTree,
  state: PedigreeUrlState,
  personId: string,
  viewW: number,
  viewH: number,
  pad: number,
): PedigreeUrlState {
  const next = clonePedigreeUrlState(state);
  const scene = buildPedigreeScene(tree, next, viewW, viewH, pad);
  const c = pedigreeCardCenterInZoomRoot(scene, personId);
  if (!c) return next;
  const k = next.k;
  next.x = viewW / 2 - c.x * k;
  next.y = viewH / 2 - c.y * k;
  return next;
}

/** Constraint relaxation for pedigree rows (ancestors negative, ego 0, descendants positive). */
export function assignDepths(tree: FamilyTree, visible: Set<string>, focusId: string): Map<string, number> {
  const depth = new Map<string, number>();
  if (!visible.has(focusId)) return depth;
  depth.set(focusId, 0);

  const n = visible.size;
  for (let iter = 0; iter < n + 8; iter++) {
    for (const id of visible) {
      const d = depth.get(id);
      const [f, m] = getParents(tree, id);
      if (d !== undefined) {
        if (f && visible.has(f.id)) {
          const nf = d - 1;
          if (!depth.has(f.id) || depth.get(f.id)! > nf) depth.set(f.id, nf);
        }
        if (m && visible.has(m.id)) {
          const nm = d - 1;
          if (!depth.has(m.id) || depth.get(m.id)! > nm) depth.set(m.id, nm);
        }
        for (const c of getChildren(tree, id)) {
          if (!visible.has(c.id)) continue;
          const nc = d + 1;
          if (!depth.has(c.id) || depth.get(c.id)! < nc) depth.set(c.id, nc);
        }
        for (const sp of getSpouses(tree, id)) {
          if (!visible.has(sp.id)) continue;
          const dsp = depth.get(sp.id);
          if (dsp === undefined) depth.set(sp.id, d);
          else if (dsp !== d) {
            const t = Math.min(d, dsp);
            depth.set(id, t);
            depth.set(sp.id, t);
          }
        }
        for (const sib of getSiblings(tree, id)) {
          if (!visible.has(sib.id)) continue;
          depth.set(sib.id, d);
        }
      }
      const d2 = depth.get(id);
      if (d2 === undefined) continue;
      if (f && visible.has(f.id)) {
        const nf = d2 - 1;
        if (!depth.has(f.id) || depth.get(f.id)! > nf) depth.set(f.id, nf);
      }
      if (m && visible.has(m.id)) {
        const nm = d2 - 1;
        if (!depth.has(m.id) || depth.get(m.id)! > nm) depth.set(m.id, nm);
      }
    }
  }
  for (const id of visible) {
    if (!depth.has(id)) depth.set(id, 0);
  }
  return depth;
}

export type PedigreeNodeLayout = {
  id: string;
  person: Person;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type PedigreeEdge = { kind: "parent-child" | "spouse"; from: string; to: string };

function yearRange(p: Person | null | undefined): string {
  if (!p) return "";
  const yRe = /\b(\d{4})\b/g;
  const by: string[] = [];
  const dy: string[] = [];
  let m: RegExpExecArray | null;
  if (p.birthDate) {
    yRe.lastIndex = 0;
    while ((m = yRe.exec(p.birthDate)) != null) by.push(m[1]!);
  }
  if (p.deathDate) {
    yRe.lastIndex = 0;
    while ((m = yRe.exec(p.deathDate)) != null) dy.push(m[1]!);
  }
  const b = by.length ? by.sort()[0] : "";
  const d = dy.length ? dy.sort().slice(-1)[0] : "";
  if (b && d) return `${b}–${d}`;
  if (b) return `b. ${b}`;
  if (d) return `d. ${d}`;
  return "";
}

/** First calendar year in `birthDate` (any 4-digit year); missing/unknown → +∞ (sort last). */
function birthYearKey(p: Person | undefined): number {
  if (!p?.birthDate) return Number.POSITIVE_INFINITY;
  const m = /\b(\d{4})\b/.exec(p.birthDate);
  return m ? parseInt(m[1]!, 10) : Number.POSITIVE_INFINITY;
}

/** Husband / male partner on the left, wife / female on the right; same-sex or unknown sex → id order. */
function orderSpousePairIds(tree: FamilyTree, idA: string, idB: string): [string, string] {
  const a = tree.people[idA];
  const b = tree.people[idB];
  if (!a || !b) return idA < idB ? [idA, idB] : [idB, idA];
  const aM = a.sex === "M";
  const bM = b.sex === "M";
  const aF = a.sex === "F";
  const bF = b.sex === "F";
  if (aM && bF) return [idA, idB];
  if (bM && aF) return [idB, idA];
  return idA < idB ? [idA, idB] : [idB, idA];
}

/** Visible birth parents of `childId` (0–2); when both shown, male left / female right for layout and fork lines. */
export function visibleParentsOfChild(tree: FamilyTree, visible: Set<string>, childId: string): Person[] {
  const [f, m] = getParents(tree, childId);
  const raw = [f, m].filter((p): p is Person => Boolean(p && visible.has(p.id)));
  if (raw.length !== 2) return raw;
  const [leftId, rightId] = orderSpousePairIds(tree, raw[0]!.id, raw[1]!.id);
  const byId = new Map(raw.map((p) => [p.id, p]));
  return [byId.get(leftId)!, byId.get(rightId)!];
}

function collectSpouseEdgesOnly(tree: FamilyTree, visible: Set<string>): PedigreeEdge[] {
  const edges: PedigreeEdge[] = [];
  const spouseSeen = new Set<string>();
  for (const id of visible) {
    for (const sp of getSpouses(tree, id)) {
      if (!visible.has(sp.id)) continue;
      const a = id < sp.id ? id : sp.id;
      const b = id < sp.id ? sp.id : id;
      const key = `${a}|${b}`;
      if (spouseSeen.has(key)) continue;
      spouseSeen.add(key);
      edges.push({ kind: "spouse", from: a, to: b });
    }
  }
  return edges;
}

class UnionFind {
  private p: Map<string, string>;
  constructor(ids: Iterable<string>) {
    this.p = new Map();
    for (const id of ids) this.p.set(id, id);
  }
  find(a: string): string {
    let x = a;
    while (this.p.get(x) !== x) x = this.p.get(x)!;
    let z = a;
    while (this.p.get(z) !== z) {
      const n = this.p.get(z)!;
      this.p.set(z, x);
      z = n;
    }
    return x;
  }
  union(a: string, b: string) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.p.set(rb, ra);
  }
  groups(): string[][] {
    const m = new Map<string, string[]>();
    for (const id of this.p.keys()) {
      const r = this.find(id);
      if (!m.has(r)) m.set(r, []);
      m.get(r)!.push(id);
    }
    for (const g of m.values()) g.sort();
    return [...m.values()].sort((a, b) => a[0]!.localeCompare(b[0]!));
  }
}

/**
 * Clusters at one depth: spouses together, and true siblings (same birth union) together.
 * Does not merge unrelated people who merely share a generation.
 */
function clustersAtDepth(
  tree: FamilyTree,
  visible: Set<string>,
  depthMap: Map<string, number>,
  d: number,
): string[][] {
  const ids = [...visible].filter((id) => depthMap.get(id) === d);
  const uf = new UnionFind(ids);
  for (const id of ids) {
    for (const sp of getSpouses(tree, id)) {
      if (visible.has(sp.id) && depthMap.get(sp.id) === d) uf.union(id, sp.id);
    }
    for (const sib of getSiblings(tree, id)) {
      if (visible.has(sib.id) && depthMap.get(sib.id) === d) uf.union(id, sib.id);
    }
  }
  return uf.groups();
}

/**
 * One row cluster (sibling ∪ spouse connected): spouse pairs stay adjacent (man left, woman right);
 * pairs and singles ordered left-to-right by birth year (earliest first).
 */
function orderPedigreeClusterAtDepth(
  tree: FamilyTree,
  cluster: string[],
  depthMap: Map<string, number>,
  d: number,
): string[] {
  const set = new Set(cluster);

  const idsSorted = [...cluster].sort((a, b) => {
    const ya = birthYearKey(tree.people[a]);
    const yb = birthYearKey(tree.people[b]);
    if (ya !== yb) return ya - yb;
    return a.localeCompare(b);
  });

  const paired = new Set<string>();
  const pairs: [string, string][] = [];

  for (const id of idsSorted) {
    if (paired.has(id)) continue;
    const p = tree.people[id];
    if (!p) continue;
    const sps = getSpouses(tree, id).filter((s) => set.has(s.id) && depthMap.get(s.id) === d);
    const sp = sps.find((s) => !paired.has(s.id));
    if (!sp) continue;
    const pr = orderSpousePairIds(tree, id, sp.id);
    pairs.push(pr);
    paired.add(pr[0]);
    paired.add(pr[1]);
  }

  type Atom = { kind: "pair"; left: string; right: string } | { kind: "single"; id: string };
  const atoms: Atom[] = [];
  for (const [left, right] of pairs) {
    atoms.push({ kind: "pair", left, right });
  }
  for (const id of cluster) {
    if (!paired.has(id)) atoms.push({ kind: "single", id });
  }

  function atomSortKey(atom: Atom): number {
    if (atom.kind === "single") return birthYearKey(tree.people[atom.id]);
    return Math.min(birthYearKey(tree.people[atom.left]), birthYearKey(tree.people[atom.right]));
  }

  atoms.sort((u, v) => {
    const ku = atomSortKey(u);
    const kv = atomSortKey(v);
    if (ku !== kv) return ku - kv;
    const idu = u.kind === "single" ? u.id : u.left;
    const idv = v.kind === "single" ? v.id : v.left;
    return idu.localeCompare(idv);
  });

  const out: string[] = [];
  for (const atom of atoms) {
    if (atom.kind === "single") out.push(atom.id);
    else {
      out.push(atom.left, atom.right);
    }
  }
  return out;
}

/**
 * Re-space one row into spouse/sibling clusters with CLUSTER_GAP between clusters
 * and H_GAP within. Preserves left-to-right cluster order from centroid hints.
 */
function finalizeRowLayout(
  tree: FamilyTree,
  visible: Set<string>,
  depthMap: Map<string, number>,
  d: number,
  xs: Map<string, number>,
  options?: { anchorFirstClusterToHints?: boolean },
) {
  const clusters = clustersAtDepth(tree, visible, depthMap, d);
  if (clusters.length === 0) return;

  clusters.sort((a, b) => {
    const ma = Math.min(...a.map((id) => xs.get(id) ?? 0));
    const mb = Math.min(...b.map((id) => xs.get(id) ?? 0));
    return ma - mb;
  });

  let trailingRight = -Infinity;
  for (const c of clusters) {
    const ordered = orderPedigreeClusterAtDepth(tree, c, depthMap, d);
    const naturalLeft = Math.min(...ordered.map((id) => xs.get(id) ?? 0));
    const start =
      trailingRight === -Infinity
        ? options?.anchorFirstClusterToHints
          ? naturalLeft
          : 0
        : trailingRight + CLUSTER_GAP;
    let x = start;
    for (let i = 0; i < ordered.length; i++) {
      const id = ordered[i]!;
      xs.set(id, x);
      x += CARD_W;
      if (i < ordered.length - 1) x += H_GAP;
    }
    const lastId = ordered[ordered.length - 1]!;
    trailingRight = (xs.get(lastId) ?? 0) + CARD_W;
  }
}

/** Spouse edges plus layout; parent→child lines are drawn separately (fork per child). */
export function layoutPedigree(
  tree: FamilyTree,
  visible: Set<string>,
  depth: Map<string, number>,
): { nodes: PedigreeNodeLayout[]; edges: PedigreeEdge[]; bounds: { minX: number; maxX: number; minY: number; maxY: number } } {
  const edges = collectSpouseEdgesOnly(tree, visible);
  const byDepth = new Map<number, string[]>();
  for (const id of visible) {
    const d = depth.get(id);
    if (d === undefined) continue;
    if (!byDepth.has(d)) byDepth.set(d, []);
    byDepth.get(d)!.push(id);
  }
  for (const arr of byDepth.values()) arr.sort();

  const depthsSorted = [...byDepth.keys()].sort((a, b) => a - b);
  const xs = new Map<string, number>();

  const bottom = depthsSorted[depthsSorted.length - 1];
  if (bottom !== undefined) {
    finalizeRowLayout(tree, visible, depth, bottom, xs);
  }

  for (let idx = depthsSorted.length - 2; idx >= 0; idx--) {
    const d = depthsSorted[idx]!;
    const childD = depthsSorted[idx + 1]!;
    const row = byDepth.get(d)!;
    const hintLists = new Map<string, number[]>();

    const pushHint = (id: string, x: number) => {
      if (!hintLists.has(id)) hintLists.set(id, []);
      hintLists.get(id)!.push(x);
    };

    for (const childId of visible) {
      if (depth.get(childId) !== childD) continue;
      const ps = visibleParentsOfChild(tree, visible, childId);
      const cc = (xs.get(childId) ?? 0) + CARD_W / 2;
      if (ps.length === 2) {
        const left = ps[0]!;
        const right = ps[1]!;
        const W = CARD_W * 2 + H_GAP;
        const leftX = cc - W / 2;
        pushHint(left.id, leftX);
        pushHint(right.id, leftX + CARD_W + H_GAP);
      } else if (ps.length === 1) {
        pushHint(ps[0]!.id, cc - CARD_W / 2);
      }
    }

    let fallback = 0;
    for (const id of row) {
      const list = hintLists.get(id);
      if (list?.length) {
        const v = list.reduce((a, b) => a + b, 0) / list.length;
        xs.set(id, v);
      } else {
        const [f, m] = getParents(tree, id);
        const parentsBelow = [f, m].filter(
          (p): p is Person => Boolean(p && visible.has(p.id) && depth.get(p.id) === d + 1),
        );
        if (parentsBelow.length) {
          const cx =
            parentsBelow.reduce((s, p) => s + (xs.get(p.id) ?? 0) + CARD_W / 2, 0) / parentsBelow.length;
          xs.set(id, cx - CARD_W / 2);
        } else {
          xs.set(id, fallback);
          fallback += CARD_W + H_GAP;
        }
      }
    }

    finalizeRowLayout(tree, visible, depth, d, xs, { anchorFirstClusterToHints: true });
  }

  const minD = depthsSorted[0] ?? 0;
  const rowH = CARD_H + ROW_GAP;
  const ys = new Map<string, number>();
  for (const id of visible) {
    const di = depth.get(id);
    if (di === undefined) continue;
    ys.set(id, (di - minD) * rowH);
  }

  const nodes: PedigreeNodeLayout[] = [];
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const id of visible) {
    const p = tree.people[id];
    if (!p) continue;
    const x = xs.get(id) ?? 0;
    const y = ys.get(id) ?? 0;
    nodes.push({ id, person: p, x, y, w: CARD_W, h: CARD_H });
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x + CARD_W);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y + CARD_H);
  }

  if (!Number.isFinite(minX)) {
    minX = 0;
    maxX = CARD_W;
    minY = 0;
    maxY = CARD_H;
  }

  return { nodes, edges, bounds: { minX, maxX, minY, maxY } };
}

export { yearRange, CARD_W, CARD_H, ROW_GAP };
