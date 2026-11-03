import { CANCELLATION_POLICY } from "@/components/bookings/cancellation";
import { formatPickupTime, rentalClock } from "@/components/trips/pickup-time";
import { formatDay, itemAmount } from "@/components/trips/format";
import { missingStays } from "@/components/trips/trip-missing";
import type { Trip, TripItem } from "@/components/trips/use-trips";
import { addDays, daysBetween, formatDateRange } from "@/lib/dates";
import { distanceText, heartedSlugs, type PlanLandmark, type PlanPlace, type RowKey } from "./plan-data";

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
  // Hearted places reachable on the day's ride, with their distance from the stay.
  rides: { name: string; far: string | null }[];
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
  const landmarks = new Map(place.landmarks.map((landmark) => [landmark.slug, landmark]));
  const stopsOf = (item: TripItem) =>
    place.landmarks.filter((landmark) => landmark.visitedBy.includes(item.listing.id)).map((landmark) => ({ name: landmark.name, hearted: hearted.has(landmark.slug) }));
  // Hearted places no tour in the trip goes to: somewhere to ride to.
  const reached = new Set(place.landmarks.filter((landmark) => trip.items.some((item) => landmark.visitedBy.includes(item.listing.id))).map((landmark) => landmark.slug));
  const toRide = [...hearted].filter((slug) => !reached.has(slug)).map((slug) => landmarks.get(slug)).filter((landmark): landmark is PlanLandmark => Boolean(landmark));
  let ridesShown = false;
  const offered = new Set<string>(Object.entries(place.counts).filter(([, count]) => count > 0).map(([group]) => group));
  const transfers = trip.items.filter((item) => item.booking_type === "transfer" && item.starts_on);
  const gapsOfStays = trip.own_stay ? [] : missingStays(trip);

  const days: PlanDay[] = Array.from({ length: count }, (_, index) => {
    const date = addDays(first, index);
    const events: DayEvent[] = [];
    const runs: DayRun[] = [];
    let riding = false;
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
          riding = kind === "ride";
          events.push({ ...base, kind, label: kind === "gear" ? "Gear · pickup" : "Ride · pickup", time: out, priced: true, lines: [itemAmount(item), "Back the same day"] });
        } else if (date === from) {
          riding = kind === "ride";
          events.push({
            ...base,
            kind,
            label: item.delivery ? `${kind === "gear" ? "Gear" : "Ride"} · delivered to your stay` : `${kind === "gear" ? "Gear" : "Ride"} · pickup`,
            time: out,
            priced: true,
            lines: [itemAmount(item), `${daysBetween(from, to)} days, back ${formatDay(to)}`, policy].filter((line): line is string => Boolean(line)),
          });
        } else if (date > from && date < to) {
          riding = kind === "ride";
          runs.push({ kind: "ride", text: `${item.listing.title}, day ${daysBetween(from, date) + 1} of ${daysBetween(from, to)}` });
        } else if (date === to) {
          riding = kind === "ride";
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
    const rides = riding && !ridesShown ? toRide.map((landmark) => ({ name: landmark.name, far: distanceText(stay, landmark.location) })) : [];
    if (rides.length > 0) ridesShown = true;
    return { date, title: dayTitle(index, count), events, runs, rides, gaps };
  });
  return days;
}

function dayTitle(index: number, count: number) {
  if (index === 0) return "Arrive";
  if (index === count - 1) return "Go home";
  return "";
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
