// Calendar days as the API sends them: "YYYY-MM-DD", counted in UTC like todayIso().

const DAY_MS = 86_400_000;

function parse(iso: string) {
  return new Date(`${iso}T00:00:00Z`);
}

export function addDays(iso: string, days: number) {
  return new Date(parse(iso).getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

// Whole days from `from` to `to` (negative when `to` is earlier).
export function daysBetween(from: string, to: string) {
  return Math.round((parse(to).getTime() - parse(from).getTime()) / DAY_MS);
}

function format(iso: string, options: Intl.DateTimeFormatOptions) {
  return parse(iso).toLocaleDateString("en-US", { timeZone: "UTC", ...options });
}

export const shortDate = (iso: string) => format(iso, { month: "short", day: "numeric" });
export const monthYear = (iso: string) => format(iso, { month: "long", year: "numeric" });
export const monthShort = (iso: string) => format(iso, { month: "short" });
export const weekdayLetter = (iso: string) => format(iso, { weekday: "narrow" });
export const dayOfMonth = (iso: string) => parse(iso).getUTCDate();
export const isWeekend = (iso: string) => [0, 6].includes(parse(iso).getUTCDay());

// The days a booking takes, as Booking.days_for does on the server: a stay's dates are
// check-in and check-out, so it takes the nights before check-out; anything else takes its
// last day too. Returns the first day and how many.
export function bookingSpan(stay: boolean, startsOn: string, endsOn: string) {
  return { first: startsOn, count: daysBetween(startsOn, endsOn) + (stay ? 0 : 1) };
}

// A vehicle rental runs 24 hours a day from its pickup (RAA-195), in the area's time: its bar
// starts at the pickup's hour on its first day and ends at the same hour on its return day.
const RENTAL_TIME_ZONE = "Asia/Manila";

// A moment's date and its share of the day, in the area's time: "2026-11-03" and 0.33 for 8:00 AM.
export function rentalMoment(iso: string) {
  const at = new Date(iso);
  const date = at.toLocaleDateString("en-CA", { timeZone: RENTAL_TIME_ZONE });
  const [hour, minute] = at
    .toLocaleTimeString("en-GB", { timeZone: RENTAL_TIME_ZONE, hour: "2-digit", minute: "2-digit", hour12: false })
    .split(":")
    .map(Number);
  return { date, fraction: ((hour % 24) * 60 + minute) / 1440 };
}

// "8:00 AM", in the area's time.
export function rentalTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { timeZone: RENTAL_TIME_ZONE, hour: "numeric", minute: "2-digit" });
}
