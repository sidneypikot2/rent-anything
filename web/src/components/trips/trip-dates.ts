import { localTodayIso } from "@/lib/dates";
import { isIsoDate, todayIso } from "./format";

// The trip dates and guests a destination page carries in its URL
// (/bantayan-island?from=2026-11-12&to=2026-11-15&guests=2), which pre-fill every add.
export type TripDates = { from?: string; to?: string; guests: number };

// Reads them from search params, dropping anything unusable: a half-set or backwards range, one
// already over (by the server's UTC day, as the API checks it), guests outside 1–50. A range under
// way starts today instead, so a trip that began yesterday still fills the search and every add
// with the days it has left, rather than showing no dates at all.
export function readTripDates(params: Record<string, string | string[] | undefined>): TripDates {
  const from = params.from;
  const to = params.to;
  const guests = Number(params.guests);
  const today = todayIso();
  const datesOk = isIsoDate(from) && isIsoDate(to) && from <= to && to >= today;
  return {
    ...(datesOk ? { from: from < today ? today : from, to } : {}),
    guests: Number.isInteger(guests) && guests >= 1 && guests <= 50 ? guests : 1,
  };
}

// The same dates as a query string ("?from=…&to=…&guests=2", or "" when there's nothing to
// carry), for links between pages that add to a trip.
export function tripDatesQuery(dates: TripDates): string {
  const params = new URLSearchParams();
  if (dates.from && dates.to) {
    params.set("from", dates.from);
    params.set("to", dates.to);
  }
  if (dates.guests > 1) params.set("guests", String(dates.guests));
  const query = params.toString();
  return query ? `?${query}` : "";
}

// A link with the trip dates and guests ("?from=…&to=…&guests=2", or "") added to its query,
// before any #hash.
export function withDates(href: string, carry: string) {
  if (!carry) return href;
  const hash = href.indexOf("#");
  const [path, fragment] = hash < 0 ? [href, ""] : [href.slice(0, hash), href.slice(hash)];
  return `${path}${path.includes("?") ? `&${carry.slice(1)}` : carry}${fragment}`;
}

// A trip's own dates and guests as a query, to open a place's page on them (a missing or finished
// range drops out and one under way starts today, as readTripDates does).
// By the traveller's own day too, which can be a day ahead of the API's (Manila is UTC+8), as the
// home hero's search does, so the page never opens on a day that has passed where they are.
export function tripOwnQuery(trip: { starts_on: string | null; ends_on: string | null; guests: number }) {
  const local = localTodayIso();
  const from = trip.starts_on && trip.starts_on < local ? local : trip.starts_on;
  return tripDatesQuery(readTripDates({ from: from ?? undefined, to: trip.ends_on ?? undefined, guests: String(trip.guests) }));
}
