"use client";

import { PlusGlyph } from "@/components/discovery/tag-glyphs";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { useSession } from "@/lib/auth/session";
import { RANGE_TYPES } from "./format";
import type { TripDates } from "./trip-dates";
import { useTripAdd } from "./trip-add-provider";
import { addPreview, type AddListing } from "./add-preview";
import { useListingInTrip } from "./in-trip-badge";
import type { AddPreview } from "./use-trips";

type Props = {
  listing: AddListing;
  dates: TripDates;
  // Filled blue where it is the one action (a side panel's foot), rather than a quiet tint
  // repeated down a list.
  prominent?: boolean;
  // The add sheet's view of the listing when the page words it its own way (the area page's
  // by-line); otherwise built from the listing.
  preview?: AddPreview;
};

// "Add to trip" on a listing (screen 1). The page's dates and guests go with it (a tour or
// transfer takes the first day) into the add sheet, which shows them with the listing to confirm. Trips are for guests: a partner or admin sees nothing. A tint
// pill led by a plus (RAA-125); once the trip being worked on holds it, a quieter "Add another",
// as the row's green InTripBadge says it is in (useListingInTrip; another trip's doesn't count).
export function AddToTripButton({ listing, dates, prominent = false, preview }: Props) {
  const session = useSession();
  const { add, busyListingId } = useTripAdd();
  const isGuest = session?.user.role === "guest";
  const inTrip = useListingInTrip(listing.id).where === "this";
  if (session && !isGuest) return null;

  const range = RANGE_TYPES.has(listing.booking_type);
  const busy = busyListingId === listing.id;

  return (
    <Button
      variant={inTrip ? "soft" : prominent ? "primary" : "tint"}
      size="touch"
      // Never squeezed beside text, but never wider than its row either: at large text sizes
      // its label wraps rather than pushing the page sideways.
      className="max-w-full shrink-0 pl-3"
      data-testid="add-to-trip"
      disabled={session === undefined || busy}
      onClick={() =>
        add({
          listingId: listing.id,
          title: listing.title,
          range,
          bookingType: listing.booking_type,
          startsOn: dates.from,
          endsOn: range ? dates.to : dates.from,
          quantity: dates.guests,
          preview: preview ?? addPreview(listing),
        })
      }
    >
      <span aria-hidden className={cn("flex size-6 items-center justify-center rounded-full text-navy", inTrip ? "bg-mist" : "bg-white/70")}>
        <PlusGlyph className="size-3.5" />
      </span>
      {busy ? "Adding…" : inTrip ? "Add another" : "Add to trip"}
    </Button>
  );
}
