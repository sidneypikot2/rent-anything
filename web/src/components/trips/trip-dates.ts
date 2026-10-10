import { isIsoDate, todayIso } from "./format";

// The trip dates and guests a destination page carries in its URL
// (/bantayan-island?from=2026-11-12&to=2026-11-15&guests=2), which pre-fill every add.
export type TripDates = { from?: string; to?: string; guests: number };

// Reads them from search params, dropping anything unusable: a half-set or backwards
// range, a past date (by the server's UTC day, as the API checks it), guests outside 1–50.
export function readTripDates(params: Record<string, string | string[] | undefined>): TripDates {
  const from = params.from;
  const to = params.to;
  const guests = Number(params.guests);
  const datesOk = isIsoDate(from) && isIsoDate(to) && from <= to && from >= todayIso();
  return {
    ...(datesOk ? { from, to } : {}),
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
