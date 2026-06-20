import { SiteNav } from "@/components/SiteNav";
import { FocalEditor, type FocalItem } from "@/components/FocalEditor";
import { loadFamilyTree } from "@/lib/tree";
import { loadRawPhotoMap, photoRepoFilePublicUrl } from "@/lib/photos";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Face framing editor (dev)",
  description: "Drag to set the chart face crop for each portrait.",
};

function entrySrc(v: ReturnType<typeof loadRawPhotoMap>[string]): {
  src: string;
  focal: [number, number];
  zoom: number;
} | null {
  if (v == null) return null;
  if (typeof v === "string") return { src: v, focal: [0.5, 0.5], zoom: 1 };
  return { src: v.src, focal: v.focal ?? [0.5, 0.5], zoom: v.zoom ?? 1 };
}

export default function FocalEditorPage() {
  const tree = loadFamilyTree();
  const raw = loadRawPhotoMap();

  const items: FocalItem[] = [];
  for (const [id, entry] of Object.entries(raw)) {
    const parsed = entrySrc(entry);
    if (!parsed) continue;
    const url = photoRepoFilePublicUrl(parsed.src);
    if (!url) continue;
    items.push({
      id,
      displayName: tree.people[id]?.displayName ?? id,
      src: parsed.src,
      url,
      focal: parsed.focal,
      zoom: parsed.zoom,
    });
  }

  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <SiteNav />
      <main className="mx-auto flex w-full max-w-[1100px] flex-1 flex-col px-3 py-4">
        <FocalEditor items={items} />
      </main>
    </div>
  );
}
