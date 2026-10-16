import type { components } from "@/api/schema";

// The kinds of things partners list, each searched by its category's name (search matches
// listing categories as well as titles). The home hero offers them, and so does a search
// that finds nothing.
// `icon` is the listing category whose line icon stands for it; `group` is its What to book
// group, whose hue the hero's icon takes, as the area map's pins do (RAA-130).
export const CATEGORIES = [
  { label: "Tours", query: "Tour", icon: "Tour", group: "activity" },
  { label: "Motorbikes", query: "Motorcycle", icon: "Motorcycle", group: "rental" },
  { label: "Stays", query: "Hotel", icon: "Hotel or cottage", group: "stay" },
  { label: "Snorkel gear", query: "Snorkel gear", icon: "Snorkel gear", group: "rental" },
  { label: "Transfers", query: "Van transfer", icon: "Van transfer", group: "transfer" },
] as const;

// An icon's colour per group, on dark glass. Full class names, so Tailwind finds them.
export const GROUP_ICON = {
  activity: "text-kind-activity",
  transfer: "text-kind-transfer",
  rental: "text-kind-rental",
  stay: "text-kind-stay",
};

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
