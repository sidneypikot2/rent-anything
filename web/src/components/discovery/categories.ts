import type { components } from "@/api/schema";

// What to book's groups, one per listing `group` (a booking type, with gear told apart from the
// vehicle rentals it shares `rental` with), named once (RAA-130): `title` heads the group on an
// area page and in the map's key; `short` is the home hero's shortcut to it, which a search that
// finds nothing offers too. `id` is the group's anchor and `?show=` value; `icon` the listing
// category whose line icon stands for it; `need` what it is to a trip, in the trip card's
// checklist of what a trip here still lacks — gear is nice to have, not a need, so it has none.
export const BOOKING_GROUPS = [
  {
    group: "activity",
    id: "need-activity",
    title: "Tours & activities",
    short: "Tours",
    need: "Things to do",
    icon: "Tour",
  },
  {
    group: "transfer",
    id: "need-transfer",
    title: "Transfers",
    short: "Transfers",
    need: "A transfer",
    icon: "Van transfer",
  },
  {
    group: "rental",
    id: "need-rental",
    title: "Getting around",
    short: "Getting around",
    need: "Getting around",
    icon: "Motorcycle",
  },
  { group: "stay", id: "need-stay", title: "Stays", short: "Stays", need: "A place to stay", icon: "Hotel or cottage" },
  { group: "gear", id: "need-gear", title: "Gear", short: "Gear", need: null, icon: "Snorkel gear" },
] as const;

export type BookingGroup = (typeof BOOKING_GROUPS)[number];

// The same groups in the order a trip needs them, getting there first, as the example trip
// lists them: an area page's What to book and wherever the kinds are offered as shortcuts (the
// home hero, a search that finds nothing), so they never appear in two orders.
export const TRIP_ORDER_GROUPS = (["transfer", "stay", "activity", "rental", "gear"] as const).map((key) =>
  BOOKING_GROUPS.find(({ group }) => group === key)!,
);

// An icon's colour per group, on dark glass. Full class names, so Tailwind finds them. Gear
// shares the rentals' hue.
export const GROUP_ICON = {
  activity: "text-kind-activity",
  transfer: "text-kind-transfer",
  rental: "text-kind-rental",
  stay: "text-kind-stay",
  gear: "text-kind-rental",
};

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
  // A listing names only its area's slug: when no other result names the area, the slug read
  // as words ("santa-fe" → "Santa Fe"), so two listings with one title can still be told apart.
  const place = names.get(listing.area_slug) ?? slugWords(listing.area_slug);
  return `${listing.category} · ${place}`;
}

export function slugWords(slug: string) {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
