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
  // Only one offered (request to book, RAA-134): nothing to choose, so say how it works.
  if (modes.length === 1) {
    const [mode] = modes;
    return (
      <div data-testid="listing-booking-mode" className="flex flex-col gap-1 rounded-control bg-surface-2 px-4 py-3">
        <p className="text-sm font-semibold">How guests book it: {mode.name}</p>
        <p className="text-sm text-muted">{mode.description}</p>
      </div>
    );
  }

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
