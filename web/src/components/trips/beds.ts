import type { Trip, TripItem } from "./use-trips";

// The guests a trip's stays sleep on one night: each its guests, up to what the place holds.
export function sleepsOn(stays: TripItem[], night: string) {
  return stays
    .filter((stay) => stay.starts_on! <= night && night < stay.ends_on!)
    .reduce((sum, stay) => sum + Math.min(stay.quantity, stay.sleeps ?? stay.quantity), 0);
}

// The guests the trip's stays already sleep on every night from `from` to the morning of `to`
// (its fewest on any one of them), as the needs column counts them.
export function bedsBooked(trip: Trip, from: string, to: string) {
  const stays = trip.items.filter(
    (item) => item.booking_type === "stay" && item.starts_on && item.ends_on && !item.unavailable,
  );
  let fewest: number | null = null;
  for (const [night] of nightsOf(from, to)) {
    const sleeps = sleepsOn(stays, night);
    fewest = fewest === null ? sleeps : Math.min(fewest, sleeps);
  }
  return fewest ?? 0;
}

// Each night from `from` up to the morning of `to`, with the morning after it.
export function nightsOf(from: string, to: string) {
  const nights: [string, string][] = [];
  for (let night = from; night < to; night = nextDay(night)) nights.push([night, nextDay(night)]);
  return nights;
}

function nextDay(iso: string) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}
