import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "./cn";

// py-2 plus the 4px stretch above and below (the ::after) makes a 44px tap target; rows of
// pills 8px apart (gap-2) still don't overlap.
const BASE =
  "relative rounded-full border-[1.5px] px-4 py-2 text-sm transition-colors after:absolute after:inset-x-0 after:-inset-y-1";
const OFF = "border-line bg-surface font-medium text-muted hover:border-primary hover:text-primary";

// A rounded filter chip; `on` marks the selected one.
export function Pill({
  on = false,
  className,
  ...props
}: { on?: boolean } & ComponentProps<"button">) {
  return (
    <button
      type="button"
      aria-pressed={on}
      className={cn(BASE, on ? "border-primary bg-primary font-semibold text-white" : OFF, className)}
      {...props}
    />
  );
}

// A chip that goes somewhere: an activity to search, an area to open.
export function PillLink({ className, ...props }: ComponentProps<typeof Link>) {
  return <Link className={cn(BASE, "inline-flex items-center gap-2", OFF, className)} {...props} />;
}
