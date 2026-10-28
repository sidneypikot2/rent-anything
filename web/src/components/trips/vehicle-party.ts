import type { components } from "@/api/schema";
import { daysBetween } from "@/lib/dates";

// A rental vehicle's people and how many vehicles they take (RAA-191): the API books
// ceil(people / seats) of its units, or the more the guest chose, up to one each, and never more
// people than the whole fleet seats. These are its words and sums for the booking card, the shop
// pop-up, the add sheet and the cart.

export type ShopListing = components["schemas"]["business_listing"];

// What one of a vehicle category's units is called: "motorbike", "car", "van".
export function vehicleNoun(category: string | undefined, count = 1) {
  const name = (category ?? "").toLowerCase();
  const one = /motor|scooter|bike/.test(name) ? "motorbike" : /van/.test(name) ? "van" : /car/.test(name) ? "car" : "vehicle";
  return count === 1 ? one : `${one}s`;
}

// "Rider + 1" for a 2-seat motorbike, "Seats 5" for anything else.
export function seatsLabel(seats: number, category?: string) {
  return seats === 2 && vehicleNoun(category) === "motorbike" ? "Rider + 1" : `Seats ${seats}`;
}

export function unitsNeeded(people: number, seats: number) {
  return Math.max(1, Math.ceil(people / seats));
}

// The units the people take: at least those they need, at most one each.
export function unitsFor(people: number, seats: number, chosen?: number | null) {
  const needed = unitsNeeded(people, seats);
  return chosen ? Math.max(needed, Math.min(chosen, people)) : needed;
}

// How the people ride: a full vehicle each until those added past the minimum, which carry one.
export function riders(people: number, seats: number, units: number) {
  const solo = Math.min(Math.max(units * seats - people, 0), units);
  const loads = Array.from({ length: units }, (_, index) => (index >= units - solo ? 1 : seats));
  // The last full vehicle takes whoever is left when the people don't fill it.
  let left = people - loads.reduce((sum, load) => sum + load, 0);
  for (let index = units - 1; left < 0 && index >= 0; index--) {
    const take = Math.min(loads[index] - 1, -left);
    loads[index] -= take;
    left += take;
  }
  return loads;
}

export function peopleText(count: number) {
  return `${count} ${count === 1 ? "person" : "people"}`;
}

// "10 people · 5 motorbikes"
export function vehiclePartyText(people: number, units: number, category?: string) {
  return `${peopleText(people)} · ${units} ${vehicleNoun(category, units)}`;
}

// Days a rental is priced for: Nov 3 – Nov 5 is 2 days, a single day is 1.
export function rentalDays(from?: string, to?: string) {
  return from && to ? Math.max(1, daysBetween(from, to)) : 1;
}
