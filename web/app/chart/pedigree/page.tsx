import { Suspense } from "react";
import { SiteNav } from "@/components/SiteNav";
import { PedigreeChart } from "@/components/PedigreeChart";
import { loadFamilyTree } from "@/lib/tree";
import { buildPhotoInfoMap } from "@/lib/photos";

export const metadata = {
  title: "Pedigree tree",
  description:
    "Traditional expandable pedigree: parents, children, siblings, and spouses with URL state for pan and zoom.",
};

export default function PedigreePage() {
  const tree = loadFamilyTree();
  const photoInfos = buildPhotoInfoMap(Object.keys(tree.people));

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SiteNav />
      <main className="mx-auto flex w-full max-w-[1800px] flex-1 flex-col px-2 pb-6 pt-1">
        <Suspense
          fallback={<div className="flex flex-1 items-center justify-center py-24 text-sm text-zinc-500">Loading…</div>}
        >
          <PedigreeChart tree={tree} photoInfos={photoInfos} />
        </Suspense>
      </main>
    </div>
  );
}
