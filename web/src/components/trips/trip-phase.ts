import { daysBetween, formatDay, todayIso } from "./format";
import type { Trip } from "./use-trips";

export type TripPhase = "upcoming" | "now" | "past";

// Where a trip is in time, by its dates on the API's day (UTC). An undated trip is still ahead.
export function tripPhase(trip: Trip, today = todayIso()): TripPhase {
  if (!trip.starts_on || !trip.ends_on || trip.starts_on > today) return "upcoming";
  return trip.ends_on < today ? "past" : "now";
}

// "Starts in 12 days", "Day 2 of 4", "Ended Oct 3": the Trips page's word on when (RAA-140).
export function tripTiming(trip: Trip, today = todayIso()) {
  if (!trip.starts_on || !trip.ends_on) return "No dates yet";
  const phase = tripPhase(trip, today);
  if (phase === "past") return `Ended ${formatDay(trip.ends_on)}`;
  if (phase === "now") {
    return `Day ${daysBetween(trip.starts_on, today) + 1} of ${daysBetween(trip.starts_on, trip.ends_on) + 1}`;
  }
  const days = daysBetween(today, trip.starts_on);
  return days === 1 ? "Starts tomorrow" : `Starts in ${days} days`;
}

// A past trip whose every booking has completed went as booked; otherwise it just ended.
export function pastOutcome(trip: Trip) {
  const bookings = trip.items.flatMap((item) => (item.booking ? [item.booking] : []));
  return bookings.length > 0 && bookings.every((booking) => booking.status === "completed") ? "Completed" : "Ended";
}
