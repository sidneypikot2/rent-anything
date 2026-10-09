"use client";

import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/auth/session";
import type { TripDates } from "./trip-dates";
import { useTripAdd } from "./trip-add-provider";
import { currentTrips, useTrips } from "./use-trips";

type Props = {
  listing: { id: number; title: string; booking_type: string };
  dates: TripDates;
};

// Rentals and stays are booked for a stretch of days; tours and transfers for one.
const RANGE_TYPES = new Set(["rental", "stay"]);

// "Add to trip" on a listing (screen 1). The page's dates and guests go with it; a tour or
// transfer takes the first day. Trips are for guests: a partner or admin sees nothing.
export function AddToTripButton({ listing, dates }: Props) {
  const session = useSession();
  const { add, busyListingId } = useTripAdd();
  const isGuest = session?.user.role === "guest";
  const trips = useTrips(isGuest);
  if (session && !isGuest) return null;

  const range = RANGE_TYPES.has(listing.booking_type);
  const inTrip = currentTrips(trips.data).some((trip) => trip.items.some((item) => item.listing.id === listing.id));
  const busy = busyListingId === listing.id;

  return (
    <Button
      variant="soft"
      size="sm"
      data-testid="add-to-trip"
      disabled={session === undefined || busy}
      onClick={() =>
        add({
          listingId: listing.id,
          title: listing.title,
          range,
          startsOn: dates.from,
          endsOn: range ? dates.to : dates.from,
          quantity: dates.guests,
        })
      }
    >
      {busy ? "Adding…" : inTrip ? "✓ In your trip" : "Add to trip"}
    </Button>
  );
}
