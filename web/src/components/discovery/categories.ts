import type { components } from "@/api/schema";

// The kinds of things partners list, each searched by its category's name (search matches
// listing categories as well as titles). The home hero offers them, and so does a search
// that finds nothing.
export const CATEGORIES = [
  { label: "Tours", query: "Tour" },
  { label: "Motorbikes", query: "Motorcycle" },
  { label: "Stays", query: "Hotel" },
  { label: "Snorkel gear", query: "Snorkel gear" },
  { label: "Transfers", query: "Van transfer" },
];

export const categoryHref = (query: string) => `/search?q=${encodeURIComponent(query)}`;

type Results = components["schemas"]["search_results"];

// A thing to book in search results: its category and, when the same results name its
// destination, where it is ("Snorkel gear · Santa Fe"), so two listings with one title can
// be told apart (RAA-80). The API doesn't send the destination's name with a listing yet.
export function listingNote(listing: Results["listings"][number], results: Results) {
  const names = new Map([
    ...results.areas.map((area) => [area.slug, area.name] as const),
    ...results.landmarks.map((landmark) => [landmark.area.slug, landmark.area.name] as const),
    ...results.tags.flatMap((tag) => tag.areas.map((area) => [area.slug, area.name] as const)),
  ]);
  const place = names.get(listing.area_slug);
  return place ? `${listing.category} · ${place}` : listing.category;
}
