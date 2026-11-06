import { CANCELLATION_POLICY } from "@/components/bookings/cancellation";
import { formatPickupTime, rentalClock } from "@/components/trips/pickup-time";
import { formatDay, itemAmount } from "@/components/trips/format";
import { missingStays } from "@/components/trips/trip-missing";
import type { Trip, TripItem } from "@/components/trips/use-trips";
import { addDays, daysBetween, formatDateRange } from "@/lib/dates";
import { accessLine, distanceText, heartedSlugs, picksHere, rowItems, type PlanLandmark, type PlanPlace, type RowKey } from "./plan-data";

// One thing that happens on a day of the review (A6), at its time when the trip knows it:
// a stay's check-in and check-out, a ride's pickup (or delivery) and return (or pick-up), a
// transfer, a tour or each day of a several-day one. `priced`: the line that carries its price.
export type DayEvent = {
  item: TripItem;
  kind: "stay" | "ride" | "transfer" | "tour" | "gear";
  label: string;
  time: string | null;
  lines: string[];
  priced: boolean;
  // The places to see it goes to, hearted ones marked.
  stops: { name: string; hearted: boolean }[];
};

// What runs through a day without happening on it: "Night 2 of 3 · Kota Beach Resort".
export type DayRun = { text: string; kind: "stay" | "ride" | "tour" };

// Something the trip still lacks on a day, with the checklist row that fixes it.
export type DayGap = { text: string; row: RowKey; idea?: boolean };

export type PlanDay = {
  date: string;
  title: string;
  events: DayEvent[];
  runs: DayRun[];
  // Picks the guest means to reach themselves on this day.
  own: PickStatus[];
  gaps: DayGap[];
};

const nightsWord = (count: number) => `${count} ${count === 1 ? "night" : "nights"}`;

// The tour's length in days: a "days" duration, else one.
function tourDays(item: TripItem) {
  return item.tour_length?.unit === "days" ? Math.max(1, item.tour_length.value) : 1;
}

// A dated trip day by day for the review, from its first day to its last, each with what
// happens and when, what runs through it, and what it still lacks. Null for an undated trip.
export function planDays(trip: Trip, place: PlanPlace, stay: { lat: number; lng: number } | null): PlanDay[] | null {
  if (!trip.starts_on || !trip.ends_on) return null;
  const first = trip.starts_on;
  const last = trip.ends_on;
  const count = Math.min(daysBetween(first, last) + 1, 60);
  const hearted = heartedSlugs(trip);
  const stopsOf = (item: TripItem) =>
    place.landmarks.filter((landmark) => landmark.visitedBy.includes(item.listing.id)).map((landmark) => ({ name: landmark.name, hearted: hearted.has(landmark.slug) }));
  const statuses = pickStatuses(trip, place, stay);
  // Places a tour in the trip goes to, which a free day's ideas leave out.
  const reached = new Set(place.landmarks.filter((landmark) => trip.items.some((item) => landmark.visitedBy.includes(item.listing.id))).map((landmark) => landmark.slug));
  const offered = new Set<string>(Object.entries(place.counts).filter(([, count]) => count > 0).map(([group]) => group));
  const transfers = trip.items.filter((item) => item.booking_type === "transfer" && item.starts_on);
  const gapsOfStays = trip.own_stay ? [] : missingStays(trip);

  const days: PlanDay[] = Array.from({ length: count }, (_, index) => {
    const date = addDays(first, index);
    const events: DayEvent[] = [];
    const runs: DayRun[] = [];
    for (const item of trip.items) {
      const from = item.starts_on;
      const to = item.ends_on ?? from;
      if (!from || !to) continue;
      const policy = CANCELLATION_POLICY[item.cancellation_policy]?.name;
      const base = { item, stops: [] as DayEvent["stops"] };
      if (item.booking_type === "stay") {
        const nights = daysBetween(from, to);
        if (date === from)
          events.push({ ...base, kind: "stay", label: "Stay · check in", time: null, priced: true, lines: [`${nightsWord(nights)}, to ${formatDay(to)}`, itemAmount(item), policy].filter((line): line is string => Boolean(line)) });
        else if (date > from && date < to) runs.push({ kind: "stay", text: `Night ${daysBetween(from, date) + 1} of ${nights} · ${item.listing.title}` });
        else if (date === to) events.push({ ...base, kind: "stay", label: "Stay · check out", time: null, priced: false, lines: [] });
        continue;
      }
      if (item.booking_type === "rental") {
        const kind = item.listing.group === "gear" ? "gear" : "ride";
        // A rental runs 24 hours a day from its pickup, so it is back at the time it went out;
        // with no time picked, the shop's default is the return's clock.
        const clock = item.pickup_time ?? (item.returns_at ? rentalClock(item.returns_at) : null);
        const out = clock ? formatPickupTime(clock) : null;
        if (from === to && date === from) {
          events.push({ ...base, kind, label: kind === "gear" ? "Gear · pickup" : "Ride · pickup", time: out, priced: true, lines: [itemAmount(item), `1 day, back ${formatDay(addDays(from, 1))}`] });
        } else if (date === from) {
          events.push({
            ...base,
            kind,
            label: item.delivery ? `${kind === "gear" ? "Gear" : "Ride"} · delivered to your stay` : `${kind === "gear" ? "Gear" : "Ride"} · pickup`,
            time: out,
            priced: true,
            lines: [itemAmount(item), `${daysBetween(from, to)} days, back ${formatDay(to)}`, policy].filter((line): line is string => Boolean(line)),
          });
        } else if (date > from && date < to) {
          runs.push({ kind: "ride", text: `${item.listing.title}, day ${daysBetween(from, date) + 1} of ${daysBetween(from, to)}` });
        } else if (date === to) {
          events.push({
            ...base,
            kind,
            label: item.return_pickup ? `${kind === "gear" ? "Gear" : "Ride"} · picked up from your stay` : `${kind === "gear" ? "Gear" : "Ride"} · return`,
            time: out,
            priced: false,
            lines: [],
          });
        }
        continue;
      }
      if (item.booking_type === "transfer") {
        if (date === from)
          events.push({ ...base, kind: "transfer", label: "Transfer", time: item.pickup_time ? formatPickupTime(item.pickup_time) : null, priced: true, lines: [itemAmount(item), policy].filter((line): line is string => Boolean(line)) });
        continue;
      }
      // A tour: on its day, or each day of a several-day one.
      const length = tourDays(item);
      const day = daysBetween(from, date);
      if (day < 0 || day >= length) continue;
      const hours = item.tour_length?.unit === "hours" ? `About ${item.tour_length.value} ${item.tour_length.value === 1 ? "hour" : "hours"}` : null;
      events.push({
        ...base,
        kind: "tour",
        label: length === 1 ? "Tour" : day === length - 1 ? `Tour · last day (${day + 1} of ${length})` : `Tour · day ${day + 1} of ${length}`,
        time: null,
        priced: day === 0,
        lines: day === 0 ? [itemAmount(item), hours, length > 1 ? `Ends ${formatDay(addDays(from, length - 1))}` : null, policy].filter((line): line is string => Boolean(line)) : [],
        stops: day === 0 ? stopsOf(item) : [],
      });
    }
    // The order things happen in a day: arrivals, rides out, tours, then returns and check-out.
    const order = (event: DayEvent) =>
      event.label.includes("check out") ? 5 : event.label.includes("return") || event.label.includes("picked up") ? 4 : event.kind === "transfer" ? 0 : event.kind === "stay" ? 1 : event.kind === "tour" ? 3 : 2;
    events.sort((a, b) => order(a) - order(b) || (a.time ?? "").localeCompare(b.time ?? ""));

    const gaps: DayGap[] = [];
    if (index === 0 && offered.has("transfer") && transfers.length === 0) gaps.push({ text: "No ride here yet", row: "transfer" });
    if (index === count - 1 && count > 1 && offered.has("transfer") && !transfers.some((item) => item.starts_on === last))
      gaps.push({ text: "No ride back yet", row: "transfer" });
    for (const gap of gapsOfStays)
      if (gap.kind === "stay" && gap.from === date)
        gaps.push({ text: gap.short ? `Beds for ${gap.short} more, ${formatDateRange(gap.from, gap.to)}` : `Nowhere to sleep yet, ${formatDateRange(gap.from, gap.to)}`, row: "stay" });
    const busy = events.some((event) => event.kind === "tour" || event.kind === "ride" || event.kind === "transfer") || runs.some((run) => run.kind !== "stay");
    if (!busy && index > 0 && index < count - 1 && offered.has("activity")) {
      const ideas = place.landmarks.filter((landmark) => !reached.has(landmark.slug)).slice(0, 2).map((landmark) => landmark.name);
      gaps.push({ text: ideas.length > 0 ? `A free day. Ideas: ${ideas.join(", ")}` : "A free day", row: "activity", idea: true });
    }
    const own = statuses.filter((pick) => pick.state === "own" && pick.day === date);
    return { date, title: dayTitle(index, count), events, runs, own, gaps };
  });
  return days;
}

// A place on the review's list and how the guest means to see it (RAA-263). A tour in the trip
// covers a pick by stopping there; `own` and `skip` are the guest's own say, kept on the trip. A
// rental never decides any of it: it only makes `own` a way to go. `added` isn't a pick: a tour
// in the trip stops there, and `tour` names which.
export type PickState = "open" | "own" | "tour" | "skip" | "added";
export type PickStatus = {
  slug: string;
  name: string;
  landmark: PlanLandmark;
  state: PickState;
  line: string | null;
  // The saved place's id, for its plan; none for an `added` place.
  savedId: number | null;
  hasPlan: boolean;
  // `own`: the day chosen, and whether a ride of the guest's covers it.
  day: string | null;
  noRide: boolean;
  tour: TripItem | null;
};

const PICK_ORDER: Record<PickState, number> = { open: 0, own: 1, tour: 2, skip: 3, added: 4 };

// The trip's picks here, and the places its tours add, what still needs a plan first. On no day in
// particular, so an undated trip has them too. An indicator, never a gap that says the plan isn't
// ready: where to go beyond a bed and a way there is the guest's choice. A day the trip's dates
// have since moved away from no longer counts, so that pick goes back to undecided.
export function pickStatuses(trip: Trip, place: PlanPlace, stay: { lat: number; lng: number } | null): PickStatus[] {
  const rides = rowItems(trip, "rental", place);
  const tourTo = (landmark: PlanLandmark) => trip.items.find((item) => !item.unavailable && landmark.visitedBy.includes(item.listing.id));
  const inTrip = (day: string) => Boolean(trip.starts_on && trip.ends_on && day >= trip.starts_on && day <= trip.ends_on);
  const picks = picksHere(trip, place).map((landmark): PickStatus => {
    const saved = trip.saved_landmarks.find((each) => each.slug === landmark.slug);
    const base = { slug: landmark.slug, name: landmark.name, landmark, savedId: saved?.id ?? null, hasPlan: Boolean(saved?.plan), day: null, noRide: false, tour: null };
    if (saved?.plan === "skip") return { ...base, state: "skip", line: "Not on this trip" };
    if (saved?.plan === "own" && saved.visit_on && inTrip(saved.visit_on)) {
      const day = saved.visit_on;
      const noRide = !rides.some((item) => item.starts_on && item.starts_on <= day && (item.ends_on ?? item.starts_on) >= day);
      const far = distanceText(stay, landmark.location);
      return { ...base, state: "own", day, noRide, line: noRide ? "No ride that day yet" : far && `${far} from your stay` };
    }
    const tour = tourTo(landmark);
    if (tour) return { ...base, state: "tour", tour, line: tour.listing.title };
    return { ...base, state: "open", line: accessLine(landmark, { stay, port: place.port?.location ?? null }) };
  });
  const hearted = heartedSlugs(trip);
  const added = place.landmarks.flatMap((landmark): PickStatus[] => {
    const tour = hearted.has(landmark.slug) ? undefined : tourTo(landmark);
    if (!tour) return [];
    return [{ slug: landmark.slug, name: landmark.name, landmark, state: "added", tour, line: `Not one of your picks · comes with ${tour.listing.title}`, savedId: null, hasPlan: false, day: null, noRide: false }];
  });
  return [...picks, ...added].sort((a, b) => PICK_ORDER[a.state] - PICK_ORDER[b.state]);
}

function dayTitle(index: number, count: number) {
  if (index === 0) return "Arrive";
  if (index === count - 1) return "Go home";
  return "";
}

// "Sat, Nov 7": a day to choose or to name on its own, away from the days' rail.
export function dayLabel(iso: string) {
  const { weekday, day, month } = dayParts(iso);
  return `${weekday}, ${month} ${day}`;
}

// "Fri 21" and "Nov" for a day's rail.
export function dayParts(iso: string) {
  const date = new Date(`${iso}T00:00:00Z`);
  return {
    weekday: date.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }),
    day: date.getUTCDate(),
    month: date.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }),
  };
}
