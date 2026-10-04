import type { ComponentProps } from "react";
import { cn } from "./cn";

// Page and section headings use the display face in italic, as the brand sheet does.
// A page has one h1; render the look elsewhere with as="p".
export function DisplayTitle({
  as: Tag = "h1",
  className,
  ...props
}: { as?: "h1" | "p" } & ComponentProps<"h1">) {
  return (
    <Tag
      className={cn(
        "font-display text-4xl font-bold italic leading-tight tracking-tight sm:text-5xl",
        className,
      )}
      {...props}
    />
  );
}

export function SectionTitle({ className, ...props }: ComponentProps<"h2">) {
  return (
    <h2
      className={cn("font-display text-3xl font-bold italic tracking-tight", className)}
      {...props}
    />
  );
}

// The small uppercase line above a heading.
export function Eyebrow({ className, ...props }: ComponentProps<"p">) {
  return (
    <p
      className={cn("text-xs font-bold uppercase tracking-[0.14em] text-primary", className)}
      {...props}
    />
  );
}

// A price in the display face, with its unit after it: <Price amount="₱1,200" unit="/ day" />.
export function Price({ amount, unit }: { amount: string; unit?: string }) {
  return (
    <span className="font-display text-xl font-bold text-primary">
      {amount}
      {unit && <small className="ml-1 font-sans text-xs font-normal text-muted">{unit}</small>}
    </span>
  );
}
