import type { ComponentProps } from "react";
import { cn } from "./cn";

// A white panel with the palette's light-blue border. Pad it with CardBody, or put media
// flush against its edges first.
export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("overflow-hidden rounded-2xl border-[1.5px] border-line bg-surface", className)}
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
