import Link from "next/link";
import { SiteNav } from "@/components/SiteNav";
import { FamilyMapLoader } from "@/components/FamilyMapLoader";
import { loadFamilyTree } from "@/lib/tree";
import { buildMapData } from "@/lib/geo";

export const metadata = {
  title: "Map – The Lewis Line",
  description:
    "Birthplaces, death places, and burial sites for direct ancestors of the Lewis chart root (collateral relatives excluded).",
};

export default function MapPage() {
  const tree = loadFamilyTree();
  const data = buildMapData(tree);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SiteNav />
      <main className="flex flex-1 flex-col">
        <div className="flex items-center gap-4 border-b border-zinc-100 bg-white px-4 py-1.5 text-xs">
          <Link
            href="/map/london"
            className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 font-medium text-sky-700 transition hover:bg-sky-100"
          >
            London street map &rarr;
          </Link>
          <span className="text-zinc-400">
            Islington, Clerkenwell &amp; Holloway addresses 1851&ndash;1926
          </span>
        </div>
        <FamilyMapLoader data={data} />
      </main>
    </div>
  );
}
