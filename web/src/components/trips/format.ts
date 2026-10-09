import type { Trip } from "./use-trips";

// Trip dates as the API sends them: "YYYY-MM-DD", a calendar day with no time zone.

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function parse(iso: string) {
  return new Date(`${iso}T00:00:00Z`);
}

function format(date: Date, options: Intl.DateTimeFormatOptions) {
  return date.toLocaleDateString("en-US", { timeZone: "UTC", ...options });
}

// "Nov 15", "Nov 12–15", "Nov 30 – Dec 2", with years only when the two differ.
export function formatDateRange(startsOn: string | null | undefined, endsOn: string | null | undefined) {
  if (!startsOn || !endsOn) return null;
  const start = parse(startsOn);
  const end = parse(endsOn);
  if (start.getUTCFullYear() !== end.getUTCFullYear()) {
    const withYear = { month: "short", day: "numeric", year: "numeric" } as const;
    return `${format(start, withYear)} – ${format(end, withYear)}`;
  }
  const first = format(start, { month: "short", day: "numeric" });
  if (startsOn === endsOn) return first;
  if (start.getUTCMonth() === end.getUTCMonth()) return `${first}–${end.getUTCDate()}`;
  return `${first} – ${format(end, { month: "short", day: "numeric" })}`;
}

// Today as the API counts it, the UTC day (trips.md: no app time zone yet), for the date
// pickers' `min` and the URL check, so a date the picker offers is one the API takes.
export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && ISO_DATE.test(value) && !Number.isNaN(parse(value).getTime());
}

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
