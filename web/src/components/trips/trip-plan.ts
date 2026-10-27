import { todayIso } from "@/lib/dates";
import { itinerary, type DayItem, type ItineraryDay, type ItineraryRole } from "./itinerary";
import { isIdea, type PlanGap } from "./trip-missing";
import type { Trip, TripItem } from "./use-trips";

// The trip's gaps (planGaps) laid out day by day, for the "Your plan" panel. What spans the trip
// (a stay's nights, a rental) shows once, in a whole-trip strip, with the nights the trip lacks a
// stay for; the days show only what happens on them (pick up, return, check-in and out, tours)
// and what that day lacks. A missing transfer is the Getting here row's. What fits no day
// (undated items, an item off its dates) is listed apart, and the ideas (isIdea: a ride, things
// to do, places to see) last, never as gaps.
// Null for an undated trip: it keeps the plain list.
// What the plan reads of an item: a shared trip's (RAA-178) as well as the cart's.
// Its booking's status comes as `booking` in the cart and `booking_status` on a shared trip.
export type PlanItem = DayItem & Pick<TripItem, "id" | "unavailable"> & {
  listing: Pick<TripItem["listing"], "title" | "cover_photo_url"> & { category?: string };
  area: Pick<TripItem["area"], "slug" | "name">;
  booking?: Pick<NonNullable<TripItem["booking"]>, "status"> | null;
  booking_status?: NonNullable<TripItem["booking"]>["status"] | null;
};
// `past`: the day is over, so the plan shows what it held and asks nothing of it.
export type PlanDay<T extends PlanItem = TripItem> = ItineraryDay<T> & { gaps: PlanGap[]; free: boolean; past: boolean };
export type Throughout<T extends PlanItem = TripItem> = { item: T; from: string; to: string };
export type TripPlan<T extends PlanItem = TripItem> = {
  days: PlanDay<T>[];
  throughout: Throughout<T>[];
  wholeGaps: PlanGap[];
  apart: PlanGap[];
  ideas: PlanGap[];
  hasTransfer: boolean;
  needsTransfer: boolean;
};

// Roles that only say an item runs through a day: shown once in the whole-trip strip instead.
const RUNNING: ItineraryRole[] = ["rental", "night"];

export function tripPlan<T extends PlanItem = TripItem>(
  trip: Pick<Trip, "starts_on" | "ends_on"> & { guests?: number; items: T[] },
  gaps: PlanGap[],
  today = todayIso(),
): TripPlan<T> | null {
  // An item its listing can't have isn't ticked on any day: its gap row says so instead.
  const days = itinerary({ ...trip, items: trip.items.filter((item) => !item.unavailable) });
  if (!days || days.length === 0) return null;
  // Items running through at least one day, from their first day to their last.
  const running = new Set(
    days.flatMap((day) => day.entries.filter((entry) => RUNNING.includes(entry.role)).map((entry) => entry.item.id)),
  );
  const throughout = new Map<number, Throughout<T>>();
  for (const day of days)
    for (const entry of day.entries) {
      if (!running.has(entry.item.id)) continue;
      const known = throughout.get(entry.item.id);
      if (known) known.to = day.date;
      else throughout.set(entry.item.id, { item: entry.item, from: day.date, to: day.date });
    }
  // An item running from the trip's first day to its last is said once, in the whole-trip
  // strip, with its dates: its check-in and check-out (pick-up, return) would only repeat it on
  // the first and last days. One that starts or ends mid-trip keeps those days' lines.
  const first = days[0].date;
  const last = days[days.length - 1].date;
  const whole = new Set([...throughout.values()].filter(({ from, to }) => from === first && to === last).map(({ item }) => item.id));
  const plan: PlanDay<T>[] = days.map((day) => ({
    ...day,
    entries: day.entries.filter((entry) => !RUNNING.includes(entry.role) && !whole.has(entry.item.id)),
    past: day.date < today,
    gaps: [],
    // Nothing to do booked that day: a stay or a rental running through it doesn't fill it.
    free: !day.entries.some((entry) => entry.item.booking_type !== "stay" && entry.item.booking_type !== "rental"),
  }));
  const wholeGaps: PlanGap[] = [];
  const apart: PlanGap[] = [];
  const ideas: PlanGap[] = [];
  let needsTransfer = false;
  for (const gap of gaps) {
    if (isIdea(gap)) ideas.push(gap);
    else if (gap.kind === "need") needsTransfer = true;
    else if (gap.kind === "stay") wholeGaps.push(gap);
    else if (gap.kind === "tour-guests" || gap.kind === "unavailable") {
      const day = plan.find((each) => each.date === gap.item.starts_on);
      if (day) day.gaps.push(gap);
      else apart.push(gap);
    } else apart.push(gap);
  }
  const hasTransfer = trip.items.some((item) => item.booking_type === "transfer" && !item.unavailable);
  return { days: plan, throughout: [...throughout.values()], wholeGaps, apart, ideas, hasTransfer, needsTransfer };
}

// The plan's days as rows: free middle days in a run with nothing on them share one row
// ("Days 3–4"), so an empty stretch reads as one gap, not a list of blanks.
export function dayRows<T extends PlanItem>(days: PlanDay<T>[]) {
  const last = days.length - 1;
  const blank = (index: number) =>
    index > 0 && index < last && days[index].free && days[index].entries.length === 0 && days[index].gaps.length === 0;
  const rows: { start: number; days: PlanDay<T>[] }[] = [];
  days.forEach((day, index) => {
    const previous = rows[rows.length - 1];
    // A day already gone never shares a row with one still ahead, so each row is done or not.
    if (
      previous &&
      blank(index) &&
      blank(previous.start + previous.days.length - 1) &&
      previous.start + previous.days.length === index &&
      previous.days[0].past === day.past
    )
      previous.days.push(day);
    else rows.push({ start: index, days: [day] });
  });
  return rows;
}
