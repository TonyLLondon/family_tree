import { SiteNav } from "@/components/SiteNav";
import { FanChartClient } from "@/components/FanChartClient";
import { buildPhotoInfoMap } from "@/lib/photos";
import { buildAncestorTree, loadFamilyTree } from "@/lib/tree";

/** Shared chart root: siblings with the same parents; ancestry is identical from either id. */
const ANCESTOR_ROOT_ID = "I7";
const CENTER_PEOPLE_IDS = ["I7", "I6"] as const;
const TREE_MAX_DEPTH = 9;
const CHART_MAX_GENERATION = 7;

export default function ChartPage() {
  const tree = loadFamilyTree();
  const root = buildAncestorTree(tree, ANCESTOR_ROOT_ID, TREE_MAX_DEPTH);
  const photoInfos = buildPhotoInfoMap(Object.keys(tree.people));
  const centers = CENTER_PEOPLE_IDS.map((id) => tree.people[id]).filter(Boolean);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SiteNav />
      <main aria-label="Family tree" className="flex flex-1 flex-col items-center px-2 pb-6 pt-1">
        <div className="w-full overflow-x-auto" style={{ maxWidth: 2400 }}>
          <FanChartClient
            root={root}
            maxGeneration={CHART_MAX_GENERATION}
            photoInfos={photoInfos}
            centers={centers}
          />
        </div>

        <p className="mt-4 max-w-xl text-center text-xs text-zinc-400">
          Click any person to open their page. Portraits appear when a photo is available.
        </p>
      </main>
    </div>
  );
}
