import type { FamilyTree } from "./genealogy";
import { personSlugFromPage } from "./genealogy";
import type { PhotoInfo } from "./photos";
import { buildPhotoInfoMap } from "./photos";

export type BloodlineNode = {
  id: string;
  person: { displayName: string; birthDate?: string; deathDate?: string; personPage?: string };
  year: number | null;
  deathYear: number | null;
  role: string;
  slug: string | null;
  photo: PhotoInfo | null;
  places?: string;
};

export type BgPanel = {
  src: string;
  alt: string;
  caption?: string;
  focal?: [number, number];
};

export type BloodlineStep = {
  era: string;
  fullBg?: BgPanel;
  leftBg?: BgPanel;
  rightBg?: BgPanel;
  stump: BloodlineNode | null;
  addobbati: BloodlineNode | null;
};

function extractYear(dateStr: string | undefined): number | null {
  if (!dateStr) return null;
  for (const part of String(dateStr).replace(/-/g, " ").split(/\s+/)) {
    const y = parseInt(part, 10);
    if (y >= 1000 && y <= 2100) return y;
  }
  return null;
}

function makeNode(
  tree: FamilyTree,
  id: string,
  role: string,
  photos: Record<string, PhotoInfo | null>,
  places?: string,
): BloodlineNode | null {
  const p = tree.people[id];
  if (!p) return null;
  return {
    id,
    person: p,
    year: extractYear(p.birthDate) ?? extractYear((p as Record<string, unknown>).birthDateGedcom as string | undefined),
    deathYear: extractYear(p.deathDate) ?? extractYear((p as Record<string, unknown>).deathDateGedcom as string | undefined),
    role,
    slug: personSlugFromPage(p.personPage),
    photo: photos[id] ?? null,
    places,
  };
}

export type BloodlineData = {
  steps: BloodlineStep[];
  stumpColor: string;
  addobbatiColor: string;
  totalGenerations: number;
  earliestYear: number;
  latestYear: number;
};

const SWISS_MERIAN: BgPanel = {
  src: "media/context/swiss-landscapes/merian-swiss-town-1654.jpg",
  alt: "Matthäus Merian, Swiss Confederacy town, 1654",
  caption: "Merian — Topographia Helvetiae, 1654",
};

const SWISS_WOLF: BgPanel = {
  src: "media/context/swiss-landscapes/caspar-wolf-seebergsee-1778.jpg",
  alt: "Caspar Wolf, Swiss Alpine landscape, c. 1778",
  caption: "Caspar Wolf — Swiss Alps, c. 1778",
};

const KONSTANZ_1633: BgPanel = {
  src: "media/context/swiss-landscapes/konstanz-bodensee-siege-1633.jpg",
  alt: "Siege of Konstanz on the Bodensee, 1633",
  caption: "Konstanz am Bodensee, 1633",
};

const THURGAU_LANDSCAPE: BgPanel = {
  src: "media/context/thurgau-switzerland/thurgau-landscape.jpg",
  alt: "Sulgen, Erlen, and Romanshorn on Lake Constance, Thurgau",
  caption: "Thurgau — Sulgen & Erlen",
};

const BERGAMO_1450: BgPanel = {
  src: "media/context/bergamo-venetian/bergamo-1450-codice-agiografico.jpg",
  alt: "View of Bergamo with Città Alta, from a codice agiografico, c. 1450",
  caption: "Bergamo — codice agiografico, c. 1450",
};

const ROSA_BERGAMO: BgPanel = {
  src: "media/context/bergamo-venetian/rosa-piazza-vecchia-bergamo-1833.jpg",
  alt: "Costantino Rosa, Piazza Vecchia in Bergamo Alta, 1833",
  caption: "Rosa — Piazza Vecchia, Bergamo, 1833",
};

const ZARA_SANDRART: BgPanel = {
  src: "media/context/zara-dalmatia/zara-sandrart-1686.jpg",
  alt: "Zara — engraving by Jacob von Sandrart, 1686",
  caption: "Sandrart — Zara, 1686",
};

const CAMOCIO_ZARA: BgPanel = {
  src: "media/context/zara-dalmatia/camocio-zara-1574.jpg",
  alt: "Zara — engraving by Giovanni Francesco Camocio, 1574",
  caption: "Camocio — Zara, 1574",
};

const NIN_LAGOON: BgPanel = {
  src: "media/context/nin-noble-council/nin-island-lagoon.jpg",
  alt: "Nin, Dalmatia — island town in its lagoon",
  caption: "Nin — island town in its lagoon",
};

const NIN_SUNSET: BgPanel = {
  src: "media/context/nin-noble-council/nin-lagoon-sunset.jpg",
  alt: "Nin lagoon at sunset, Dalmatia",
  caption: "Nin — lagoon at sunset",
};

const NIN_GATE: BgPanel = {
  src: "media/context/nin-noble-council/nin-lower-city-gate.jpg",
  alt: "Nin Lower City Gate, Dalmatia",
  caption: "Nin — Lower City Gate",
};

const DALMATIA_MAP_REILLY: BgPanel = {
  src: "media/context/nin-noble-council/dalmatia-map-reilly-1791.jpg",
  alt: "Map of Dalmatia by Franz Johann Joseph von Reilly, 1791",
  caption: "Reilly — Dalmatia, 1791",
};

const FLORENCE_PATCH: BgPanel = {
  src: "media/context/florence/patch-florence-bellosguardo-1775.jpg",
  alt: "Thomas Patch, A Panoramic View of Florence from Bellosguardo, 1775",
  caption: "Thomas Patch — Florence, 1775",
};

const REVAL_AIVAZOVSKY: BgPanel = {
  src: "media/context/reval-tallinn/aivazovsky-reval-1845.jpg",
  alt: "Ivan Aivazovsky, Reval (Tallinn), oil on canvas, 1845",
  caption: "Aivazovsky — Reval, 1845",
};

const GENEVA: BgPanel = {
  src: "media/context/geneva/geneva-lac-leman-jet-deau-2009-mrb.jpg",
  alt: "Geneva and Lac Léman with Jet d'Eau",
  caption: "Geneva — Lac Léman",
};

const LONDON_THAMES: BgPanel = {
  src: "media/context/london-clerkenwell/london-thames-tower-bridge-2008.jpg",
  alt: "London skyline from the Thames, Tower Bridge",
  caption: "London — Thames and Tower Bridge",
};

const LONDON_SOMERS: BgPanel = {
  src: "media/context/london-clerkenwell/ossulston-walker-house.jpg",
  alt: "Walker House, Ossulston Estate, London",
  caption: "London — Somers Town, near Camden",
};

export function buildBloodlineData(tree: FamilyTree): BloodlineData {
  const allIds = [
    "I1", "I2", "I3", "I5", "I6", "I7", "I9", "I11", "I15", "I16", "I20", "I23", "I29",
    "I30", "I31", "I32", "I33", "I34", "I35", "I36", "I37", "I38",
    "I140", "I142", "I144", "I146", "I148", "I151", "I153", "I163", "I165",
  ];
  const photos = buildPhotoInfoMap(allIds);
  const n = (id: string, role: string, places?: string) => makeNode(tree, id, role, photos, places);

  const steps: BloodlineStep[] = [
    {
      era: "2016 – 2018",
      fullBg: {
        src: "media/images/portraits/archer-sloan-california.jpg",
        alt: "Archer and Sloan Lewis, California",
        caption: "Archer & Sloan — California",
      },
      stump: n("I7", "", "Los Gatos, California"),
      addobbati: n("I6", ""),
    },
    {
      era: "1982 – 2012",
      leftBg: LONDON_THAMES,
      rightBg: LONDON_SOMERS,
      stump: n("I1", "Stump line via Catherine", "Macclesfield → London"),
      addobbati: n("I5", "Evans line", "Camden, London"),
    },
    {
      era: "1949 – 1974",
      leftBg: GENEVA,
      rightBg: FLORENCE_PATCH,
      stump: n("I3", "Robert Stump's line", "Geneva"),
      addobbati: n("I2", "Addobbati line via Fulvia", "Florence → London"),
    },
    {
      era: "1910 – 1923",
      leftBg: {
        src: "media/context/tabriz-qajar/tabriz-flandin-panorama.jpg",
        alt: "Panorama of Tabriz by Eugène Flandin, 1840",
        caption: "Flandin — Tabriz, Persia, 1840",
      },
      rightBg: {
        src: "media/context/dalmatia-habsburg/zara-zadar-1920.jpg",
        alt: "Zara (Zadar), postcard view, c. 1920",
        caption: "Zara — c. 1920",
      },
      stump: n("I11", "", "Tehran → London"),
      addobbati: n("I9", "", "Zara → Florence"),
    },
    {
      era: "1880 – 1896",
      leftBg: REVAL_AIVAZOVSKY,
      rightBg: {
        src: "media/context/dalmatia-habsburg/cermak-dalmatian-wedding-1877.jpg",
        alt: "Jaroslav Čermák, Dalmatian Wedding, 1875–77",
        caption: "Čermák — Dalmatian Wedding, 1877",
      },
      stump: n("I16", "", "Reval → Tehran"),
      addobbati: n("I15", "", "Zara, Dalmatia"),
    },
    {
      era: "1834 – 1852",
      leftBg: {
        src: "media/context/swiss-landscapes/gude-lake-constance-1882.jpg",
        alt: "Hans Gude, Lake Constance, 1882",
        caption: "Hans Gude — Bodensee, 1882",
      },
      rightBg: {
        src: "media/images/portraits/adolobati-family-group-handwritten-names-italian-caption.jpg",
        alt: "Addobbati family group, Zara, mid-19th century",
        caption: "The Addobbati family — Zara",
      },
      stump: n("I140", "", "Erlen, Thurgau"),
      addobbati: n("I20", "I.R. Senior Postal Officer", "Zara"),
    },
    {
      era: "1800 – 1815",
      leftBg: THURGAU_LANDSCAPE,
      rightBg: DALMATIA_MAP_REILLY,
      stump: n("I142", "", "Sulgen, Thurgau"),
      addobbati: n("I23", "Revidente Contabile, Lt. National Guard", "Zara"),
    },
    {
      era: "1767 – 1776",
      leftBg: SWISS_WOLF,
      rightBg: NIN_LAGOON,
      stump: n("I144", "", "Sulgen, Thurgau"),
      addobbati: n("I29", "Noble of Nin", "Nin → Zara"),
    },
    {
      era: "1730 – 1744",
      leftBg: SWISS_MERIAN,
      rightBg: NIN_SUNSET,
      stump: n("I146", "", "Sulgen, Thurgau"),
      addobbati: n("I30", "Procurator & Head, University of Citizens", "Zara"),
    },
    {
      era: "1702",
      leftBg: KONSTANZ_1633,
      rightBg: ZARA_SANDRART,
      stump: n("I148", "", "Thurgau"),
      addobbati: n("I31", "Citizen of Zara", "Bergamo → Zara"),
    },
    {
      era: "1674 – 1676",
      leftBg: THURGAU_LANDSCAPE,
      rightBg: NIN_GATE,
      stump: n("I151", "", "Buchackern, Thurgau"),
      addobbati: n("I32", "Captain of Cuirassiers", "Venetian Dalmatia"),
    },
    {
      era: "1639 – 1651",
      leftBg: SWISS_WOLF,
      rightBg: CAMOCIO_ZARA,
      stump: n("I153", "", "Buchackern, Thurgau"),
      addobbati: n("I33", "", "Zara"),
    },
    {
      era: "1596 – 1630",
      leftBg: SWISS_MERIAN,
      rightBg: ZARA_SANDRART,
      stump: n("I163", "", "Buchackern, Thurgau"),
      addobbati: n("I34", "Notary", "Zara"),
    },
    {
      era: "1565 – 1610",
      leftBg: KONSTANZ_1633,
      rightBg: BERGAMO_1450,
      stump: n("I165", "Earliest known Stump", "Sulgen, Thurgau"),
      addobbati: n("I35", "Notary, created citizen", "Bergamo → Zara"),
    },
    {
      era: "1559",
      leftBg: THURGAU_LANDSCAPE,
      rightBg: ROSA_BERGAMO,
      stump: null,
      addobbati: n("I36", "Notary", "Bergamo"),
    },
    {
      era: "1511",
      leftBg: SWISS_WOLF,
      rightBg: BERGAMO_1450,
      stump: null,
      addobbati: n("I37", "Notary", "Bergamo"),
    },
    {
      era: "1495",
      leftBg: SWISS_MERIAN,
      rightBg: ROSA_BERGAMO,
      stump: null,
      addobbati: n("I38", "Civis Bergomi", "Bergamo"),
    },
  ];

  const allYears = steps
    .flatMap((s) => [s.stump?.year, s.addobbati?.year])
    .filter((y): y is number => y != null && y > 0);

  return {
    steps,
    stumpColor: "#DC2626",
    addobbatiColor: "#C9A227",
    totalGenerations: steps.length,
    earliestYear: allYears.length > 0 ? Math.min(...allYears) : 1495,
    latestYear: allYears.length > 0 ? Math.max(...allYears) : 2018,
  };
}
