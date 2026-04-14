import fs from "fs";
import path from "path";
import { WEB_ROOT } from "./paths";
import type { FamilyTree } from "./genealogy";
import { collectDirectAncestorIds, personSlugFromPage } from "./genealogy";
import { LEWIS_LINEAGE_FOCUS_ID } from "./lewisLineageFocus";
import {
  classifyBirthPlaceRegion,
  CHART_BIRTH_PLACE_LEGEND,
} from "./birthPlaceChartColors";

const NON_PLACE_RE = /^(before|after|about)\s/i;

export type LocationType = "birth" | "death" | "burial" | "lived";

export type MapPerson = {
  id: string;
  displayName: string;
  slug: string | null;
  locationType: LocationType;
  date: string | null;
  period?: string;
};

export type MapLocation = {
  place: string;
  lat: number;
  lng: number;
  categoryId: string;
  people: MapPerson[];
};

export type MapCategory = {
  id: string;
  label: string;
  color: string;
};

export type MapData = {
  locations: MapLocation[];
  categories: MapCategory[];
};

type PlaceGeoEntry = { lat: number; lng: number };
type PlaceGeo = Record<string, PlaceGeoEntry>;

type LivedPlaceEntry = { place: string; period?: string };
type LivedPlacesFile = Record<
  string,
  { displayName: string; livedPlaces: LivedPlaceEntry[] }
>;

let geoCache: PlaceGeo | null = null;
let livedCache: LivedPlacesFile | null = null;

function loadPlaceGeo(): PlaceGeo {
  if (geoCache) return geoCache;
  const filePath = path.join(WEB_ROOT, "place-geo.json");
  geoCache = JSON.parse(fs.readFileSync(filePath, "utf8")) as PlaceGeo;
  return geoCache;
}

function loadLivedPlaces(): LivedPlacesFile {
  if (livedCache) return livedCache;
  const filePath = path.join(WEB_ROOT, "lived-places.json");
  try {
    livedCache = JSON.parse(fs.readFileSync(filePath, "utf8")) as LivedPlacesFile;
  } catch {
    livedCache = {};
  }
  return livedCache;
}

/**
 * `place-geo.json` keys are exact strings; tree data sometimes appends parenthetical
 * notes (e.g. burial church) so `"Tabriz, Iran (buried …)"` must resolve to `"Tabriz, Iran"`.
 */
function resolvePlaceGeo(placeGeo: PlaceGeo, place: string): { lat: number; lng: number; mapKey: string } | null {
  let s = place.trim();
  while (s.length > 0) {
    const hit = placeGeo[s];
    if (hit) return { lat: hit.lat, lng: hit.lng, mapKey: s };
    const m = s.match(/^(.*)\s+\([^)]+\)\s*$/);
    if (!m) break;
    s = m[1]!.trim();
  }
  return null;
}

function addToLocationMap(
  locationMap: Map<string, MapLocation>,
  placeGeo: PlaceGeo,
  place: string,
  person: { id: string; displayName: string; slug: string | null },
  locationType: LocationType,
  date: string | null,
  period?: string,
) {
  const resolved = resolvePlaceGeo(placeGeo, place);
  if (!resolved) return;

  let loc = locationMap.get(resolved.mapKey);
  if (!loc) {
    loc = {
      place: resolved.mapKey,
      lat: resolved.lat,
      lng: resolved.lng,
      categoryId: classifyBirthPlaceRegion(place),
      people: [],
    };
    locationMap.set(resolved.mapKey, loc);
  }

  loc.people.push({
    id: person.id,
    displayName: person.displayName,
    slug: person.slug,
    locationType,
    date,
    period,
  });
}

export function buildMapData(tree: FamilyTree): MapData {
  const placeGeo = loadPlaceGeo();
  const livedPlaces = loadLivedPlaces();
  const locationMap = new Map<string, MapLocation>();
  const lineageIds = collectDirectAncestorIds(tree, LEWIS_LINEAGE_FOCUS_ID);

  for (const person of Object.values(tree.people)) {
    if (!lineageIds.has(person.id)) continue;
    const slug = personSlugFromPage(person.personPage);
    const p = { id: person.id, displayName: person.displayName, slug };

    if (person.birthPlace && !NON_PLACE_RE.test(person.birthPlace)) {
      addToLocationMap(locationMap, placeGeo, person.birthPlace, p, "birth", person.birthDate ?? null);
    }
    if (person.deathPlace && !NON_PLACE_RE.test(person.deathPlace)) {
      addToLocationMap(locationMap, placeGeo, person.deathPlace, p, "death", person.deathDate ?? null);
    }
    if (person.burialPlace && !NON_PLACE_RE.test(person.burialPlace)) {
      addToLocationMap(locationMap, placeGeo, person.burialPlace, p, "burial", person.deathDate ?? null);
    }

    const lived = livedPlaces[person.id];
    if (lived) {
      for (const lp of lived.livedPlaces) {
        addToLocationMap(locationMap, placeGeo, lp.place, p, "lived", null, lp.period);
      }
    }
  }

  const locations = Array.from(locationMap.values()).sort(
    (a, b) => b.people.length - a.people.length,
  );

  const categories: MapCategory[] = CHART_BIRTH_PLACE_LEGEND.map((c) => ({
    id: c.id,
    label: c.label,
    color: c.color,
  }));

  return { locations, categories };
}
