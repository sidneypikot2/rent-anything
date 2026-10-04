import type { ComponentProps } from "react";
import { cn } from "./cn";

const TONES = {
  aqua: "bg-aqua text-navy",
  emerald: "bg-secondary text-white",
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
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.65rem] font-extrabold uppercase tracking-wider",
        TONES[tone],
        className,
      )}
      {...props}
    />
  );
}
