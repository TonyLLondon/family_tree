"use client";

import dynamic from "next/dynamic";
import type { MapData } from "@/lib/geo";

const FamilyMap = dynamic(
  () => import("@/components/FamilyMap").then((m) => m.FamilyMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-1 items-center justify-center text-sm text-zinc-400">
        Loading map…
      </div>
    ),
  },
);

export function FamilyMapLoader({ data }: { data: MapData }) {
  return <FamilyMap data={data} />;
}
