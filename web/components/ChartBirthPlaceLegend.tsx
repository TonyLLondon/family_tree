import { CHART_BIRTH_PLACE_LEGEND } from "@/lib/birthPlaceChartColors";

export function ChartBirthPlaceLegend() {
  return (
    <div className="mt-2 w-full max-w-6xl px-2 sm:mt-3">
      <p className="sr-only">
        Colours match birthplace regions from the family Sun Chart (2008).
      </p>
      <ul className="columns-2 gap-x-6 text-xs sm:columns-3 md:columns-4 [&>li]:mb-2.5">
        {CHART_BIRTH_PLACE_LEGEND.map((e) => (
          <li key={e.id} className="flex items-start gap-2 break-inside-avoid">
            <span
              className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded-sm border border-zinc-300 shadow-sm"
              style={{ backgroundColor: e.color }}
              aria-hidden
            />
            <span className="leading-snug text-zinc-600">{e.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
