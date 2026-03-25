"use client";

import type { AncestorNode, Person } from "@/lib/genealogy";
import { FanChart } from "@/components/FanChart";

export function FanChartClient({
  root,
  maxGeneration,
  photoUrls,
  centers,
}: {
  root: AncestorNode;
  maxGeneration: number;
  photoUrls: Record<string, string | null>;
  centers?: Person[];
}) {
  return <FanChart root={root} maxGeneration={maxGeneration} photoUrls={photoUrls} centers={centers} />;
}
