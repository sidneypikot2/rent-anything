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

export function CardBody({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("p-4", className)} {...props} />;
}
