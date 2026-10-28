"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { GROUP_ICON } from "@/components/discovery/categories";
import { KindChip, kindsLine, TRIP_KINDS } from "@/components/trips/trip-needs";
import { readTripDates, tripDatesQuery, withDates } from "@/components/trips/trip-dates";
import type { Trip } from "@/components/trips/use-trips";
import { formatDateRange, guestCount, tripWhen } from "@/components/trips/format";
import { useContinueTrip, type TripItem } from "@/components/trips/use-trips";
import { TripCard } from "./how-it-works";
import { LAUNCH_AREA, tripHref } from "./launch-area";

// The trip beside the home hero's search, from xl (RAA-130 critique): the example trip, until
// the guest has a trip planning with something in it; then their own, so the first screen shows
// one set of dates and guests rather than the example's beside theirs. The session is read after
// hydration, so the server and the first paint show the example (`children`).
export function HeroAside({ children }: { children: ReactNode }) {
  const trip = useContinueTrip();
  if (!trip || trip.items.length === 0) return children;
  const shown = trip.items.slice(0, SHOWN);
  const more = trip.items.length - shown.length;
  return (
    <TripCard
      compact
      title={trip.name}
      details={[trip.starts_on ? tripWhen(trip) : "No dates yet", guestCount(trip.guests)].filter(Boolean).join(" · ")}
      items={shown.map((item) => ({
        key: item.id,
        name: item.listing.title,
        meta: item.area.name,
        when: itemWhen(item),
        icon: item.listing.category,
        group: item.booking_type in GROUP_ICON ? (item.booking_type as keyof typeof GROUP_ICON) : "activity",
      }))}
      needs={<TripKinds trip={trip} />}
      caption={
        <span className="flex items-center justify-between gap-3">
          <span>Your trip{more > 0 && `, and ${more} more`}.</span>
          <Link
            href={tripHref(trip.id)}
            className="-my-3 flex min-h-11 items-center font-semibold text-white underline underline-offset-4 hover:text-sky-pale"
          >
            Open your trip
          </Link>
        </span>
      }
    />
  );
}

// As many as the example shows, so the card is never taller than the search beside it.
const SHOWN = 5;

function itemWhen(item: TripItem) {
  if (!item.starts_on) return "No date";
  return formatDateRange(item.starts_on, item.ends_on ?? item.starts_on) ?? "No date";
}

// The kinds a trip needs (TRIP_KINDS, the chips a place's trip card shows too): each ticked once
// the trip has one, or a link to that section of the trip's place, on its dates, while it lacks
// it. A hint: nothing waits on it.
function TripKinds({ trip }: { trip: Trip }) {
  const has = new Set(trip.items.map((item) => item.listing.group));
  const needs = TRIP_KINDS.map((kind) => ({ kind, done: has.has(kind.group) }));
  const place = trip.items.find((item) => item.destination)?.destination?.slug ?? LAUNCH_AREA.slug;
  const carry = tripDatesQuery(
    readTripDates({ from: trip.starts_on ?? undefined, to: trip.ends_on ?? undefined, guests: String(trip.guests) }),
  );
  return (
    <div className="flex flex-col gap-2 border-t border-glass-edge pt-2.5" data-testid="hero-trip-kinds">
      <p className="text-sm text-sky-mist">{kindsLine(needs)}</p>
      <ul className="flex flex-wrap gap-1.5">
        {needs.map(({ kind, done }) => (
          <li key={kind.group}>
            <KindChip kind={kind} done={done} href={withDates(`/${place}?show=${kind.id}#listings`, carry)} />
          </li>
        ))}
      </ul>
    </div>
  );
}
