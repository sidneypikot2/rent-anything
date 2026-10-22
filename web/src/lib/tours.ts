import type { components } from "@/api/schema";
import { formatPeso } from "./money";
import { plural } from "./pricing";

// How a tour's facts read (RAA-111), for partners and guests alike; plain functions so server
// pages can use them.

export type TourType = components["schemas"]["tour_type"];
export type InclusionKind = components["schemas"]["tour_inclusion"]["kind"];
type Inclusion = Pick<components["schemas"]["tour_inclusion"], "kind" | "options" | "note" | "price_per_head_cents">;

export const TOUR_TYPES: { value: TourType; label: string; description: string }[] = [
  {
    value: "private",
    label: "Private",
    description: "One group has the tour to itself. You price the group; inclusions they pick are added per head.",
  },
  {
    value: "joiner",
    label: "Joiner",
    description: "Guests join others on a shared tour. You price each guest, and what you include is in that price.",
  },
];

export const INCLUSION_LABELS: Record<InclusionKind, string> = {
  accommodation: "Accommodation",
  transport: "Transport",
  meal: "Meals",
};

export function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function tourTypeLabel(type: TourType) {
  return type === "private" ? "Private tour" : "Joiner tour";
}

// The same for guests: "joiner" is the trade's word, and a visitor from abroad may not know it.
export function guestTourTypeLabel(type: TourType) {
  return type === "private" ? "Private tour" : "Shared tour";
}

// "2 to 8 guests", "Up to 6 guests".
export function groupText(min: number, max: number) {
  if (min === max) return plural(max, "guest");
  return min === 1 ? `Up to ${plural(max, "guest")}` : `${min} to ${max} guests`;
}

// "4 hours", "2 days".
export function durationText(value: number, unit: "hours" | "days") {
  return plural(value, unit === "hours" ? "hour" : "day");
}

// "Transport: van, boat", with its note; a private tour's add-on price after it.
export function inclusionText(inclusion: Inclusion, type: TourType) {
  const options = inclusion.options.length > 0 ? `: ${inclusion.options.join(", ")}` : "";
  const note = inclusion.note ? ` (${inclusion.note})` : "";
  const price =
    type === "private"
      ? inclusion.price_per_head_cents
        ? ` · ${formatPeso(inclusion.price_per_head_cents)} per guest`
        : " · free"
      : "";
  return `${INCLUSION_LABELS[inclusion.kind]}${options}${note}${price}`;
}

// What the base price is for: the whole group on a private tour, each guest on a joiner.
export function basePriceUnit(type: TourType) {
  return type === "private" ? "per group" : "per guest";
}
