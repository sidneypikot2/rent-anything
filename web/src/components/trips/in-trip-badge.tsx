"use client";

import { useState } from "react";
import { TickGlyph } from "@/components/discovery/tag-glyphs";
import { Badge } from "@/components/ui/badge";
import { useSession } from "@/lib/auth/session";
import { useChosenTrip } from "./chosen-trip";
import { ItemDateSheet } from "./item-date-sheet";
import { currentTrips, useTrips, type Trip } from "./use-trips";

// Where a listing sits among the guest's current trips, judged by the trip they're working on
// (chosen-trip.ts: Switch trip, or the home page's Start your trip): "this" when that trip holds
// it, "other" when only another one does, so a second trip's page doesn't read as already having
// it. With no choice, any trip counts as this one, as with one trip. `trip`: the one holding it.
export function useListingInTrip(listingId: number): { where: "this" | "other" | null; trip?: Trip } {
  const session = useSession();
  const isGuest = session?.user.role === "guest";
  const trips = useTrips(isGuest);
  const chosen = useChosenTrip();
  if (!isGuest) return { where: null };
  const current = currentTrips(trips.data);
  const holds = (trip: Trip) => trip.items.some((item) => item.listing.id === listingId);
  const working = chosen === "new" ? "new" : current.find((trip) => trip.id === chosen);
  if (working && working !== "new" && holds(working)) return { where: "this", trip: working };
  const holder = current.find(holds);
  if (!holder) return { where: null };
  return { where: working ? "other" : "this", trip: holder };
}

// "In your trip" on a listing row the trip being worked on already holds: green, as green marks
// trips, so the row reads as taken care of while its button stays an action (Add another). Held
// only by another trip, a quiet "In another trip" naming it: the guest sees they have it
// somewhere without this trip claiming it. Not yet booked, the badge is "In your trip · Edit",
// opening its days (ItemDateSheet) right on the card.
export function InTripBadge({ listingId }: { listingId: number }) {
  const { where, trip } = useListingInTrip(listingId);
  const [editing, setEditing] = useState(false);
  if (!where || !trip) return null;
  if (where === "other")
    return (
      <Badge tone="mist" data-testid="in-other-trip" title={`In ${trip.name}`} className="min-h-6 px-2.5 text-xs">
        In another trip<span className="sr-only">: {trip.name}</span>
      </Badge>
    );
  const item = trip.items.find((each) => each.listing.id === listingId && !each.booking);
  if (item)
    return (
      <>
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={() => setEditing(true)}
          data-testid="in-trip-edit"
          className="tap-target z-10 inline-flex min-h-6 items-center gap-1 rounded-full border border-sage bg-sage px-2.5 text-xs font-semibold text-forest transition-colors hover:border-forest/40"
        >
          <TickGlyph aria-hidden className="size-3.5" />
          In your trip ·<span className="underline underline-offset-2">Edit</span>
        </button>
        {editing && <ItemDateSheet trip={trip} item={item} onClose={() => setEditing(false)} onSaved={() => setEditing(false)} />}
      </>
    );
  return (
    <Badge tone="emerald" data-testid="in-trip" className="min-h-6 px-2.5 text-xs">
      <TickGlyph aria-hidden className="size-3.5" />
      In your trip
    </Badge>
  );
}
