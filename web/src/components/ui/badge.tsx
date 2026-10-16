import type { ComponentProps } from "react";
import { cn } from "./cn";

const TONES = {
  // Highlights: "Best value", "Instant booking". Navy on pale blue.
  aqua: "border border-aqua bg-aqua text-navy",
  // Trust, in forest green: "Verified partner", "Eco tour". Forest on its tint is 9.5:1.
  emerald: "border border-sage bg-sage text-forest",
  // Neutral facts on white: "Example", a tag. Blue on mist.
  mist: "border border-line bg-mist text-primary",
  // Something the partner needs to fix: "Needs a price". Warning on white is 5:1.
  warning: "border border-warning/40 bg-surface text-warning",
  // On a photo or glass: a landmark's tag, a step number. White on the glass fill.
  glass: "border border-glass-edge bg-glass-fill text-white",
  // A destination's kind on its photo (RAA-130): an island in teal, a city in blue.
  island: "border border-island-tint bg-island-tint text-island-ink",
  city: "border border-city-tint bg-city-tint text-city-ink",
};

// A small pill label in sentence case: "Best value", "Eco tour", "New".
export function Badge({
  tone = "aqua",
  className,
  ...props
}: { tone?: keyof typeof TONES } & ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "inline-flex min-h-7 items-center gap-1.5 rounded-full px-3 text-[0.8125rem] font-semibold",
        TONES[tone],
        className,
      )}
      {...props}
    />
  );
}
