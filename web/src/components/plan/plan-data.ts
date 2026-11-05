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
  // Its tags, for the places step's chips and its details.
  tags: { slug: string; name: string }[];
  // The team's pick of what not to miss.
  mustSee: boolean;
  // Where its boats leave from; set on a place reached by boat tour only.
  boatDeparture: LatLng | null;
};
export type PlanPlace = {
  area: { slug: string; name: string };
  // Its kind (`island` says "side of the island").
  kind: string;
  // The port guests arrive at, when the team set one.
  port: { name: string; location: LatLng } | null;
  // The towns inside it, for saying where the picks cluster.
  towns: { name: string; center: LatLng }[];
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

// A step of the checklist: Places to see, then the rows. Places to see holds no listings, so it
// isn't a row: it only shows where a place has some, and leads (`places-to-see-first.pdf`).
export type StepKey = "places" | RowKey;
export type PlanStepRow = { key: StepKey; title: string; idle: string };
export const PLACES_ROW: PlanStepRow = { key: "places", title: "Places to see", idle: "Heart a few. We'll find a stay near them and tours that go there." };

// The places step's chips, each the tags that count as it and the tag whose icon marks its places
// on the map.
export const VIBES: { label: string; tags: string[]; icon: string }[] = [
  { label: "Beaches", tags: ["white-sand", "sandbar"], icon: "white-sand" },
  { label: "Snorkel & dive", tags: ["snorkelling", "freediving"], icon: "snorkelling" },
  { label: "Caves", tags: ["cave-pool"], icon: "cave-pool" },
  { label: "Nature", tags: ["flower-garden"], icon: "flower-garden" },
  { label: "Heritage", tags: ["history", "religious", "architecture", "culture"], icon: "history" },
  { label: "Food", tags: ["food"], icon: "food" },
];

export const vibeHas = (vibe: (typeof VIBES)[number], landmark: Pick<PlanLandmark, "tags">) =>
  landmark.tags.some((tag) => vibe.tags.includes(tag.slug));

// A place's map icon: its first chip's, else an empty slug, which is the plain map pin.
export function placeIcon(landmark: Pick<PlanLandmark, "tags">) {
  return VIBES.find((vibe) => vibeHas(vibe, landmark))?.icon ?? "";
}

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

// The trip's picks here: its hearted places that are in this place, in the place's own order.
export function picksHere(trip: Trip, place: Pick<PlanPlace, "landmarks">) {
  const hearted = heartedSlugs(trip);
  return place.landmarks.filter((landmark) => hearted.has(landmark.slug));
}

// Where a guest sets off for a place: its boats for a boat-only one, else the place itself.
const setOffPoint = (landmark: PlanLandmark) => landmark.boatDeparture ?? landmark.location;

const toursText = (count: number) => `${count} ${count === 1 ? "tour goes" : "tours go"} here`;

// How to get to a place, in one line: "Boat tour only · 6 tours go here", "Own ride · 2.1 km from
// the port", "Own ride · 3.4 km · 4 tours go here". From the guest's stay once there is one.
export function accessLine(landmark: PlanLandmark, { stay, port }: { stay: LatLng | null; port: LatLng | null }) {
  const tours = landmark.visitedBy.length;
  const tourText = tours > 0 ? toursText(tours) : null;
  if (landmark.boatDeparture) return ["Boat tour only", tourText].filter(Boolean).join(" · ");
  const fromStay = distanceText(stay, landmark.location);
  const fromPort = distanceText(port, landmark.location);
  const far = fromStay ? `${fromStay} from your stay` : fromPort && (tours > 0 ? fromPort : `${fromPort} from the port`);
  return ["Own ride", far, tourText].filter(Boolean).join(" · ");
}

// What a stay's card says of a pick: "1.5 km to Ogtong Cave", "Under 500 m to the Virgin Island
// boats". The API gives half kilometres (an exact point stays private).
export function nearText(km: number, landmark: PlanLandmark) {
  const distance = km === 0 ? "Under 500 m" : `${km} km`;
  return `${distance} to ${landmark.boatDeparture ? `the ${landmark.name} boats` : landmark.name}`;
}

const TOWN_KM = 6;
const CENTRE_KM = 2;
const COMPASS = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"];

// Where the picks cluster, so the guest sees where to stay without reading the map: near a town
// when over half are within reach of it, else on an island its compass side. Null with fewer than
// two picks, or when they spread too evenly to say.
export function picksSide(picks: PlanLandmark[], place: Pick<PlanPlace, "kind" | "towns" | "center">) {
  const points = picks.flatMap((pick) => setOffPoint(pick) ?? []);
  if (points.length < 2) return null;
  const towns = place.towns
    .map((town) => ({ town, count: points.filter((point) => distanceKm(point, town.center) <= TOWN_KM).length }))
    .sort((a, b) => b.count - a.count);
  if (towns[0] && towns[0].count > points.length / 2) return `Most of your picks are near ${towns[0].town.name}`;
  if (place.kind !== "island" || !place.center) return null;
  const middle = {
    lat: points.reduce((sum, point) => sum + point.lat, 0) / points.length,
    lng: points.reduce((sum, point) => sum + point.lng, 0) / points.length,
  };
  if (distanceKm(place.center, middle) < CENTRE_KM) return null;
  const bearing = (Math.atan2(middle.lng - place.center.lng, middle.lat - place.center.lat) * 180) / Math.PI;
  return `Most of your picks are on the ${COMPASS[Math.round((bearing + 360) / 45) % 8]} side`;
}

const FAR_APART_KM = 10;

// How far apart the two furthest picks are, when no stay can be close to both; else null.
export function picksApartKm(picks: PlanLandmark[]) {
  const points = picks.flatMap((pick) => setOffPoint(pick) ?? []);
  const widest = Math.max(0, ...points.flatMap((a, index) => points.slice(index + 1).map((b) => distanceKm(a, b))));
  return widest > FAR_APART_KM ? Math.round(widest) : null;
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
