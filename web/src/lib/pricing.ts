import type { components } from "@/api/schema";
import { formatPeso } from "./money";

// How listing prices read (RAA-105), for partners and guests alike; plain functions so server
// pages can use them.

export type ChargedPer = components["schemas"]["listing_fee_charged_per"];
type StayRate = components["schemas"]["stay_rate"];
type Fee = { name: string; amount_cents: number; charged_per: ChargedPer };

// What a fee is multiplied by, in the API's words (ListingFee::CHARGED_PER).
export const CHARGED_PER: { value: ChargedPer; label: string }[] = [
  { value: "booking", label: "per booking" },
  { value: "night", label: "per night" },
  { value: "guest", label: "per guest" },
  { value: "guest_night", label: "per guest per night" },
  { value: "unit", label: "per unit" },
];

export function chargedPerLabel(chargedPer: ChargedPer) {
  return CHARGED_PER.find((option) => option.value === chargedPer)?.label ?? chargedPer;
}

// "Cleaning fee ₱500 per booking".
export function feeText(fee: Fee) {
  return `${fee.name} ${formatPeso(fee.amount_cents)} ${chargedPerLabel(fee.charged_per)}`;
}

// The unit after a stay's nightly price: a shared room is priced per guest.
export function nightUnit(perGuest: boolean) {
  return perGuest ? "/ guest / night" : "/ night";
}

// The unit after a listing's "from" price (price_unit): a night of a stay, a private tour's
// whole group or one joiner (RAA-110).
export function priceUnitText(unit: components["schemas"]["price_unit"]) {
  return unit ? { night: "/ night", group: "/ group", person: "/ guest" }[unit] : undefined;
}

// What an unpriced listing says where its price would be: only stays and tours have prices
// yet (RAA-104, RAA-110); a rental or a transfer is booked at a price agreed with the partner
// (Bookings::Price's to_be_agreed). The row says when, as checkout and bookings then say it is
// "to be agreed".
const PRICED_BY: Record<string, string> = {
  transfer: "Price agreed with the partner when you book",
  rental: "Price agreed with the partner when you book",
};

export function pricedByText(bookingType: string) {
  return PRICED_BY[bookingType];
}

// The same, short, on an area page's rows: their section says once what it means (pricedByNote).
export const TO_BE_AGREED = "Price to be agreed";

// An area page section's line over its rows when some have no price: what "to be agreed" means.
export function pricedByNote(bookingType: string) {
  return PRICED_BY[bookingType] ? "No set price yet: you agree it with the partner when you book." : undefined;
}

export function plural(count: number, noun: string) {
  return `${count} ${count === 1 ? noun : `${noun}s`}`;
}

// A stay rate's terms beyond the nightly price, one line each: "Weekends ₱1,500 / night",
// "Up to 2 guests included, then ₱300 per extra guest per night", "10% off 7+ nights",
// "Minimum 2 nights".
export function stayRateTerms(rate: StayRate, perGuest: boolean) {
  const terms: string[] = [];
  if (rate.weekend_price_cents) terms.push(`Fridays and Saturdays ${formatPeso(rate.weekend_price_cents)} ${nightUnit(perGuest)}`);
  // Without an extra-guest fee the price covers everyone the place sleeps, so "up to 1 guest
  // included" would read as a limit beside "Sleeps 2".
  if (!perGuest) {
    terms.push(
      rate.extra_guest_fee_cents
        ? `Up to ${plural(rate.base_guests, "guest")} included, then ${formatPeso(rate.extra_guest_fee_cents)} per extra guest per night`
        : "One price for every guest it sleeps",
    );
  }
  if (rate.weekly_discount_percent) terms.push(`${rate.weekly_discount_percent}% off stays of 7 nights or more`);
  if (rate.monthly_discount_percent) terms.push(`${rate.monthly_discount_percent}% off stays of 28 nights or more`);
  if (rate.min_nights > 1) terms.push(`Minimum ${plural(rate.min_nights, "night")}`);
  if (rate.max_nights) terms.push(`Maximum ${plural(rate.max_nights, "night")}`);
  return terms;
}
