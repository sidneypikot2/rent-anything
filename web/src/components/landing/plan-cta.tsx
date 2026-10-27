"use client";

import Image from "next/image";
import { tripWhen } from "@/components/trips/format";
import { withDates } from "@/components/trips/trip-dates";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { useContinueTrip } from "@/components/trips/use-trips";
import { useSession } from "@/lib/auth/session";
import { LAUNCH_AREA, START_TRIP, startTripHref, tripHref } from "./launch-area";
import { useHeroTrip } from "./hero-trip";
import { BAND_PHOTO } from "./sample-photos";

// The home page's closing band (RAA-73). Signed out it ends where the hero began, on starting a
// trip (the account comes with the first thing added, TripAddProvider), as it does for a guest
// with no trip planning; a guest with one is sent back to it by name, as the hero's Continue your
// trip is (RAA-130), so the page's first and last actions agree. Partners and admins have no cart, so since RAA-78 they
// are sent to their own work instead.
// The session lives in localStorage, so until it has been read the signed-out band holds the
// place, hidden: no one sees the wrong band first, and the page doesn't grow when it arrives.
const BANDS = {
  signedOut: {
    title: `Start with ${LAUNCH_AREA.name}`,
    body: "Find the boat, the bike and the bed as you go, and change a date or add a stop whenever plans move.",
    href: startTripHref(LAUNCH_AREA.slug),
    action: START_TRIP.action,
  },
  partner: {
    title: "What travellers can book from you",
    body: "Keep your listings current, or add something new for the season.",
    href: "/partner/listings",
    action: "Your listings",
  },
  admin: {
    title: "Signed in as an admin",
    body: "The team's tools are in the admin console.",
    href: "/admin",
    action: "Open the admin console",
  },
};

export function PlanCta() {
  const session = useSession();
  const role = session?.user.role;
  const continuing = useContinueTrip();
  // Starting a trip here keeps the dates and guests picked in the hero's search.
  const { carry } = useHeroTrip();
  const band =
    role === "partner" || role === "admin"
      ? BANDS[role]
      : continuing
        ? continueBand(continuing)
        : { ...BANDS.signedOut, href: withDates(BANDS.signedOut.href, carry) };

  // A trip band over a photo (the band token): its button is the white one, as on every band.
  return (
    <section
      className={cn(
        "band reveal card-edge relative isolate flex flex-col items-start gap-5 overflow-hidden rounded-frame px-inset py-7 text-white sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:py-10",
        session === undefined && "invisible",
      )}
    >
      <Image src={BAND_PHOTO} alt="" fill sizes="(min-width: 72rem) 72rem, 100vw" className="-z-20 object-cover" />
      <div aria-hidden className="absolute inset-0 -z-10 band-fill" />
      <div>
        {/* Smaller than a section title (RAA-130): a closing line, not a section. */}
        <h2 className="font-display text-band leading-[1.1] font-extrabold tracking-tight text-balance">
          {band.title}
        </h2>
        <p className="mt-2 max-w-lede text-pretty text-sky-mist">{band.body}</p>
      </div>
      <ButtonLink href={band.href} variant="paper" arrow className="shrink-0 sm:whitespace-nowrap">
        {band.action}
      </ButtonLink>
    </section>
  );
}

// Named as the guest's trip, with its dates, so a trip named after its place ("Bantayan Island")
// doesn't read as a band about the place.
function continueBand(trip: NonNullable<ReturnType<typeof useContinueTrip>>) {
  const count = trip.items.length;
  const saved = count === 0 ? "Nothing saved yet" : count === 1 ? "1 thing saved" : `${count} things saved`;
  const dates = tripWhen(trip);
  const when = dates ? `${dates} · ` : "";
  return {
    title: `Your trip: ${trip.name}`,
    body: `${when}${saved}. Change a date, add a stop, or keep browsing above.`,
    href: tripHref(trip.id),
    action: "Open your trip",
  };
}
