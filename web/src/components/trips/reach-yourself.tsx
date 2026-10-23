"use client";

import { distanceKm, type LatLng } from "@/lib/geo";
import { useTripHere } from "./use-trip-here";

// A place to see no tour goes to is still a place to go: most of Bantayan is a scooter or trike
// ride. On the trip's rental when it has one; straight-line distance from its stay here when it has
// one (its listing's point, rounded to about 1 km by the API, so "about").
export function ReachYourself({
  location,
  places,
  stays,
}: {
  location: LatLng;
  places: string[];
  // The page's stay listings' points, by listing id.
  stays: Record<number, LatLng>;
}) {
  const { trip } = useTripHere(places);
  const stay = trip?.items.find((item) => item.booking_type === "stay" && stays[item.listing.id]);
  const km = stay ? distanceKm(stays[stay.listing.id], location) : null;
  const rental = trip?.items.some((item) => item.booking_type === "rental" && !item.unavailable);
  const how = rental ? "ride there on your rental" : "reach it by scooter or trike";
  const far = km === null ? "" : ` · about ${Math.round(km)} km from your stay`;
  return (
    <span className="-my-1 flex min-h-11 items-center text-sm text-sky-mist" data-testid="reach-yourself">
      No tour yet: {km !== null && km < 1 ? "a short walk from your stay" : `${how}${far}`}
    </span>
  );
}
