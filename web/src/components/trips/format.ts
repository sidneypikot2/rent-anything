import { formatDateRange } from "@/lib/dates";
import type { Trip } from "./use-trips";

// The date helpers live in lib/dates.ts, shared with the DateRangeField primitive.
export { formatDateRange, isIsoDate, todayIso } from "@/lib/dates";

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

export function itemCount(count: number) {
  return plural(count, "item", "items");
}

export function guestCount(count: number) {
  return plural(count, "guest", "guests");
}

// Rentals and stays are booked for a stretch of days; tours and transfers for one.
export const RANGE_TYPES = new Set(["rental", "stay"]);

// One day: "Oct 17".
export function formatDay(iso: string) {
  return formatDateRange(iso, iso);
}

// A trip's dates and size, where trips are listed to pick from: "Nov 12–15 · 2 items".
export function tripDetails(trip: Trip) {
  return [formatDateRange(trip.starts_on, trip.ends_on) ?? "No dates yet", itemCount(trip.items.length)].join(" · ");
}
