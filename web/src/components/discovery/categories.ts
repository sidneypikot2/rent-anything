import type { components } from "@/api/schema";

// What to book's four groups, one per booking type, named once (RAA-130): `title` heads the
// group on an area page and in the map's key; `short` is the home hero's shortcut to it, which a
// search that finds nothing offers too, so a Transfers pill opens Getting there & around. `id` is
// the group's anchor and `?show=` value; `icon` the listing category whose line icon stands for
// it. In the area page's order.
export const BOOKING_GROUPS = [
  { group: "activity", id: "need-activity", title: "Tours & activities", short: "Tours", icon: "Tour" },
  { group: "transfer", id: "need-transfer", title: "Getting there & around", short: "Transfers", icon: "Van transfer" },
  { group: "rental", id: "need-rental", title: "Rentals & gear", short: "Rentals", icon: "Motorcycle" },
  { group: "stay", id: "need-stay", title: "Stays", short: "Stays", icon: "Hotel or cottage" },
] as const;

export type BookingGroup = (typeof BOOKING_GROUPS)[number];

// The same groups in the order a trip needs them, getting there first, as the example trip
// lists them: wherever the kinds are offered as shortcuts (the home hero, a search that finds
// nothing), so they never appear in two orders.
export const TRIP_ORDER_GROUPS = (["transfer", "stay", "rental", "activity"] as const).map(
  (key) => BOOKING_GROUPS.find(({ group }) => group === key)!,
);

// An icon's colour per group, on dark glass. Full class names, so Tailwind finds them.
export const GROUP_ICON = {
  activity: "text-kind-activity",
  transfer: "text-kind-transfer",
  rental: "text-kind-rental",
  stay: "text-kind-stay",
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
