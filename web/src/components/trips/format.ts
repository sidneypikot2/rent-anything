import { formatDateRange } from "@/lib/dates";
import type { Trip } from "./use-trips";

// The date helpers live in lib/dates.ts, shared with the DateRangeField primitive.
export { addDays, daysBetween, formatDateRange, isIsoDate, todayIso } from "@/lib/dates";

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

export function itemCount(count: number) {
  return plural(count, "item", "items");
}

export function guestCount(count: number) {
  return plural(count, "guest", "guests");
}

// "4 things": a trip's items, as a guest reads them.
export function thingCount(count: number) {
  return plural(count, "thing", "things");
}

// The guests the search and the area page's trip add with: "Just me", the search's own word for
// one, so the search bar, its sheet and the trip agree.
export function guestsLabel(count: number) {
  return count === 1 ? "Just me" : `${count} guests`;
}

// Rentals and stays are booked for a stretch of days; tours and transfers for one.
export const RANGE_TYPES = new Set(["rental", "stay"]);

// A stay's dates are check-in and check-out, so it needs a night between them; a rental can
// be one day.
export function noNightError(bookingType: string | undefined, from: string, to: string) {
  return bookingType === "stay" && from && to && to <= from ? "Check out at least a day after check-in" : undefined;
}

// One day: "Oct 17".
export function formatDay(iso: string) {
  return formatDateRange(iso, iso);
}

// A trip's dates and size, where trips are listed to pick from: "Nov 12–15 · 2 items".
export function tripDetails(trip: Trip) {
  return [formatDateRange(trip.starts_on, trip.ends_on) ?? "No dates yet", itemCount(trip.items.length)].join(" · ");
}
