import type { Trip } from "./use-trips";

export type TripPlace = { slug: string; name: string; count: number };

// The places a trip's items are in (each item's destination: the island, or else the town or
// city), in the order the trip reaches them (the API sends items in date order, undated last),
// with how many items each holds. Worked out from the items: a trip stores no places of its own.
export function tripPlaces(trip: Trip): TripPlace[] {
  const places = new Map<string, TripPlace>();
  for (const item of trip.items) {
    const where = item.destination ?? item.area;
    const place = places.get(where.slug) ?? { slug: where.slug, name: where.name, count: 0 };
    place.count += 1;
    places.set(where.slug, place);
  }
  return [...places.values()];
}
