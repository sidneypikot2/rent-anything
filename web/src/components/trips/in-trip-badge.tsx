"use client";

import { cn } from "@/components/ui/cn";
import { useState } from "react";
import { TickGlyph } from "@/components/discovery/tag-glyphs";
import { Badge } from "@/components/ui/badge";
import { useSession } from "@/lib/auth/session";
import { useChosenTrip, type ChosenTrip } from "./chosen-trip";
import { ItemEditSheet } from "./item-edit-sheet";
import { currentTrips, useTrips, type Trip } from "./use-trips";

// Where a listing sits among the guest's current trips, judged by the trip they're working on
// (chosen-trip.ts: Switch trip, or the home page's Start your trip): "this" when that trip holds
// it, "other" when only another one does, so a second trip's page doesn't read as already having
// it. With no choice, any trip counts as this one, as with one trip. `trip`: the one holding it.
export function useListingInTrip(listingId: number): { where: "this" | "other" | null; trip?: Trip } {
  const trips = useGuestTrips();
  return trips ? whereIs(listingId, trips.current, trips.chosen) : { where: null };
}

// Which of these listings the trip being worked on holds ("this", as useListingInTrip judges it),
// with the trip holding each: a place to see marks itself covered by a tour already in the trip.
export function useListingsInTrip(listingIds: number[]): Map<number, Trip> {
  const trips = useGuestTrips();
  const held = new Map<number, Trip>();
  if (!trips) return held;
  for (const id of listingIds) {
    const { where, trip } = whereIs(id, trips.current, trips.chosen);
    if (where === "this" && trip) held.set(id, trip);
  }
  return held;
}

function useGuestTrips() {
  const session = useSession();
  const isGuest = session?.user.role === "guest";
  const trips = useTrips(isGuest);
  const chosen = useChosenTrip();
  return isGuest ? { current: currentTrips(trips.data), chosen } : null;
}

function whereIs(listingId: number, current: Trip[], chosen: ChosenTrip): { where: "this" | "other" | null; trip?: Trip } {
  const holds = (trip: Trip) => trip.items.some((item) => item.listing.id === listingId);
  const working = chosen === "new" ? "new" : current.find((trip) => trip.id === chosen);
  if (working && working !== "new" && holds(working)) return { where: "this", trip: working };
  const holder = current.find(holds);
  if (!holder) return { where: null };
  return { where: working ? "other" : "this", trip: holder };
}

// "In your trip" on a listing row the trip being worked on already holds: a filled pill in the
// action colour (the soft-UI reference's badges), so the row reads as taken care of while its
// button stays a quiet action (Add another). Held
// only by another trip, a quiet "In another trip" naming it: the guest sees they have it
// somewhere without this trip claiming it. Not yet booked, the badge is "In your trip · Edit",
// opening its days (ItemEditSheet) right on the card.
// White on the primary (lagoon ink on guest pages) is 9.1:1.
// Compact: a status beside the row's tags, never as loud as its button.
const IN_TRIP = "inline-flex min-h-6 items-center gap-1 rounded-full bg-primary px-2.5 text-xs font-semibold text-white";

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
  // Gear is booked by the count: "2 in your trip", every line of it in this trip together.
  const held = trip.items.filter((each) => each.listing.id === listingId);
  const count = held[0]?.listing.group === "gear" ? held.reduce((sum, each) => sum + each.quantity, 0) : 1;
  const label = count > 1 ? `${count} in your trip` : "In your trip";
  if (item)
    return (
      <>
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={() => setEditing(true)}
          data-testid="in-trip-edit"
          className={cn(IN_TRIP, "tap-target z-10 transition-colors hover:bg-primary-hover")}
        >
          <TickGlyph aria-hidden className="size-3" />
          {label} ·<span className="underline underline-offset-2">Edit</span>
        </button>
        {editing && <ItemEditSheet trip={trip} item={item} onClose={() => setEditing(false)} onSaved={() => setEditing(false)} />}
      </>
    );
  return (
    <span data-testid="in-trip" className={IN_TRIP}>
      <TickGlyph aria-hidden className="size-3" />
      {label}
    </span>
  );
}

// A business card with several options shows one badge for all of them, never one per option
// held ("In your trip" three times read as a bug): "3 in your trip" when the trip being worked
// on holds some, otherwise "In another trip" when only another one does. Not a button: a tap
// falls through to the card, whose panel marks each option held with "Add another"; their days
// are edited from the banner's Edit (HereItemsSheet) or in the cart.
export function InTripCount({ listingIds }: { listingIds: number[] }) {
  const trips = useGuestTrips();
  if (!trips) return null;
  const places = listingIds.map((id) => whereIs(id, trips.current, trips.chosen).where);
  const here = places.filter((where) => where === "this").length;
  if (here > 0)
    return (
      <span data-testid="in-trip-count" className={IN_TRIP}>
        <TickGlyph aria-hidden className="size-3" />
        {here} in your trip
      </span>
    );
  if (places.includes("other"))
    return (
      <Badge tone="mist" data-testid="in-other-trip" className="min-h-6 px-2.5 text-xs">
        In another trip
      </Badge>
    );
  return null;
}
