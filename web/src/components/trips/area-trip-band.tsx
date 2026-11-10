"use client";

import Image from "next/image";
import { BAND_PHOTO } from "@/components/landing/sample-photos";
import { PlanTripLink } from "@/components/landing/plan-trip-start";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { useSession } from "@/lib/auth/session";
import { formatDateRange } from "@/lib/dates";
import { useTripHere } from "./use-trip-here";
import type { Trip } from "./use-trips";

// An area page's closing band: the page ends on the trip, as the home page's does (HomeClosing).
// A guest with something in a trip sees it by name and opens it. With nothing saved yet (an empty
// trip, no trip, or signed out) opening the trip led nowhere, so the band offers the home page's
// two ways in instead: Plan a trip, or Book one thing (2026-11-10; it was left out on 2026-11-09
// as a fourth Plan link, but as the page's ending it is the next step, not a repeat). The trip is
// the one the page works on (useTripHere): the one chosen to work on, else the one with something
// here. Partners and admins have no trips, so no band. Until the session and trips are read it
// holds its place, hidden.
export function AreaTripBand({
  places,
  place,
  planHref,
  bookHref,
}: {
  places: string[];
  place: string;
  planHref: string;
  bookHref?: string;
}) {
  const session = useSession();
  const { isGuest, trips, trip } = useTripHere(places);
  if (session && !isGuest) return null;
  const loading = session === undefined || (isGuest && trips.isPending);

  const band = trip && trip.items.length > 0 ? tripBand(trip) : null;
  const title = band?.title ?? (trip ? `Your trip: ${trip.name}` : `Your trip to ${place}`);
  const when = trip && !band ? tripDates(trip) : "";

  // A trip band over a photo (the band token): its button is the white one, as on every band.
  return (
    <section
      aria-label="Your trip"
      data-testid="area-trip-band"
      className={cn(
        "band reveal card-edge relative isolate flex flex-col items-start gap-5 overflow-hidden rounded-frame px-inset py-7 text-white sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:py-10",
        loading && "invisible",
      )}
    >
      <Image src={BAND_PHOTO} alt="" fill sizes="(min-width: 72rem) 72rem, 100vw" className="-z-20 object-cover" />
      <div aria-hidden className="absolute inset-0 -z-10 band-fill" />
      <div>
        <h2 className="font-display text-band leading-[1.1] font-extrabold tracking-tight text-balance">{title}</h2>
        <p className="mt-2 max-w-lede text-pretty text-sky-mist">
          {band?.body ??
            `${when}Nothing saved yet. ${bookHref ? "Plan it with a guide, or book just the one thing you need." : "Pick from what's here, or plan it with a guide."}`}
        </p>
      </div>
      {band ? (
        <ButtonLink href={band.href} variant="paper" arrow data-testid="area-trip-band-open" className="shrink-0 sm:whitespace-nowrap">
          {band.action}
        </ButtonLink>
      ) : (
        <div className="flex w-full flex-wrap gap-3 sm:w-auto sm:shrink-0 sm:flex-nowrap">
          <PlanTripLink href={planHref} places={places} variant="paper" arrow data-testid="area-trip-band-plan" className="max-sm:flex-1 sm:whitespace-nowrap">
            Plan a trip
          </PlanTripLink>
          {bookHref && (
            <ButtonLink href={bookHref} variant="frosted" data-testid="area-trip-band-book" className="max-sm:flex-1 sm:whitespace-nowrap">
              Book one thing
            </ButtonLink>
          )}
        </div>
      )}
    </section>
  );
}

function tripBand(trip: Trip) {
  const count = trip.items.length;
  const saved = count === 1 ? "1 thing saved" : `${count} things saved`;
  const when = tripDates(trip);
  return {
    title: `Your trip: ${trip.name}`,
    body: `${when}${saved}. Keep adding from What to book, then book it all from your trip.`,
    href: `/cart?trip=${trip.id}`,
    action: "View trip",
  };
}

// The trip's dates ahead of what the band says, unless its name already carries them.
function tripDates(trip: Trip) {
  const dates = formatDateRange(trip.starts_on, trip.ends_on);
  return dates && !trip.name.includes(dates) ? `${dates} · ` : "";
}
