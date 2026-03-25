import { SiteNav } from "@/components/SiteNav";
import { FamilyMapLoader } from "@/components/FamilyMapLoader";
import { loadFamilyTree } from "@/lib/tree";
import { buildMapData } from "@/lib/geo";

export const metadata = {
  title: "Map – Family history",
  description: "Birthplaces, death places, and burial sites across the family tree.",
};

export default function MapPage() {
  const tree = loadFamilyTree();
  const data = buildMapData(tree);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SiteNav />
      <main className="flex flex-1 flex-col">
        <FamilyMapLoader data={data} />
      </main>
    </div>
  );
}
