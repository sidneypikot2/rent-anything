import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn";

// A checkbox with its label beside it: "Guide included". `aside` sits at the far end, muted:
// a filter's count.
export function CheckboxField({
  label,
  aside,
  className,
  ...props
}: { label: string; aside?: ReactNode } & Omit<ComponentProps<"input">, "type">) {
  return (
    <label className={cn("flex items-center gap-2 text-sm font-medium", className)}>
      <input type="checkbox" className="size-4 shrink-0 rounded border-line-strong accent-primary" {...props} />
      {label}
      {aside !== undefined && <span className="ml-auto pl-2 nums text-muted">{aside}</span>}
    </label>
  );
}
