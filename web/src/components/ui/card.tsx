import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "./cn";

// A white panel: a hairline border and the soft shadow. Pad it with CardBody, or put media
// flush against its edges first. `clip={false}` lets a dropdown inside it hang over its
// edge; media then needs its own rounded corners.
export function Card({ clip = true, className, ...props }: { clip?: boolean } & ComponentProps<"div">) {
  return (
    <div
      className={cn("rounded-card border border-line bg-surface shadow-soft", clip && "overflow-hidden", className)}
      {...props}
    />
  );
}

// A whole card that is one link: a search result, a destination in a list.
export function CardLink({ className, ...props }: ComponentProps<typeof Link>) {
  return (
    <Link
      className={cn(
        "block rounded-card border border-line bg-surface shadow-soft",
        // It rises a little on hover, slowly, and settles back.
        "transition-[transform,box-shadow,border-color] duration-500 ease-calm hover:-translate-y-1 hover:border-fern hover:shadow-lift",
        className,
      )}
      {...props}
    />
  );
}

// sm for dense rows, md for most cards, lg (the `card` step, 24px) for a card that leads a page.
const PADDING = { sm: "p-4", md: "p-5", lg: "p-card" };

// Padding is a prop because cn() doesn't merge: a p-* className wouldn't reliably win.
export function CardBody({
  pad = "md",
  className,
  ...props
}: { pad?: keyof typeof PADDING } & ComponentProps<"div">) {
  return <div className={cn(PADDING[pad], className)} {...props} />;
}
