import { SiteNav } from "@/components/SiteNav";
import { FanChartClient } from "@/components/FanChartClient";
import { buildPhotoInfoMap } from "@/lib/photos";
import { LEWIS_LINEAGE_FOCUS_ID } from "@/lib/lewisLineageFocus";
import { buildAncestorTree, loadFamilyTree, maxAncestorRingGeneration } from "@/lib/tree";

/** Shared chart root: siblings with the same parents; ancestry is identical from either id. */
const ANCESTOR_ROOT_ID = LEWIS_LINEAGE_FOCUS_ID;
const CENTER_PEOPLE_IDS = ["I7", "I6"] as const;
/**
 * How far up we walk birth-parent links when building the ancestor tree (cycle guard only).
 * Fan chart rings are not capped separately: we render every generation present in that tree.
 */
const FAN_ANCESTOR_TREE_MAX_DEPTH = 64;

export default function ChartPage() {
  const tree = loadFamilyTree();
  const root = buildAncestorTree(tree, ANCESTOR_ROOT_ID, FAN_ANCESTOR_TREE_MAX_DEPTH);
  const fanMaxGeneration = maxAncestorRingGeneration(root);
  const photoInfos = buildPhotoInfoMap(Object.keys(tree.people));
  const centers = CENTER_PEOPLE_IDS.map((id) => tree.people[id]).filter(Boolean);

  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <SiteNav />
      <main
        id="main-content"
        tabIndex={-1}
        aria-label="Family tree"
        className="flex flex-1 flex-col items-center px-2 pb-6 pt-1 outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
      >
        <div className="w-full overflow-x-auto" style={{ maxWidth: 2400 }}>
          <FanChartClient
            root={root}
            maxAvailableGenerations={fanMaxGeneration}
            photoInfos={photoInfos}
            centers={centers}
          />
        </div>

        <p className="mt-4 max-w-xl text-center text-xs text-zinc-400">
          Top left: − / + sets how many ancestor generations are drawn (up to the depth in the tree). Click any person to open their page. Portraits appear when a photo is available.{" "}
          <a href="/chart/pedigree" className="text-sky-600 underline decoration-sky-600/40 hover:text-sky-800">
            Pedigree view
          </a>{" "}
          (expandable branches, URL state).
        </p>
      </main>
    </div>
  );
}
