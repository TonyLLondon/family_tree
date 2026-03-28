"use client";

import { useState, useEffect } from "react";
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
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className="flex w-full items-center justify-center rounded-lg border border-zinc-200 bg-zinc-100/40"
           style={{ minHeight: "min(88vh, 1680px)" }}>
        <span className="text-sm text-zinc-400">Loading chart…</span>
      </div>
    );
  }

  return <FanChart root={root} maxGeneration={maxGeneration} photoInfos={photoInfos} centers={centers} />;
}
