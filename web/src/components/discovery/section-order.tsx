"use client";

import type { ReactNode } from "react";
import { useTripHere } from "@/components/trips/use-trip-here";

// Which section leads an area page. With a trip shown here (the one the guest chose, or one with
// something in this place; useTripHere) What to book leads, then the places to see; with none
// (signed out, no trip yet, none chosen, or a new trip picked) the places to see lead. A search
// for something to book (`asked`: ?show=, ?q=) always puts What to book first. The server renders
// the no-trip order; it swaps once the session and trips load, with the banner's trip line.
export function SectionOrder({
  asked,
  tripPlaces,
  places,
  listings,
}: {
  asked: boolean;
  tripPlaces: string[];
  places: ReactNode;
  listings: ReactNode;
}) {
  const { trip } = useTripHere(tripPlaces);
  return asked || trip ? (
    <>
      {listings}
      {places}
    </>
  ) : (
    <>
      {places}
      {listings}
    </>
  );
}
