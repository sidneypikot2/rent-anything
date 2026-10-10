import type { ComponentProps } from "react";
import { cn } from "./cn";

const TONES = {
  aqua: "border border-aqua bg-aqua text-navy",
  emerald: "border border-secondary bg-secondary text-white",
  mist: "border border-line bg-mist text-primary",
};

// A small uppercase label: "Best value", "Eco tour", "New".
export function Badge({
  tone = "aqua",
  className,
  ...props
}: { tone?: keyof typeof TONES } & ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-extrabold uppercase tracking-wider",
        TONES[tone],
        className,
      )}
      {...props}
    />
  );
}
