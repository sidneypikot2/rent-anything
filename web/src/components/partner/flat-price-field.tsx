"use client";

import { Field } from "@/components/ui/field";
import type { ListingCategory } from "./use-partner-listings";

// A transfer is priced flat (RAA-191), by the vehicle and trip. Every other kind has its own rate
// (a stay's, a tour's, or a rental's: vehicles and gear share one, RAA-255).
export function isFlatPriced(category: Pick<ListingCategory, "booking_type"> | undefined) {
  return category?.booking_type === "transfer";
}

// The field's value (pesos as typed) from a saved price, and back as the API's centavos.
export function toFlatPriceValue(rate: { price_cents: number } | null | undefined) {
  return rate?.price_cents ? String(rate.price_cents / 100) : "";
}

export function toFlatRateBody(value: string) {
  return { price_cents: Math.round(Number(value) * 100) };
}

// The one price a transfer has, required: what guests see and checkout charges.
export function FlatPriceField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <Field
      label="Price per vehicle, per trip (₱)"
      name="flat_price"
      type="number"
      required
      min={1}
      step="0.01"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder="e.g. 1500"
      hint="One van or car for the trip, whoever rides. Guests see it and pay it when you accept."
      data-testid="flat-price"
    />
  );
}
