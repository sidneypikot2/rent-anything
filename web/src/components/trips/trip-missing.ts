import { formatDateRange } from "@/lib/dates";
import { nightsOf, sleepsOn } from "./beds";
import { todayIso } from "./format";
import type { Trip, TripItem } from "./use-trips";

// What a trip still lacks, said as a hint where the guest is already looking (the place's trip
// line, the cart above Book) and never a step they must finish:
// - nights still ahead with nowhere to sleep, or with beds for fewer than the trip's guests (a
//   stay split into rooms sleeps everyone in them, beds.ts), in
//   runs ("a stay for Apr 7–9"). Only for a dated trip: an undated one says "a place to stay"
//   while it has no stay at all. Stays in any place count, as the trip can sleep anywhere;
// - on a place's page, a way to get there: no transfer on the island yet, while it has some
//   (planGaps).
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

// Whether an item covers a kind (a transfer, getting around, a tour, gear) for a place's page:
// it is in the place or one inside it, or, on a town of an island (`island`: the island's slug),
// anywhere on that island — a van to Bantayan Island or a scooter rented in Bantayan town serves
// Santa Fe too, so the island's page and its towns' tick the same kinds.
export function coversHere(item: TripItem, places: string[], island?: string | null) {
  return places.includes(item.area.slug) || Boolean(island && item.destination?.slug === island);
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

// A place to see on the page and the listings that go there (its `visited_by`).
export type Sight = { slug: string; name: string; visitedBy: number[] };

// The kinds of booking the plan asks for by name when the trip has none of them here. A stay is
// asked for by its nights instead (missingStays). Gear counts too (team call pending, 2026-10-28:
// all five kinds count, until the team says otherwise).
export const PLAN_NEEDS = ["transfer", "rental", "activity", "gear"] as const;

// Everything the trip still lacks from a place's page, for the floating "Your plan" panel (the
// banner's "Still missing" links the stays and the transfer, and counts the rest as "N more in
// your plan", so it adds up to the same number):
// - nights with no stay or too few beds (missingStays), when the place has stays;
// - each kind the place offers (PLAN_NEEDS) the trip has nothing of here;
// - items here their listing can't have on their dates (`unavailable`), or with no date yet;
// - tours here taking fewer than the trip's guests (a listing's items on one day added up);
// - once it has a tour here, the places to see tours here go to but none of its tours does.
export type PlanGap =
  | Extract<Missing, { kind: "stay" }>
  | { kind: "need"; group: (typeof PLAN_NEEDS)[number] }
  | { kind: "unavailable"; item: TripItem; reason: string }
  | { kind: "undated"; item: TripItem }
  | { kind: "tour-guests"; item: TripItem; guests: number; short: number }
  | { kind: "unseen"; sights: Sight[] };

// Ideas, not gaps: getting around, things to do and places to see are the guest's choice, so the
// plan offers them but never counts them. Everything else is missing — the same things the
// banner's "Still missing" names (stays, a transfer), plus items here that can't be booked as
// they are. One count everywhere: the banner's phone row and the plan's button.
// Every kind the trip lacks counts (2026-10-28, the checklist's "Still to add: N of 5"); only the
// places to see stay ideas.
export const isIdea = (gap: PlanGap) => gap.kind === "unseen";
export const stillMissing = (gaps: PlanGap[]) => gaps.filter((gap) => !isIdea(gap));

// A gap the checklist names by its kind (Stay, Transfer, Getting around, Tours, Gear), or one to
// fix on an item already in the trip (replace, date, top up its guests).
export const isKindGap = (gap: PlanGap) => gap.kind === "stay" || gap.kind === "need";

// The one count of what the trip still lacks here, said the same on every way in (the banner's
// phone row, its wide card, the plan's button): each kind missing once — several runs of nights
// without a stay are one Stay on the checklist — plus each item to fix. The wide card shows the
// kinds as chips ("Still to add: 1 of 5") and the fixes as "N to fix in your plan", which add up.
export function missingCount(gaps: PlanGap[]) {
  const missing = stillMissing(gaps);
  const stays = missing.some((gap) => gap.kind === "stay") ? 1 : 0;
  return stays + missing.filter((gap) => gap.kind !== "stay").length;
}
export const fixesOf = (gaps: PlanGap[]) => stillMissing(gaps).filter((gap) => !isKindGap(gap));

// The section of What to book (a listing's `group`) that sorts a gap, so what's missing leads it.
export function gapGroup(gap: PlanGap) {
  switch (gap.kind) {
    case "stay":
      return "stay";
    case "need":
      return gap.group;
    case "unseen":
      return "activity";
    default:
      return gap.item.listing.group;
  }
}

// An add the trip already has: the same listing on days that overlap (a stay's nights, the
// others' days), or both with no date yet. The add sheet says so before a second one goes in.
export function sameItem(trip: Trip, listingId: number, from: string | undefined, to: string | undefined) {
  return trip.items.find((item) => {
    if (item.listing.id !== listingId || item.unavailable) return false;
    if (!from || !item.starts_on) return !from && !item.starts_on;
    const ends = item.ends_on ?? item.starts_on;
    const until = to ?? from;
    return item.booking_type === "stay" ? item.starts_on < until && from < ends : item.starts_on <= until && from <= ends;
  });
}

export function planGaps(
  trip: Trip,
  places: string[],
  offered: string[],
  sights: Sight[],
  island?: string | null,
  today = todayIso(),
): PlanGap[] {
  const here = trip.items.filter((item) => places.includes(item.area.slug));
  // A kind counts as had from anywhere on the island (coversHere). An unavailable item counts too:
  // its own row says to find another, so its kind isn't asked twice.
  const has = new Set(trip.items.filter((item) => coversHere(item, places, island)).map((item) => item.listing.group));
  const gaps: PlanGap[] = offered.includes("stay")
    ? missingStays(trip, today).filter((gap): gap is Extract<Missing, { kind: "stay" }> => gap.kind === "stay")
    : [];
  for (const group of PLAN_NEEDS) if (offered.includes(group) && !has.has(group)) gaps.push({ kind: "need", group });
  for (const item of here) {
    if (item.unavailable) gaps.push({ kind: "unavailable", item, reason: item.unavailable });
    else if (!item.starts_on) gaps.push({ kind: "undated", item });
  }
  const tours = here.filter((item) => item.booking_type === "activity" && !item.unavailable);
  const days = new Map<string, TripItem[]>();
  for (const tour of tours) {
    const key = `${tour.listing.id}:${tour.starts_on ?? ""}`;
    days.set(key, [...(days.get(key) ?? []), tour]);
  }
  for (const group of days.values()) {
    // A tour on a day already gone can't take more guests now: nothing to ask for.
    if (group[0].starts_on && group[0].starts_on < today) continue;
    const guests = group.reduce((sum, tour) => sum + tour.quantity, 0);
    if (guests < trip.guests) gaps.push({ kind: "tour-guests", item: group[0], guests, short: trip.guests - guests });
  }
  const booked = new Set(tours.map((tour) => tour.listing.id));
  const unseen = sights.filter((sight) => sight.visitedBy.length > 0 && !sight.visitedBy.some((id) => booked.has(id)));
  if (tours.length > 0 && unseen.length > 0) gaps.push({ kind: "unseen", sights: unseen });
  return gaps;
}
