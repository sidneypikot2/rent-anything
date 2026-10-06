import type { ComponentProps } from "react";
import { cn } from "./cn";

// A checkbox with its label beside it: "Guide included".
export function CheckboxField({ label, className, ...props }: { label: string } & Omit<ComponentProps<"input">, "type">) {
  return (
    <label className={cn("flex items-center gap-2 text-sm font-medium", className)}>
      <input type="checkbox" className="size-4 rounded border-line-strong accent-primary" {...props} />
      {label}
    </label>
  );
}
