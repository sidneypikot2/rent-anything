import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "./cn";

// A white panel with the palette's light-blue border. Pad it with CardBody, or put media
// flush against its edges first. `clip={false}` lets a dropdown inside it hang over its
// edge; media then needs its own rounded corners.
export function Card({ clip = true, className, ...props }: { clip?: boolean } & ComponentProps<"div">) {
  return (
    <div
      className={cn("rounded-2xl border-[1.5px] border-line bg-surface", clip && "overflow-hidden", className)}
      {...props}
    />
  );
}

// A whole card that is one link: a search result, a destination in a list.
export function CardLink({ className, ...props }: ComponentProps<typeof Link>) {
  return (
    <Link
      className={cn(
        "block rounded-2xl border-[1.5px] border-line bg-surface transition-colors hover:border-primary hover:bg-surface-2",
        className,
      )}
      {...props}
    />
  );
}

const PADDING = { sm: "p-3", md: "p-4", lg: "p-5" };

// Padding is a prop because cn() doesn't merge: a p-* className wouldn't reliably win.
export function CardBody({
  pad = "md",
  className,
  ...props
}: { pad?: keyof typeof PADDING } & ComponentProps<"div">) {
  return <div className={cn(PADDING[pad], className)} {...props} />;
}
