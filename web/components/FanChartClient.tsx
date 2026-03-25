"use client";

import type { AncestorNode, Person } from "@/lib/genealogy";
import type { PhotoInfo } from "@/lib/photos";
import { FanChart } from "@/components/FanChart";

export function FanChartClient({
  root,
  maxGeneration,
  photoInfos,
  centers,
}: {
  root: AncestorNode;
  maxGeneration: number;
  photoInfos: Record<string, PhotoInfo | null>;
  centers?: Person[];
}) {
  return <FanChart root={root} maxGeneration={maxGeneration} photoInfos={photoInfos} centers={centers} />;
}
