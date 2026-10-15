import type { ComponentProps } from "react";
import { cn } from "./cn";

// A form's actions as a dark glass pill that stays in view at the foot of the screen: the way
// back or out at one end (a `glass` Button), the main action at the other (a `glow` Button),
// both `pill` size.
export function ActionBar({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "sticky bottom-4 z-10 flex items-center justify-between gap-3 rounded-full p-1.5 shadow-float",
        // The nav pill's glass, darker, so its light text holds up over a white card.
        "border border-glass-edge bg-navy/85 text-white backdrop-blur-lg",
        className,
      )}
      {...props}
    />
  );
}
