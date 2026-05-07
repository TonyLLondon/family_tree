"use client";

import type { AncestorNode, Person } from "@/lib/genealogy";
import type { PhotoInfo } from "@/lib/photos";
import { FanChart } from "@/components/FanChart";

export function FanChartClient({
  root,
  maxAvailableGenerations,
  photoInfos,
  centers,
}: {
  root: AncestorNode;
  maxAvailableGenerations: number;
  photoInfos: Record<string, PhotoInfo | null>;
  centers?: Person[];
}) {
  return (
    <FanChart
      root={root}
      maxAvailableGenerations={maxAvailableGenerations}
      photoInfos={photoInfos}
      centers={centers}
    />
  );
}
