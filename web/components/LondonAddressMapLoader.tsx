"use client";

import dynamic from "next/dynamic";
import type { LondonAddressData } from "@/components/LondonAddressMap";

const LondonAddressMap = dynamic(
  () =>
    import("@/components/LondonAddressMap").then((m) => m.LondonAddressMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-1 items-center justify-center text-sm text-zinc-400">
        Loading London map&hellip;
      </div>
    ),
  },
);

export function LondonAddressMapLoader({
  data,
}: {
  data: LondonAddressData;
}) {
  return <LondonAddressMap data={data} />;
}
