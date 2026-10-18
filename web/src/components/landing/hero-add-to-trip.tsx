"use client";

import { AddToTripButton } from "@/components/trips/add-to-trip-button";
import { readTripDates } from "@/components/trips/trip-dates";
import { useHeroTrip } from "./hero-trip";

type Props = { listing: { id: number; title: string; booking_type: string } };

// Add to trip on the home page's partner listings (RAA-130), with the dates and guests picked in
// the hero's search, as the area page's rows take theirs from its URL. Inside TripAddProvider.
export function HeroAddToTrip({ listing }: Props) {
  const { carry } = useHeroTrip();
  return <AddToTripButton listing={listing} dates={readTripDates(Object.fromEntries(new URLSearchParams(carry)))} />;
}
