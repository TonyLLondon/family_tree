"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  Polyline,
  useMap,
} from "react-leaflet";
import Link from "next/link";
import "leaflet/dist/leaflet.css";

export type AddressPerson = {
  name: string;
  detail: string;
  slug?: string;
};

export type AddressEntry = {
  year: number;
  source: string;
  corpusSlug?: string;
  people: AddressPerson[];
  note?: string;
};

export type AddressPoint = {
  id: string;
  address: string;
  area: string;
  lat: number;
  lng: number;
  familyId: string;
  entries: AddressEntry[];
};

export type FamilyDef = {
  id: string;
  label: string;
  color: string;
};

export type LondonAddressData = {
  families: FamilyDef[];
  addresses: AddressPoint[];
};

const LONDON_CENTER: [number, number] = [51.537, -0.112];
const INITIAL_ZOOM = 14;

const DECADES = [1850, 1860, 1870, 1880, 1890, 1900, 1910, 1920, 1930];

function decadeLabel(d: number): string {
  return `${d}s`;
}

function FitBounds({ addresses }: { addresses: AddressPoint[] }) {
  const map = useMap();
  const fitted = useRef(false);

  useEffect(() => {
    if (fitted.current || addresses.length === 0) return;
    fitted.current = true;
    const lats = addresses.map((a) => a.lat);
    const lngs = addresses.map((a) => a.lng);
    map.fitBounds(
      [
        [Math.min(...lats) - 0.003, Math.min(...lngs) - 0.005],
        [Math.max(...lats) + 0.003, Math.max(...lngs) + 0.005],
      ],
      { maxZoom: 15, padding: [40, 40] },
    );
  }, [map, addresses]);

  return null;
}

function connectionLines(
  filtered: AddressPoint[],
  families: FamilyDef[],
): { positions: [number, number][]; color: string; familyId: string }[] {
  const byFamily = new Map<string, AddressPoint[]>();
  for (const addr of filtered) {
    const arr = byFamily.get(addr.familyId) ?? [];
    arr.push(addr);
    byFamily.set(addr.familyId, arr);
  }

  const lines: { positions: [number, number][]; color: string; familyId: string }[] = [];
  for (const [familyId, points] of byFamily) {
    if (points.length < 2) continue;
    const sorted = [...points].sort((a, b) => {
      const aMin = Math.min(...a.entries.map((e) => e.year));
      const bMin = Math.min(...b.entries.map((e) => e.year));
      return aMin - bMin;
    });
    const color = families.find((f) => f.id === familyId)?.color ?? "#999";
    lines.push({
      positions: sorted.map((p) => [p.lat, p.lng]),
      color,
      familyId,
    });
  }
  return lines;
}

export function LondonAddressMap({ data }: { data: LondonAddressData }) {
  const { families, addresses } = data;

  const allFamilyIds = useMemo(() => new Set(families.map((f) => f.id)), [families]);
  const [activeFamilies, setActiveFamilies] = useState(new Set(allFamilyIds));
  const [activeDecade, setActiveDecade] = useState<number | null>(null);
  const [showLines, setShowLines] = useState(true);

  const toggleFamily = useCallback((id: string) => {
    setActiveFamilies((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const filtered = useMemo(() => {
    return addresses
      .filter((a) => activeFamilies.has(a.familyId))
      .map((a) => {
        if (activeDecade === null) return a;
        const matchedEntries = a.entries.filter(
          (e) => e.year >= activeDecade && e.year < activeDecade + 10,
        );
        if (matchedEntries.length === 0) return null;
        return { ...a, entries: matchedEntries };
      })
      .filter(Boolean) as AddressPoint[];
  }, [addresses, activeFamilies, activeDecade]);

  const lines = useMemo(
    () => (showLines ? connectionLines(filtered, families) : []),
    [filtered, families, showLines],
  );

  const yearRange = useMemo(() => {
    const allYears = addresses.flatMap((a) => a.entries.map((e) => e.year));
    return { min: Math.min(...allYears), max: Math.max(...allYears) };
  }, [addresses]);

  return (
    <div className="relative flex flex-1 flex-col">
      {/* Top controls */}
      <div className="flex flex-wrap items-center gap-3 border-b border-zinc-200/80 bg-white px-4 py-2 text-sm">
        <span className="font-medium text-zinc-700">Decade:</span>
        <button
          type="button"
          onClick={() => setActiveDecade(null)}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
            activeDecade === null
              ? "border-zinc-800 bg-zinc-800 text-white"
              : "border-zinc-300 bg-zinc-50 text-zinc-500 hover:bg-zinc-100"
          }`}
        >
          All
        </button>
        {DECADES.filter((d) => d >= Math.floor(yearRange.min / 10) * 10 && d <= yearRange.max).map(
          (d) => (
            <button
              key={d}
              type="button"
              onClick={() => setActiveDecade(activeDecade === d ? null : d)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                activeDecade === d
                  ? "border-zinc-800 bg-zinc-800 text-white"
                  : "border-zinc-300 bg-zinc-50 text-zinc-500 hover:bg-zinc-100"
              }`}
            >
              {decadeLabel(d)}
            </button>
          ),
        )}
        <label className="ml-auto flex items-center gap-1.5 text-xs text-zinc-500 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showLines}
            onChange={() => setShowLines((v) => !v)}
            className="accent-zinc-700"
          />
          Migration lines
        </label>
        <span className="text-xs text-zinc-400">
          {filtered.length} address{filtered.length !== 1 ? "es" : ""}
        </span>
      </div>

      <div className="relative flex flex-1">
        {/* Map */}
        <div className="flex-1">
          <MapContainer
            center={LONDON_CENTER}
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
            <FitBounds addresses={filtered} />

            {lines.map((line) => (
              <Polyline
                key={line.familyId}
                positions={line.positions}
                pathOptions={{
                  color: line.color,
                  weight: 2,
                  opacity: 0.4,
                  dashArray: "6 4",
                }}
              />
            ))}

            {filtered.map((addr) => {
              const family = families.find((f) => f.id === addr.familyId);
              const color = family?.color ?? "#999";
              return (
                <CircleMarker
                  key={addr.id}
                  center={[addr.lat, addr.lng]}
                  radius={8}
                  pathOptions={{
                    color: "#fff",
                    weight: 2,
                    fillColor: color,
                    fillOpacity: 0.9,
                  }}
                >
                  <Popup maxWidth={360} minWidth={240} maxHeight={420}>
                    <AddressPopup addr={addr} familyColor={color} />
                  </Popup>
                </CircleMarker>
              );
            })}
          </MapContainer>
        </div>

        {/* Legend sidebar */}
        <div className="hidden w-64 flex-none overflow-y-auto border-l border-zinc-200 bg-white/95 p-4 backdrop-blur lg:block">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-zinc-500">
            Families
          </h3>
          <ul className="space-y-1">
            {families.map((fam) => {
              const active = activeFamilies.has(fam.id);
              const count = addresses.filter((a) => a.familyId === fam.id).length;
              return (
                <li key={fam.id}>
                  <button
                    type="button"
                    onClick={() => toggleFamily(fam.id)}
                    className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[13px] transition hover:bg-zinc-50 ${
                      active ? "text-zinc-800" : "text-zinc-400 line-through"
                    }`}
                  >
                    <span
                      className="inline-block h-3 w-3 flex-none rounded-full border border-white shadow-sm"
                      style={{ backgroundColor: active ? fam.color : "#d1d5db" }}
                    />
                    <span className="flex-1">{fam.label}</span>
                    <span className="text-[11px] text-zinc-400">{count}</span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="mt-6 border-t border-zinc-100 pt-4">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-zinc-500">
              Timeline
            </h3>
            <p className="text-xs leading-relaxed text-zinc-500">
              {yearRange.min}&ndash;{yearRange.max}: four families across Islington,
              Clerkenwell, Holloway, and St Pancras. The Evans, Knecht, and Fensom
              families all lived within walking distance &mdash; converging through
              marriage in the early 1900s.
            </p>
          </div>

          <div className="mt-4 border-t border-zinc-100 pt-4">
            <Link
              href="/map"
              className="text-xs text-sky-600 hover:underline"
            >
              &larr; World map
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function AddressPopup({
  addr,
  familyColor,
}: {
  addr: AddressPoint;
  familyColor: string;
}) {
  return (
    <div className="font-sans">
      <div className="mb-1.5 flex items-start gap-2">
        <span
          className="mt-0.5 inline-block h-3 w-3 flex-none rounded-full"
          style={{ backgroundColor: familyColor }}
        />
        <div>
          <h4 className="text-sm font-bold leading-tight text-zinc-900">
            {addr.address}
          </h4>
          <p className="text-[11px] text-zinc-500">{addr.area}</p>
        </div>
      </div>

      {addr.entries.map((entry) => (
        <div key={entry.year} className="mt-2 border-t border-zinc-100 pt-2">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-sm font-bold text-zinc-800">{entry.year}</span>
            <span className="text-[10px] text-zinc-400">{entry.source}</span>
          </div>
          <ul className="space-y-0.5 text-xs leading-relaxed">
            {entry.people.map((p, i) => (
              <li key={i}>
                {p.slug ? (
                  <Link
                    href={`/people/${p.slug}`}
                    className="text-sky-700 hover:underline"
                  >
                    {p.name}
                  </Link>
                ) : (
                  <span className="text-zinc-700">{p.name}</span>
                )}
                {p.detail && (
                  <span className="ml-1 text-zinc-400">
                    &mdash; {p.detail}
                  </span>
                )}
              </li>
            ))}
          </ul>
          {entry.note && (
            <p className="mt-1 text-[11px] italic text-zinc-400">{entry.note}</p>
          )}
          {entry.corpusSlug && (
            <Link
              href={`/corpus/${entry.corpusSlug}`}
              className="mt-1 inline-block text-[10px] text-sky-600 hover:underline"
            >
              View transcription &rarr;
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}
