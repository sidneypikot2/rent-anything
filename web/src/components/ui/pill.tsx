import type { ComponentProps } from "react";
import { cn } from "./cn";

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
      className={cn(
        "rounded-full border-[1.5px] px-4 py-1 text-sm transition-colors",
        on
          ? "border-primary bg-primary font-semibold text-white"
          : "border-line bg-surface font-medium text-muted hover:border-primary",
        className,
      )}
      {...props}
    />
  );
}
