import type { PlanGroup, PlanBusinessesPage } from "@/api/discovery";
import type { GettingHere } from "@/components/landing/launch-area";
import { coversHere, missingStays } from "@/components/trips/trip-missing";
import type { Trip, TripItem } from "@/components/trips/use-trips";
import { formatDateRange, formatDay } from "@/components/trips/format";
import { distanceKm, type LatLng } from "@/lib/geo";

// What the checklist and the review read of a place (plan a whole trip), built on the server
// from the area and explore responses: how many options each step has, and the places to see
// with their points and photos. A step's options are the businesses offering it, a page at a
// time (usePlanBusinesses), each with its first listing's rounded point and the places to see its
// listings go to; a card opens the business's own page.
export type PlanBusiness = Omit<PlanBusinessesPage["businesses"][number], "goes_to"> & { goesTo: string[] };

export function toPlanBusiness(business: PlanBusinessesPage["businesses"][number]): PlanBusiness {
  const { goes_to, ...rest } = business;
  return { ...rest, goesTo: goes_to };
}
export type PlanLandmark = {
  slug: string;
  name: string;
  description: string;
  photo: { src: string; alt: string } | null;
  visitedBy: number[];
  location: LatLng | null;
};
export type PlanPlace = {
  area: { slug: string; name: string };
  // The place and every place inside it: what the trip has "here".
  places: string[];
  // The island it is a town of, when it is one (coversHere).
  island: string | null;
  center: LatLng | null;
  // How many options each step has here.
  counts: Record<RowKey, number>;
  landmarks: PlanLandmark[];
  gettingHere: GettingHere | null;
};

// A row is one guest group (a listing's `group`), which the API pages through.
export type RowKey = PlanGroup;

// The checklist's rows, in the order most people book (our Path B): where to sleep, how to get
// there, how to get around, then what to do and the gear to rent. `pick`: the listing page's button.
export const PLAN_ROWS: { key: RowKey; title: string; idle: string; pick: string }[] = [
  { key: "stay", title: "Where you'll stay", idle: "Beach resorts, cottages and hostels", pick: "Pick this stay" },
  { key: "transfer", title: "Getting there", idle: "Vans and boats to the island", pick: "Pick this ride" },
  { key: "rental", title: "Getting around", idle: "Scooters, trikes, e-bikes", pick: "Pick this ride" },
  { key: "activity", title: "Things to do", idle: "Island hopping, caves, diving", pick: "Pick this tour" },
  { key: "gear", title: "Gear to rent", idle: "Snorkels, fins, cameras", pick: "Pick this gear" },
];

const live = (item: TripItem) => !item.unavailable;

// The trip's items a row holds here (any place on the island counts, as on a place's page).
export function rowItems(trip: Trip, key: RowKey, place: Pick<PlanPlace, "places" | "island">) {
  return trip.items.filter((item) => item.listing.group === key && live(item) && coversHere(item, place.places, place.island));
}

// Whether a row is done: a stay for every night ahead (or the guest's own place), anything of
// the others here.
export function rowDone(trip: Trip, key: RowKey, place: Pick<PlanPlace, "places" | "island">) {
  if (key === "stay") return Boolean(trip.own_stay) || (rowItems(trip, "stay", place).length > 0 && missingStays(trip).length === 0);
  return rowItems(trip, key, place).length > 0;
}

// What a done row says it holds: "Kota Beach Resort · 3 nights", "Island hopping · Sat, Nov 22 +1 more".
export function rowHolds(trip: Trip, key: RowKey, place: Pick<PlanPlace, "places" | "island">) {
  if (key === "stay" && trip.own_stay) return `Your own place${trip.own_stay.name ? ` · ${trip.own_stay.name}` : ""}`;
  const items = rowItems(trip, key, place);
  const first = items[0];
  if (!first) return null;
  const when =
    key === "stay"
      ? first.starts_on && first.ends_on && `${nights(first.starts_on, first.ends_on)} nights`
      : first.starts_on && (first.ends_on && first.ends_on !== first.starts_on ? formatDateRange(first.starts_on, first.ends_on) : formatDay(first.starts_on));
  const more = items.length > 1 ? ` +${items.length - 1} more` : "";
  return [first.listing.title, when].filter(Boolean).join(" · ") + more;
}

function nights(from: string, to: string) {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
}

// Where distances start: the guest's own place, else the first stay in the trip (its rounded
// point, as the trip item has it).
export function stayPoint(trip: Trip | undefined): { point: LatLng; name: string } | null {
  if (!trip) return null;
  if (trip.own_stay) return { point: trip.own_stay.location, name: trip.own_stay.name ?? "your stay" };
  const stay = trip.items.find((item) => item.booking_type === "stay");
  return stay ? { point: stay.location, name: stay.listing.title } : null;
}

// "2.1 km", "400 m".
export function kmText(km: number) {
  return km < 1 ? `${Math.max(100, Math.round((km * 1000) / 100) * 100)} m` : `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}

export function distanceText(from: LatLng | null | undefined, to: LatLng | null | undefined) {
  return from && to ? kmText(distanceKm(from, to)) : null;
}

// The places to see the trip has hearted (saved), by slug.
export function heartedSlugs(trip: Trip | undefined) {
  return new Set((trip?.saved_landmarks ?? []).map((saved) => saved.slug));
}

// Things to do with the businesses whose tours go to the hearted places first, those reaching more of them
// before those reaching fewer, then the rest; nothing is left out. The API pages them in this
// order already; this splits a page under its two headings.
export function byHearts(businesses: PlanBusiness[], hearted: Set<string>) {
  const score = (business: PlanBusiness) => business.goesTo.filter((slug) => hearted.has(slug)).length;
  const sorted = [...businesses].sort(
    (a, b) => score(b) - score(a) || Number(!a.price_from_cents) - Number(!b.price_from_cents),
  );
  return { toHearted: sorted.filter((business) => score(business) > 0), rest: sorted.filter((business) => score(business) === 0) };
}
