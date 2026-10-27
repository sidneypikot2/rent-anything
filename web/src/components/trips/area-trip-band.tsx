"use client";

import Image from "next/image";
import { BAND_PHOTO } from "@/components/landing/sample-photos";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { useSession } from "@/lib/auth/session";
import { formatDateRange } from "@/lib/dates";
import { useTripHere } from "./use-trip-here";
import type { Trip } from "./use-trips";

// An area page's closing band: the page ends on the trip, as the home page's does (PlanCta).
// A guest with a trip sees it by name, with what is in it, and opens it; signed out, or with no
// trip yet, the band sends them back up to What to book, where the trip starts. The trip is the
// one AreaHero shows (useTripHere): the one chosen to work on, else the one with something here.
// Partners and admins have no trips, so no band. Until the session is read the signed-out band
// holds the place, hidden, so the page doesn't grow when it arrives.
export function AreaTripBand({ areaName, places }: { areaName: string; places: string[] }) {
  const session = useSession();
  const { isGuest, trips, trip } = useTripHere(places);
  if (session && !isGuest) return null;

  const band = trip ? tripBand(trip) : {
    title: `Plan your ${areaName} trip`,
    body: "Pick the boat, the bike and the bed from What to book. They go into one trip, with your dates and guests.",
    href: "#listings",
    action: "Choose what to book",
  };

  // A trip band over a photo (the band token): its button is the white one, as on every band.
  return (
    <section
      aria-label="Your trip"
      data-testid="area-trip-band"
      className={cn(
        "band reveal card-edge relative isolate flex flex-col items-start gap-5 overflow-hidden rounded-frame px-inset py-7 text-white sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:py-10",
        (session === undefined || (isGuest && trips.isPending)) && "invisible",
      )}
    >
      <Image src={BAND_PHOTO} alt="" fill sizes="(min-width: 72rem) 72rem, 100vw" className="-z-20 object-cover" />
      <div aria-hidden className="absolute inset-0 -z-10 band-fill" />
      <div>
        <h2 className="font-display text-band leading-[1.1] font-extrabold tracking-tight text-balance">{band.title}</h2>
        <p className="mt-2 max-w-lede text-pretty text-sky-mist">{band.body}</p>
      </div>
      <ButtonLink href={band.href} variant="paper" arrow className="shrink-0 sm:whitespace-nowrap">
        {band.action}
      </ButtonLink>
    </section>
  );
}

function tripBand(trip: Trip) {
  const count = trip.items.length;
  const saved = count === 0 ? "Nothing saved yet" : count === 1 ? "1 thing saved" : `${count} things saved`;
  const dates = formatDateRange(trip.starts_on, trip.ends_on);
  const when = dates && !trip.name.includes(dates) ? `${dates} · ` : "";
  return {
    title: `Your trip: ${trip.name}`,
    body: `${when}${saved}. Keep adding from What to book, then book it all from your trip.`,
    href: `/cart?trip=${trip.id}`,
    action: "View trip",
  };
}
