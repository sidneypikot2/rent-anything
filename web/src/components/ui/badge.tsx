import type { ComponentProps } from "react";
import { cn } from "./cn";

const TONES = {
  // Highlights: "Best value", "Instant booking". Navy on pale blue.
  aqua: "bg-aqua text-navy",
  // Trust, in forest green: "Verified partner", "Eco tour". Forest on its tint is 9.5:1.
  emerald: "bg-sage text-forest",
  // Neutral facts on white: "Example", a tag. Blue on mist.
  // A flat grey fill with no edge, so a fact never looks like a button (a white pill with a hairline).
  mist: "bg-tag text-muted",
  // What a listing includes ("Sleeps 2", "Automatic"): the same flat grey, its words in the ink
  // so they read at a glance (its icon takes the action colour at the call site).
  fact: "bg-tag text-navy/80",
  // What a listing is ("Motorcycle", "Tour"): lagoon ink on its tint (8.3:1), the one tag that
  // leads a row.
  kind: "bg-lagoon-tint font-semibold text-lagoon-ink",
  // Something the partner needs to fix: "Needs a price". Warning on white is 5:1.
  warning: "border border-warning/40 bg-surface text-warning",
  // On a photo or glass: a landmark's tag, a step number. White on the glass fill.
  glass: "border border-glass-edge bg-glass-fill text-white",
  // A destination's kind on its photo (RAA-130): an island in teal, a city in blue.
  island: "bg-island-tint text-island-ink",
  city: "bg-city-tint text-city-ink",
};

// A small pill label in sentence case: "Best value", "Eco tour", "New". Round on guest pages,
// as the buttons are (rounded-chip).
export function Badge({
  tone = "aqua",
  className,
  ...props
}: { tone?: keyof typeof TONES } & ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "inline-flex min-h-7 items-center gap-1.5 rounded-chip px-2.5 text-small font-medium",
        TONES[tone],
        className,
      )}
      {...props}
    />
  );
}
