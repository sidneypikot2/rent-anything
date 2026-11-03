"use client";

import Link from "next/link";
import { formatDateRange, guestsLabel } from "@/components/trips/format";
import { useTripHere } from "@/components/trips/use-trip-here";
import type { PlanPlace } from "./plan-data";

// The checklist's trip in the plan bar: where (in navy, the line's lead), when and who, with Change
// (back to step 1). Just the place until the trip loads.
export function PlanTripLabel({ place }: { place: PlanPlace }) {
  const { trip } = useTripHere(place.places);
  const rest = [trip && formatDateRange(trip.starts_on, trip.ends_on), trip && guestsLabel(trip.guests)].filter(Boolean).join(" · ");
  return (
    <>
      <span className="text-navy">{place.area.name}</span>
      {rest && <> · {rest}</>}
    </>
  );
}

export function PlanTripChange({ place }: { place: PlanPlace }) {
  const { trip } = useTripHere(place.places);
  if (!trip) return null;
  return (
    <Link
      href={`/plan?trip=${trip.id}&where=${place.area.slug}`}
      className="-my-3 flex min-h-11 shrink-0 items-center text-sm font-semibold text-link underline underline-offset-4"
      data-testid="plan-trip-line"
    >
      Change
    </Link>
  );
}
