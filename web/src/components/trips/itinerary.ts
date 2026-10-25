import { addDays, daysBetween } from "@/lib/dates";
import type { Trip, TripItem } from "./use-trips";

// What an item is doing on a day: a stay's check-in, nights and check-out, a rental's first,
// middle and last day, or a one-day booking's day.
export type ItineraryRole = "check-in" | "night" | "check-out" | "pick-up" | "rental" | "return" | "day";

// What the days read of an item, so a shared trip's items (RAA-178) lay out like the cart's.
export type DayItem = Pick<TripItem, "starts_on" | "ends_on" | "booking_type">;

export type ItineraryDay<T extends DayItem = TripItem> = {
  date: string;
  entries: { item: T; role: ItineraryRole }[];
  // Two stays booked for this night: one is likely a mistake.
  doubleStay: boolean;
};

// Long enough for any real trip; a longer one shows its first weeks.
const MAX_DAYS = 60;

function role(item: DayItem, date: string): ItineraryRole | null {
  const { starts_on: from, ends_on: to } = item;
  if (!from || !to || date < from || date > to) return null;
  if (item.booking_type === "stay") {
    if (date === from) return "check-in";
    return date === to ? "check-out" : "night";
  }
  if (item.booking_type === "rental" && from !== to) {
    if (date === from) return "pick-up";
    return date === to ? "return" : "rental";
  }
  return date === from ? "day" : null;
}

// Sleeps there that night: a stay's check-in and the nights after, not its check-out.
function sleepsThere(entry: { role: ItineraryRole }) {
  return entry.role === "check-in" || entry.role === "night";
}

// A dated trip day by day (RAA-140), from its first day to its last, each with what happens
// on it, for the cart's Day by day view. Null for an undated trip. Undated items aren't on any
// day; the view lists them apart.
export function itinerary<T extends DayItem = TripItem>(
  trip: Pick<Trip, "starts_on" | "ends_on"> & { items: T[] },
): ItineraryDay<T>[] | null {
  if (!trip.starts_on || !trip.ends_on) return null;
  const length = Math.min(daysBetween(trip.starts_on, trip.ends_on) + 1, MAX_DAYS);
  return Array.from({ length }, (_, index) => {
    const date = addDays(trip.starts_on!, index);
    const entries = trip.items.flatMap((item) => {
      const itemRole = role(item, date);
      return itemRole ? [{ item, role: itemRole }] : [];
    });
    const stays = entries.filter((entry) => entry.item.booking_type === "stay" && sleepsThere(entry));
    return { date, entries, doubleStay: stays.length > 1 };
  });
}

export const ROLE_LABEL: Record<ItineraryRole, string> = {
  "check-in": "Check-in",
  night: "Staying",
  "check-out": "Check-out",
  "pick-up": "Pick up",
  rental: "Rented",
  return: "Return",
  day: "Booked",
};
