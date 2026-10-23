"use client";

import Link from "next/link";
import { CheckGlyph } from "@/components/discovery/tag-glyphs";
import { currentTrips, useTrips } from "@/components/trips/use-trips";
import { useSession } from "@/lib/auth/session";
import { useHeroTrip } from "./hero-trip";
import { LAUNCH_AREA, START_TRIP } from "./launch-area";

// The line under the home hero's search (RAA-80, RAA-130). A traveller starts a trip with the
// search's own button, so the line says what that costs and, signed out, when the account
// comes; a signed-in guest gets the same note, without a link to their trips, which the header's
// cart already is, so the hero offers one action. Once Where names something that
// isn't a destination the button searches, and the line says how to start a trip instead. With
// Where emptied the button still starts at the launch area, so the line names it.
// A guest with trips planning is asked which one, or a new one, once they press it
// (TripChoiceSheet), and the line says so.
// Partners and admins have no cart: their search's button only searches, and the line is a
// link to their own work.
// Every version is one line of the same height, so when the session has been read (it lives in
// localStorage, so the server and the first paint show the signed-out line) nothing below moves.
const ROWS = {
  partner: { note: "Signed in as a partner", href: "/partner/listings", action: "Your listings" },
  admin: { note: "Signed in as an admin", href: "/admin", action: "Admin console" },
};

const LINE = "flex min-h-5 items-start gap-1.5 text-sm leading-relaxed text-sky-mist";
const TICK = "mt-1 size-4 shrink-0 text-mint";

export function TripStart() {
  const role = useSession()?.user.role;
  const { trip, where } = useHeroTrip();
  const row = role === "partner" || role === "admin" ? ROWS[role] : null;
  const trips = currentTrips(useTrips(role === "guest").data);
  const startsAt = trip && !where ? `Starts on ${LAUNCH_AREA.name}. ` : "";

  if (row) {
    return (
      <p className={LINE}>
        <span className="min-w-0">
          {row.note} <span aria-hidden>·</span>{" "}
          <Link href={row.href} className="font-semibold text-white underline underline-offset-4 hover:text-sky-pale">
            {row.action}
          </Link>
        </span>
      </p>
    );
  }
  if (trips.length > 0 && trip) {
    return (
      // An instruction, not something done: no tick.
      <p aria-live="polite" className={LINE}>
        <span className="min-w-0">
          {startsAt}
          {trips.length === 1
            ? "Next, pick your trip to add to, or start a new one."
            : `Next, pick one of your ${trips.length} trips to add to, or start a new one.`}
        </span>
      </p>
    );
  }
  return (
    <p aria-live="polite" className={LINE}>
      {trip && <CheckGlyph className={TICK} />}
      <span className="min-w-0">
        {trip ? startsAt + (role === "guest" ? START_TRIP.guestNote : START_TRIP.note) : START_TRIP.searchNote}
      </span>
    </p>
  );
}
