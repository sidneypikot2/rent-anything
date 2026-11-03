"use client";

import type { ReactNode } from "react";
import { useTripHere } from "@/components/trips/use-trip-here";

// Which section leads an area page. With a trip shown here (the one the guest chose, or one with
// something in this place; useTripHere) What to book leads, then the places to see; with none
// (signed out, no trip yet, none chosen, or a new trip picked) the places to see lead. A search
// for something to book (`asked`: ?show=, ?q=) always puts What to book first. The server renders
// the no-trip order; it swaps once the session and trips load, with the banner's trip line.
// Getting to know the place (RAA-252) leads while the guest is still deciding: `intro` (What it's
// like) before the places to see and `guide` (when to go, getting here, …) after them; once they
// are booking both come after What to book and the places.
export function SectionOrder({
  asked,
  tripPlaces,
  intro,
  places,
  guide,
  listings,
}: {
  asked: boolean;
  tripPlaces: string[];
  intro?: ReactNode;
  places: ReactNode;
  guide?: ReactNode;
  listings: ReactNode;
}) {
  const { trip } = useTripHere(tripPlaces);
  return asked || trip ? (
    <>
      {listings}
      {places}
      {intro}
      {guide}
    </>
  ) : (
    <>
      {intro}
      {places}
      {guide}
      {listings}
    </>
  );
}
