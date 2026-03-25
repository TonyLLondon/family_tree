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
  };
}

export type BloodlineData = {
  steps: BloodlineStep[];
  stumpColor: string;
  addobbatiColor: string;
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

const VENICE_CANALETTO: BgPanel = {
  src: "media/context/venice-republic/canaletto-grand-canal-1723.jpg",
  alt: "Canaletto, Grand Canal with Palazzo Corner, c. 1723",
  caption: "Canaletto — Venice, c. 1723",
};

const VENICE_VERONESE: BgPanel = {
  src: "media/context/venice-republic/veronese-apotheosis-venice-1585.jpg",
  alt: "Paolo Veronese, Apotheosis of Venice, 1585",
  caption: "Veronese — Doge's Palace, 1585",
};

const VENICE_CARPACCIO: BgPanel = {
  src: "media/context/venice-renaissance/carpaccio-miracle-rialto-1494.jpg",
  alt: "Vittore Carpaccio, Miracle at the Rialto, 1494",
  caption: "Carpaccio — Venice, 1494",
};

export function buildBloodlineData(tree: FamilyTree): BloodlineData {
  const allIds = [
    "I1", "I2", "I3", "I9", "I11", "I15", "I16", "I20", "I23", "I29",
    "I30", "I31", "I32", "I33", "I34", "I35", "I36", "I37", "I38",
    "I140", "I142", "I144", "I146", "I148", "I151", "I153", "I163", "I165",
  ];
  const photos = buildPhotoInfoMap(allIds);
  const n = (id: string, role: string) => makeNode(tree, id, role, photos);

  const steps: BloodlineStep[] = [
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
      stump: n("I11", "Tehran → London"),
      addobbati: n("I9", "Zara → Florence"),
    },
    {
      era: "1880 – 1896",
      leftBg: {
        src: "media/context/tabriz-qajar/tabriz-city-gate-flandin.jpg",
        alt: "Tabriz city gate by Eugène Flandin, 1840",
        caption: "Flandin — Tabriz city gate",
      },
      rightBg: {
        src: "media/context/dalmatia-habsburg/cermak-dalmatian-wedding-1877.jpg",
        alt: "Jaroslav Čermák, Dalmatian Wedding, 1875–77",
        caption: "Čermák — Dalmatian Wedding, 1877",
      },
      stump: n("I16", "Reval → Tehran"),
      addobbati: n("I15", "Zara, Dalmatia"),
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
      stump: n("I140", "Erlen, Thurgau"),
      addobbati: n("I20", "I.R. senior postal officer"),
    },
    {
      era: "1800 – 1815",
      leftBg: SWISS_WOLF,
      rightBg: VENICE_CANALETTO,
      stump: n("I142", "Sulgen, Thurgau"),
      addobbati: n("I23", "Revidente Contabile, Lt. National Guard"),
    },
    {
      era: "1767 – 1776",
      leftBg: SWISS_WOLF,
      rightBg: VENICE_CANALETTO,
      stump: n("I144", "Sulgen, Thurgau"),
      addobbati: n("I29", "Noble of Nin"),
    },
    {
      era: "1730 – 1744",
      leftBg: SWISS_WOLF,
      rightBg: VENICE_CANALETTO,
      stump: n("I146", "Sulgen, Thurgau"),
      addobbati: n("I30", "Procurator & Head, University of Citizens"),
    },
    {
      era: "1702",
      leftBg: SWISS_MERIAN,
      rightBg: VENICE_CANALETTO,
      stump: n("I148", "Thurgau"),
      addobbati: n("I31", "Citizen of Zara — arrived 1733"),
    },
    {
      era: "1674 – 1676",
      leftBg: SWISS_MERIAN,
      rightBg: {
        src: "media/context/zara-dalmatia/zara-sandrart-1686.jpg",
        alt: "Zara — engraving by Jacob von Sandrart, 1686",
        caption: "Sandrart — Zara, 1686",
      },
      stump: n("I151", "Buchackern, Thurgau"),
      addobbati: n("I32", "Captain of cuirassiers"),
    },
    {
      era: "1639 – 1651",
      leftBg: SWISS_MERIAN,
      rightBg: VENICE_VERONESE,
      stump: n("I153", "Buchackern"),
      addobbati: n("I33", ""),
    },
    {
      era: "1596 – 1630",
      leftBg: SWISS_MERIAN,
      rightBg: VENICE_VERONESE,
      stump: n("I163", "Buchackern, Thurgau"),
      addobbati: n("I34", "Notary"),
    },
    {
      era: "1565 – 1610",
      leftBg: SWISS_MERIAN,
      rightBg: VENICE_VERONESE,
      stump: n("I165", "Sulgen, Thurgau — earliest Stump"),
      addobbati: n("I35", "Notary, created citizen"),
    },
    {
      era: "1559",
      leftBg: SWISS_MERIAN,
      rightBg: VENICE_VERONESE,
      stump: null,
      addobbati: n("I36", "Notary, Bergamo"),
    },
    {
      era: "1511",
      leftBg: SWISS_MERIAN,
      rightBg: VENICE_CARPACCIO,
      stump: null,
      addobbati: n("I37", "Notary, Bergamo"),
    },
    {
      era: "1495",
      leftBg: SWISS_MERIAN,
      rightBg: VENICE_CARPACCIO,
      stump: null,
      addobbati: n("I38", "Civis Bergomi — the earliest ancestor"),
    },
  ];

  return {
    steps,
    stumpColor: "#DC2626",
    addobbatiColor: "#C9A227",
  };
}
