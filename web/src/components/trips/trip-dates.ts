import { localTodayIso } from "@/lib/dates";
import { isIsoDate, todayIso } from "./format";
import { partyFromGuests } from "./party";

// The trip dates and guests a destination page carries in its URL
// (/bantayan-island?from=2026-11-12&to=2026-11-15&guests=3&children=1), which pre-fill every add.
// `guests` is the whole party; `children` and `infants` are of them, `pets` beside them (RAA-184).
export type TripDates = { from?: string; to?: string; guests: number; children?: number; infants?: number; pets?: number };

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
  const party = Number.isInteger(guests) && guests >= 1 && guests <= 50 ? guests : 1;
  const count = (value: unknown) => {
    const number = Number(value);
    return Number.isInteger(number) && number > 0 && number <= 50 ? number : 0;
  };
  // Children and infants are of the party, which keeps an adult; past that they drop out.
  const children = count(params.children);
  const infants = count(params.infants);
  const young = children + infants < party ? { children, infants } : {};
  const pets = Math.min(count(params.pets), 20);
  return {
    ...(datesOk ? { from: from < today ? today : from, to } : {}),
    guests: party,
    ...Object.fromEntries(Object.entries(young).filter(([, value]) => value > 0)),
    ...(pets > 0 ? { pets } : {}),
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
  for (const key of ["children", "infants", "pets"] as const) if (dates[key]) params.set(key, String(dates[key]));
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
export function tripOwnQuery(trip: {
  starts_on: string | null;
  ends_on: string | null;
  guests: number;
  children?: number;
  infants?: number;
  pets?: number;
}) {
  const local = localTodayIso();
  const from = trip.starts_on && trip.starts_on < local ? local : trip.starts_on;
  return tripDatesQuery(
    readTripDates({
      from: from ?? undefined,
      to: trip.ends_on ?? undefined,
      guests: String(trip.guests),
      children: String(trip.children ?? 0),
      infants: String(trip.infants ?? 0),
      pets: String(trip.pets ?? 0),
    }),
  );
}

// The page's party, adults at least 1.
export function datesParty(dates: TripDates) {
  return partyFromGuests(dates.guests, dates);
}
