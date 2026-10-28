"use client";

import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/auth/session";
import { RANGE_TYPES } from "./format";
import type { TripDates } from "./trip-dates";
import { useTripAdd } from "./trip-add-provider";
import { addPreview, type AddListing } from "./add-preview";
import { useListingInTrip } from "./in-trip-badge";
import type { Room } from "./party";
import type { AddPreview } from "./use-trips";

type Props = {
  listing: AddListing;
  dates: TripDates;
  // The add sheet's view of the listing when the page words it its own way (the area page's
  // by-line); otherwise built from the listing.
  preview?: AddPreview;
  // A stay's rooms and pets as picked beside it (the price card), for the add sheet to start from.
  rooms?: { rooms: Room[]; pets: number };
};

// "Add to trip" on a listing (screen 1). The page's dates and guests go with it (a tour or
// transfer takes the first day) into the add sheet, which shows them with the listing to confirm. Trips are for guests: a partner or admin sees nothing. A filled
// pill with a plus after it, as the soft-UI reference's card action, in a list and a panel's foot alike; once the trip being worked on holds it, a quieter "Add another"
// (a white pill with a teal check), as the row's InTripBadge says it is in (useListingInTrip; another trip's doesn't count).

export function AddToTripButton({ listing, dates, preview, rooms }: Props) {
  const session = useSession();
  const { add, busyListingId } = useTripAdd();
  const isGuest = session?.user.role === "guest";
  const inTrip = useListingInTrip(listing.id).where === "this";
  if (session && !isGuest) return null;

  const range = RANGE_TYPES.has(listing.booking_type);
  const busy = busyListingId === listing.id;

  return (
    <Button
      variant={inTrip ? "soft" : "primary"}
      size="touch"
      glyph={inTrip ? "check" : "plus"}
      // Never squeezed beside text, but never wider than its row either: at large text sizes
      // its label wraps rather than pushing the page sideways.
      className="max-w-full shrink-0"
      data-testid="add-to-trip"
      loading={busy}
      disabled={session === undefined}
      onClick={() =>
        add({
          listingId: listing.id,
          title: listing.title,
          range,
          bookingType: listing.booking_type,
          startsOn: dates.from,
          endsOn: range ? dates.to : dates.from,
          quantity: dates.guests,
          children: dates.children,
          infants: dates.infants,
          pets: rooms ? rooms.pets : dates.pets,
          roomGuests: rooms?.rooms,
          preview: preview ?? addPreview(listing),
        })
      }
    >
      {busy ? "Adding…" : inTrip ? "Add another" : "Add to trip"}
    </Button>
  );
}
