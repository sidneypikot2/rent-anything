import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "./cn";

// py-2 plus the 4px stretch above and below (the ::after) makes a 44px tap target; rows of
// pills 8px apart (gap-2) still don't overlap.
const BASE =
  "relative rounded-chip border px-4 py-2 text-sm transition-[background-color,border-color,color] duration-300 ease-calm after:absolute after:inset-x-0 after:-inset-y-1";

// `line` is a filter chip on white. `glass` is a chip on glass over a photo (a trip's places on
// the area banner): one line, room for a dot or a trailing arrow, and `on` marks the current one.
const TONES = {
  line: {
    on: "border-primary bg-primary font-semibold text-white",
    off: "border-line-strong bg-surface font-medium text-navy hover:border-navy/40 hover:bg-surface-2",
  },
  glass: {
    on: "inline-flex items-center gap-2 whitespace-nowrap border-white bg-white font-semibold text-navy",
    off: "inline-flex items-center gap-2 whitespace-nowrap border-white/40 font-medium text-sky-mist hover:bg-glass-fill hover:text-white",
  },
};

type PillStyle = { on?: boolean; tone?: keyof typeof TONES };

// The classes, for a chip that isn't a control (the current place, with nothing to open).
export function pillClasses({ on = false, tone = "line" }: PillStyle = {}) {
  return cn(BASE, on ? TONES[tone].on : TONES[tone].off);
}

// A rounded chip. On `line` it is a filter and `on` marks the selected one (aria-pressed); on
// `glass` it is an action (Edit, + Another place), so it is not a toggle.
export function Pill({ on = false, tone = "line", className, ...props }: PillStyle & ComponentProps<"button">) {
  return (
    <button
      type="button"
      aria-pressed={tone === "line" ? on : undefined}
      // The current place on glass opens something too (its Edit), so it answers the pointer.
      className={cn(pillClasses({ on, tone }), on && tone === "glass" && "hover:bg-glass-hover", className)}
      {...props}
    />
  );
}

// A chip that goes somewhere: an activity to search, an area to open, another place in a trip.
// On `line`, `on` marks a filter the link turns off again (Pet-friendly, RAA-186).
export function PillLink({ on = false, tone = "line", className, ...props }: PillStyle & ComponentProps<typeof Link>) {
  return (
    <Link
      aria-current={on || undefined}
      className={cn(pillClasses({ on, tone }), "inline-flex items-center gap-2", className)}
      {...props}
    />
  );
}
