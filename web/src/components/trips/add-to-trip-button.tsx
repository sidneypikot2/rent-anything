"use client";

import { PlusGlyph, TickGlyph } from "@/components/discovery/tag-glyphs";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/auth/session";
import { RANGE_TYPES } from "./format";
import type { TripDates } from "./trip-dates";
import { useTripAdd } from "./trip-add-provider";
import { currentTrips, useTrips } from "./use-trips";

type Props = {
  listing: { id: number; title: string; booking_type: string };
  dates: TripDates;
};

// "Add to trip" on a listing (screen 1). The page's dates and guests go with it; a tour or
// transfer takes the first day. Trips are for guests: a partner or admin sees nothing. A tint
// pill led by a plus, or by a tick once it is in a trip (RAA-125).
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
      variant="tint"
      size="touch"
      className="shrink-0 pl-3"
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
      <span aria-hidden className="flex size-6 items-center justify-center rounded-full bg-white/70 text-navy">
        {inTrip ? <TickGlyph className="size-3.5" /> : <PlusGlyph className="size-3.5" />}
      </span>
      {busy ? "Adding…" : inTrip ? "In your trip" : "Add to trip"}
    </Button>
  );
}
