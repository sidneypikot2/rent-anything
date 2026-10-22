"use client";

import { useSession } from "@/lib/auth/session";
import { useChosenTrip } from "./chosen-trip";
import { currentTrips, useTrips, type Trip } from "./use-trips";

// The guest's trip on this place's page: the one they chose to work on (on the home page, or
// with the banner's Switch trip; chosen-trip.ts), even with nothing here yet, as their next add
// goes to it; with no choice, the first with something in this place (an item in it or in a
// place inside it), as GET /trips orders them. `has`: the groups (a listing's `group`) the trip
// holds here, which What to book moves to the end; an item its listing can't have
// (`unavailable`) doesn't count. `places` are the page's place and the places inside it. Signed
// out, or not a guest, there is no trip.
export function useTripHere(places: string[]) {
  const session = useSession();
  const isGuest = session?.user.role === "guest";
  const trips = useTrips(isGuest);
  const current = currentTrips(trips.data);
  // "New" from the home page's Start your trip: no trip yet, until its first add.
  const chosen = useChosenTrip();
  const here = (each: Trip) => each.items.some((item) => places.includes(item.area.slug));
  const trip = chosen === "new" ? undefined : (current.find((each) => each.id === chosen) ?? current.find(here));
  const has = new Set<string>(
    trip?.items
      .filter((item) => places.includes(item.area.slug) && !item.unavailable)
      .map((item) => item.listing.group),
  );
  // Items in the guest's other current trips, which the header's cart badge counts too.
  const others = current.filter((each) => each !== trip).reduce((sum, each) => sum + each.items.length, 0);
  return { session, isGuest, trips, current, chosen, trip, has, others };
}
