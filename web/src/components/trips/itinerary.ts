import { addDays, daysBetween } from "@/lib/dates";
import type { Trip, TripItem } from "./use-trips";

// What an item is doing on a day: a stay's check-in, nights and check-out, a rental's first,
// middle and last day, or a one-day booking's day.
export type ItineraryRole = "check-in" | "night" | "check-out" | "pick-up" | "rental" | "return" | "day";

// What the days read of an item, so a shared trip's items (RAA-178) lay out like the cart's.
// The guests and beds are the cart's only: a shared trip's items don't send them.
export type DayItem = Pick<TripItem, "starts_on" | "ends_on" | "booking_type"> & Partial<Pick<TripItem, "quantity" | "sleeps">>;

export type ItineraryDay<T extends DayItem = TripItem> = {
  date: string;
  entries: { item: T; role: ItineraryRole }[];
  // A stay this night that the others already have beds for: one is likely a mistake. Two
  // stays that only sleep everyone together (a group split across rooms) are not.
  doubleStay: boolean;
};

// Long enough for any real trip; a longer one shows its first weeks.
const MAX_DAYS = 60;

function role(item: DayItem, date: string): ItineraryRole | null {
  const { starts_on: from, ends_on: to } = item;
  if (!from || !to || date < from || date > to) return null;
  if (item.booking_type === "stay") {
    if (date === from) return "check-in";
    return date === to ? "check-out" : "night";
  }
  if (item.booking_type === "rental" && from !== to) {
    if (date === from) return "pick-up";
    return date === to ? "return" : "rental";
  }
  return date === from ? "day" : null;
}

// Sleeps there that night: a stay's check-in and the nights after, not its check-out.
function sleepsThere(entry: { role: ItineraryRole }) {
  return entry.role === "check-in" || entry.role === "night";
}

// The guests a stay sleeps: its guests, up to what the place holds (as beds.ts counts them).
const sleepsIn = (item: DayItem & { quantity: number }) => Math.min(item.quantity, item.sleeps ?? item.quantity);

// Whether one of a night's stays is spare. Without the guests and beds (a shared trip), any
// two stays count.
function doubleStay(stays: DayItem[], guests: number | undefined) {
  if (stays.length < 2) return false;
  if (guests === undefined || stays.some((stay) => stay.quantity === undefined)) return true;
  const sized = stays as (DayItem & { quantity: number })[];
  const beds = sized.reduce((sum, stay) => sum + sleepsIn(stay), 0);
  return sized.some((stay) => beds - sleepsIn(stay) >= guests);
}

// A dated trip day by day (RAA-140), from its first day to its last, each with what happens
// on it, for the cart's Day by day view. Null for an undated trip. Undated items aren't on any
// day; the view lists them apart.
export function itinerary<T extends DayItem = TripItem>(
  trip: Pick<Trip, "starts_on" | "ends_on"> & { guests?: number; items: T[] },
): ItineraryDay<T>[] | null {
  if (!trip.starts_on || !trip.ends_on) return null;
  const length = Math.min(daysBetween(trip.starts_on, trip.ends_on) + 1, MAX_DAYS);
  return Array.from({ length }, (_, index) => {
    const date = addDays(trip.starts_on!, index);
    const entries = trip.items.flatMap((item) => {
      const itemRole = role(item, date);
      return itemRole ? [{ item, role: itemRole }] : [];
    });
    const stays = entries.filter((entry) => entry.item.booking_type === "stay" && sleepsThere(entry));
    return { date, entries, doubleStay: doubleStay(stays.map((entry) => entry.item), trip.guests) };
  });
}

const ROLE_LABEL: Record<Exclude<ItineraryRole, "day">, string> = {
  "check-in": "Check-in",
  night: "Staying",
  "check-out": "Check-out",
  "pick-up": "Pick up",
  rental: "Rented",
  return: "Return",
};

// What an entry is on its day: a one-day booking by its kind ("Tour", "Transfer"), never
// "Booked", which only its booking's status may say: an item in a trip is planned, not booked.
export function roleLabel(role: ItineraryRole, item: Pick<DayItem, "booking_type">) {
  if (role !== "day") return ROLE_LABEL[role];
  return item.booking_type === "activity" ? "Tour" : item.booking_type === "transfer" ? "Transfer" : "On the day";
}
