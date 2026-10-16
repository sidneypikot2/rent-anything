import type { ComponentProps } from "react";
import { cn } from "./cn";

// The type scale, largest first: hero (one per site, the home page), page (a page's h1),
// section (SectionTitle, h2), then card titles at text-lg semibold, body at text-base with
// relaxed leading, and meta at text-sm in muted. Each step is clearly smaller than the last.
// The bigger the title, the tighter it is set: at the hero's size the usual tracking-tight
// leaves the extra-bold letters looking spaced out. From sm up the hero and page titles also
// size by the window's height (RAA-125), so a banner fits the first screen of a laptop.
const TITLE_SIZES = {
  page: "text-4xl leading-[1.08] tracking-tight sm:text-[min(7svh,3rem)]",
  hero: "text-[clamp(2.25rem,11vw,3rem)] leading-[1.02] tracking-[-0.035em] sm:text-[min(7.2svh,3.75rem)] landscape-phone:text-4xl",
};

// Page and section headings: the one family at extra-bold, tightly tracked (Sky & Forest).
// A page has one h1; render the look elsewhere with as="p".
export function DisplayTitle({
  as: Tag = "h1",
  size = "page",
  className,
  ...props
}: { as?: "h1" | "p"; size?: keyof typeof TITLE_SIZES } & ComponentProps<"h1">) {
  return (
    <Tag
      className={cn("font-display font-extrabold", TITLE_SIZES[size], className)}
      {...props}
    />
  );
}

export function SectionTitle({ className, ...props }: ComponentProps<"h2">) {
  return (
    <h2
      className={cn("font-display text-3xl leading-[1.1] font-extrabold tracking-tight text-balance sm:text-4xl", className)}
      {...props}
    />
  );
}

// The small uppercase line above a heading. `tone="inherit"` leaves its colour to the caller,
// for a label in a card's own text colours (a className colour can't override text-primary).
export function Eyebrow({ tone = "primary", className, ...props }: { tone?: "primary" | "inherit" } & ComponentProps<"p">) {
  return (
    <p
      className={cn("text-xs font-bold uppercase tracking-[0.14em]", tone === "primary" && "text-primary", className)}
      {...props}
    />
  );
}

// A price in the display face, with its unit after it: <Price amount="₱1,200" unit="/ day" />.
// `prefix` goes before it in small type ("from"); `onDark` is for dark glass over a photo.
export function Price({
  amount,
  unit,
  prefix,
  onDark = false,
}: {
  amount: string;
  unit?: string;
  prefix?: string;
  onDark?: boolean;
}) {
  const small = cn("font-sans text-xs font-normal", onDark ? "text-sky-mist" : "text-muted");
  return (
    <span
      className={cn(
        "font-display text-xl font-extrabold tracking-tight tabular-nums",
        onDark ? "text-white" : "text-foreground",
      )}
    >
      {prefix && <small className={cn(small, "mr-1")}>{prefix}</small>}
      {amount}
      {unit && <small className={cn(small, "ml-1")}>{unit}</small>}
    </span>
  );
}
