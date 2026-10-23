import { formatDateRange } from "@/lib/dates";
import { nightsOf, sleepsOn } from "./beds";
import { todayIso } from "./format";
import type { Trip, TripItem } from "./use-trips";

// What a trip still lacks, said as a hint where the guest is already looking (the place's trip
// line, the cart above Book) and never a step they must finish:
// - nights still ahead with nowhere to sleep, or with beds for fewer than the trip's guests, in
//   runs ("a stay for Apr 7–9"). Only for a dated trip: an undated one says "a place to stay"
//   while it has no stay at all. Stays in any place count, as the trip can sleep anywhere;
// - on a place's page, a way to get there: no transfer here yet, while the place has some.
// Tours, rentals and gear are the guest's choice, never missing.
export type Missing =
  | { kind: "stay"; from: string | null; to: string | null; nights: number; short: number | null }
  | { kind: "transfer" };

export function missingStays(trip: Trip, today = todayIso()): Missing[] {
  const stays = trip.items.filter((item) => isStay(item) && item.starts_on && item.ends_on);
  if (!trip.starts_on || !trip.ends_on) {
    const any = trip.items.some(isStay);
    return any ? [] : [{ kind: "stay", from: null, to: null, nights: 0, short: null }];
  }
  const missing: Missing[] = [];
  let run: { from: string; to: string; nights: number; sleeps: number } | null = null;
  const close = () => {
    if (run && run.sleeps < trip.guests)
      missing.push({ kind: "stay", from: run.from, to: run.to, nights: run.nights, short: run.sleeps === 0 ? null : trip.guests - run.sleeps });
  };
  for (const [night, morning] of nightsOf(trip.starts_on > today ? trip.starts_on : today, trip.ends_on)) {
    const sleeps = sleepsOn(stays, night);
    if (run && run.sleeps === sleeps) {
      run.to = morning;
      run.nights += 1;
    } else {
      close();
      run = { from: night, to: morning, nights: 1, sleeps };
    }
  }
  close();
  return missing;
}

// The trip's gaps from a place's page. `offered`: the groups the place has listings in, so the
// hint only asks for what can be booked here.
export function missingHere(trip: Trip, places: string[], offered: string[], today = todayIso()): Missing[] {
  const stays = offered.includes("stay") ? missingStays(trip, today) : [];
  const transfer =
    offered.includes("transfer") &&
    !trip.items.some((item) => item.listing.group === "transfer" && places.includes(item.area.slug) && !item.unavailable);
  return [...stays, ...(transfer ? [{ kind: "transfer" } as const] : [])];
}

// An item that sleeps someone: a stay its listing can still have.
const isStay = (item: TripItem) => item.booking_type === "stay" && !item.unavailable;

// A gap in words: "a stay for Apr 7–9", "beds for 2 more, Apr 7–9", "a place to stay" (undated),
// "a transfer here".
export function missingText(gap: Missing) {
  if (gap.kind === "transfer") return "a transfer here";
  const range = formatDateRange(gap.from, gap.to);
  if (!range) return "a place to stay";
  return gap.short ? `beds for ${gap.short} more, ${range}` : `a stay for ${range}`;
}

// The page section a gap's link opens on a place's page (What to book's group anchors).
export const missingAnchor = (gap: Missing) => (gap.kind === "transfer" ? "#need-transfer" : "#need-stay");
