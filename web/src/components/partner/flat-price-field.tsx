"use client";

import { Field } from "@/components/ui/field";
import { isVehicle } from "./vehicle-fields";
import type { ListingCategory } from "./use-partner-listings";

// Gear and transfers are priced flat (RAA-191): gear by the item and day, a transfer by the
// vehicle and trip. Every other kind has its own rate (a stay's, a tour's, a vehicle's).
export function isFlatPriced(category: Pick<ListingCategory, "booking_type" | "attribute_schema"> | undefined) {
  if (!category) return false;
  return category.booking_type === "transfer" || (category.booking_type === "rental" && !isVehicle(category as ListingCategory));
}

// The field's value (pesos as typed) from a saved price, and back as the API's centavos.
export function toFlatPriceValue(rate: { price_cents: number } | null | undefined) {
  return rate?.price_cents ? String(rate.price_cents / 100) : "";
}

export function toFlatRateBody(value: string) {
  return { price_cents: Math.round(Number(value) * 100) };
}

// The one price a gear or transfer listing has, required: what guests see and checkout charges.
export function FlatPriceField({
  value,
  onChange,
  transfer,
}: {
  value: string;
  onChange: (value: string) => void;
  transfer: boolean;
}) {
  return (
    <Field
      label={transfer ? "Price per vehicle, per trip (₱)" : "Price per item, per day (₱)"}
      name="flat_price"
      type="number"
      required
      min={1}
      step="0.01"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={transfer ? "e.g. 1500" : "e.g. 300"}
      hint={
        transfer
          ? "One van or car for the trip, whoever rides. Guests see it and pay it when you accept."
          : "For one item for one day. Guests see it and pay it when you accept."
      }
      data-testid="flat-price"
    />
  );
}
