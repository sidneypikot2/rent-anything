"use client";

import { ChoiceCards } from "@/components/ui/choice-cards";
import type { ListingOptions } from "./use-partner-listings";

// How guests book a listing (RAA-133): at once, or by sending a request the partner accepts or
// declines. The modes and their wording come from the API (listing_options), like the
// cancellation policies.

export type BookingModes = ListingOptions["booking_modes"];
export type BookingMode = BookingModes[number]["value"];

export function BookingModeChoice({
  modes,
  value,
  onChange,
}: {
  modes: BookingModes;
  value: BookingMode;
  onChange: (value: BookingMode) => void;
}) {
  return (
    <ChoiceCards
      legend="How guests book it"
      name="booking_mode"
      required
      value={value}
      onChange={(next) => onChange(next as BookingMode)}
      choices={modes.map((mode) => ({ value: mode.value, label: mode.name, description: mode.description }))}
      data-testid="listing-booking-mode"
    />
  );
}
