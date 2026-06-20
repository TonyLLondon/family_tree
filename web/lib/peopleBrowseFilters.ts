/** Portrait availability for People index chips. */
export type PeoplePortraitFilter = "portrait" | "no-portrait";

export const PEOPLE_FILTER_LABEL: Record<PeoplePortraitFilter, string> = {
  portrait: "With portrait",
  "no-portrait": "No portrait yet",
};
