"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  useMap,
} from "react-leaflet";
import Link from "next/link";
import type { MapData, MapLocation, LocationType, MapCategory } from "@/lib/geo";
import "leaflet/dist/leaflet.css";

const INITIAL_CENTER: [number, number] = [46.0, 18.0];
const INITIAL_ZOOM = 4;

const LOCATION_TYPE_LABELS: Record<LocationType, string> = {
  birth: "Born",
  death: "Died",
  burial: "Buried",
  lived: "Lived",
};

const LOCATION_TYPE_ICONS: Record<LocationType, string> = {
  birth: "\u2605",
  death: "\u2020",
  burial: "\u26B0",
  lived: "\u2302",
};

function colorById(categories: MapCategory[], id: string): string {
  return categories.find((c) => c.id === id)?.color ?? "#a9a9a9";
}

function markerRadius(count: number): number {
  if (count <= 1) return 6;
  if (count <= 3) return 8;
  if (count <= 10) return 11;
  if (count <= 25) return 14;
  return 17;
}

function FitBoundsOnce({ locations }: { locations: MapLocation[] }) {
  const map = useMap();
  const fitted = useRef(false);

  useEffect(() => {
    if (fitted.current || locations.length === 0) return;
    fitted.current = true;
    const lats = locations.map((l) => l.lat);
    const lngs = locations.map((l) => l.lng);
    map.fitBounds(
      [
        [Math.min(...lats) - 2, Math.min(...lngs) - 5],
        [Math.max(...lats) + 2, Math.max(...lngs) + 5],
      ],
      { maxZoom: 6, padding: [30, 30] },
    );
  }, [map, locations]);

  return null;
}

type FilterState = {
  types: Set<LocationType>;
  categories: Set<string>;
};

export function FamilyMap({ data }: { data: MapData }) {
  const { locations, categories } = data;
  const allCategoryIds = useMemo(() => new Set(categories.map((c) => c.id)), [categories]);

  const [filters, setFilters] = useState<FilterState>({
    types: new Set<LocationType>(["birth", "death", "burial", "lived"]),
    categories: new Set(allCategoryIds),
  });

  const [legendOpen, setLegendOpen] = useState(false);

  const toggleType = useCallback((t: LocationType) => {
    setFilters((prev) => {
      const next = new Set(prev.types);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return { ...prev, types: next };
    });
  }, []);

  const toggleCategory = useCallback((id: string) => {
    setFilters((prev) => {
      const next = new Set(prev.categories);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...prev, categories: next };
    });
  }, []);

  const toggleAllCategories = useCallback(() => {
    setFilters((prev) => {
      const allOn = prev.categories.size === allCategoryIds.size;
      return { ...prev, categories: allOn ? new Set<string>() : new Set(allCategoryIds) };
    });
  }, [allCategoryIds]);

  const filtered = useMemo(() => {
    const result: (MapLocation & { filteredPeople: MapLocation["people"] })[] = [];
    for (const loc of locations) {
      if (!filters.categories.has(loc.categoryId)) continue;
      const fp = loc.people.filter((p) => filters.types.has(p.locationType));
      if (fp.length > 0) {
        result.push({ ...loc, filteredPeople: fp });
      }
    }
    return result;
  }, [locations, filters]);

  const totalPeople = useMemo(
    () => filtered.reduce((s, l) => s + l.filteredPeople.length, 0),
    [filtered],
  );

  return (
    <div className="relative flex flex-1 flex-col">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-zinc-200/80 bg-white px-4 py-2 text-sm">
        <span className="font-medium text-zinc-700">Show:</span>
        {(["birth", "death", "burial", "lived"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => toggleType(t)}
            className={`rounded-full border px-3 py-2 text-xs font-medium transition ${
              filters.types.has(t)
                ? "border-sky-600 bg-sky-50 text-sky-700"
                : "border-zinc-300 bg-zinc-50 text-zinc-400"
            }`}
          >
            {LOCATION_TYPE_ICONS[t]} {LOCATION_TYPE_LABELS[t]}
          </button>
        ))}
        <span className="ml-auto text-xs text-zinc-400">
          {filtered.length} locations &middot; {totalPeople} records
        </span>

        {/* Legend toggle (mobile) */}
        <button
          type="button"
          onClick={() => setLegendOpen((o) => !o)}
          className="rounded-md border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-600 transition hover:bg-zinc-100 active:bg-zinc-200 lg:hidden"
        >
          Legend
        </button>
      </div>

      <div className="relative flex flex-1">
        {/* Map */}
        <div className="flex-1">
          <MapContainer
            center={INITIAL_CENTER}
            zoom={INITIAL_ZOOM}
            className="h-full w-full"
            style={{ minHeight: "calc(100dvh - 110px)" }}
            scrollWheelZoom
            zoomControl
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <FitBoundsOnce locations={filtered} />
            {filtered.map((loc) => {
              const color = colorById(categories, loc.categoryId);
              const count = loc.filteredPeople.length;
              return (
                <CircleMarker
                  key={loc.place}
                  center={[loc.lat, loc.lng]}
                  radius={markerRadius(count)}
                  pathOptions={{
                    color: "#fff",
                    weight: 1.5,
                    fillColor: color,
                    fillOpacity: 0.85,
                  }}
                >
                  <Popup maxWidth={320} minWidth={200} maxHeight={400}>
                    <PopupContent loc={loc} people={loc.filteredPeople} />
                  </Popup>
                </CircleMarker>
              );
            })}
          </MapContainer>
        </div>

        {/* Legend panel — always visible on lg+, toggled on mobile */}
        <div
          className={`absolute right-0 top-0 z-1000 h-full w-64 overflow-y-auto border-l border-zinc-200 bg-white/95 p-3 shadow-lg backdrop-blur transition-transform lg:relative lg:translate-x-0 lg:shadow-none ${
            legendOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
              Birthplace Legend
            </h3>
            <button
              type="button"
              onClick={toggleAllCategories}
              className="text-[10px] font-medium text-sky-600 hover:underline"
            >
              {filters.categories.size === allCategoryIds.size ? "none" : "all"}
            </button>
          </div>
          <ul className="space-y-0.5">
            {categories.map((cat) => {
              const active = filters.categories.has(cat.id);
              return (
                <li key={cat.id}>
                  <button
                    type="button"
                    onClick={() => toggleCategory(cat.id)}
                    className={`flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-[12px] transition hover:bg-zinc-50 ${
                      active ? "text-zinc-800" : "text-zinc-400 line-through"
                    }`}
                  >
                    <span
                      className="inline-block h-3 w-3 flex-none rounded-full border border-white shadow-sm"
                      style={{ backgroundColor: active ? cat.color : "#d1d5db" }}
                    />
                    {cat.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}

function PopupContent({
  loc,
  people,
}: {
  loc: MapLocation;
  people: MapLocation["people"];
}) {
  const grouped = useMemo(() => {
    const map = new Map<LocationType, typeof people>();
    for (const p of people) {
      const arr = map.get(p.locationType) ?? [];
      arr.push(p);
      map.set(p.locationType, arr);
    }
    return map;
  }, [people]);

  return (
    <div className="font-sans">
      <h4 className="mb-1 text-sm font-bold leading-tight text-zinc-900">
        {loc.place}
      </h4>
      {(["birth", "death", "burial", "lived"] as const).map((type) => {
        const list = grouped.get(type);
        if (!list?.length) return null;
        return (
          <div key={type} className="mt-1.5">
            <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
              {LOCATION_TYPE_ICONS[type]} {LOCATION_TYPE_LABELS[type]} ({list.length})
            </p>
            <ul className="space-y-0 text-xs leading-relaxed">
              {list.map((p) => (
                <li key={`${p.id}-${type}`}>
                  {p.slug ? (
                    <Link
                      href={`/people/${p.slug}`}
                      className="text-sky-700 hover:underline"
                    >
                      {p.displayName}
                    </Link>
                  ) : (
                    <span className="text-zinc-700">{p.displayName}</span>
                  )}
                  {p.period ? (
                    <span className="ml-1 text-zinc-400">
                      ({p.period})
                    </span>
                  ) : p.date ? (
                    <span className="ml-1 text-zinc-400">
                      ({p.date.slice(0, 4)})
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
