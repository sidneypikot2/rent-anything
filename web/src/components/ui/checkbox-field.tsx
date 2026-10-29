import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn";

// A checkbox with its label beside it: "Guide included". `aside` sits at the far end, muted:
// a filter's count. The whole row is the tap target, 44px tall.
export function CheckboxField({
  label,
  aside,
  className,
  ...props
}: { label: ReactNode; aside?: ReactNode } & Omit<ComponentProps<"input">, "type">) {
  return (
    <label className={cn("flex min-h-11 items-center gap-3 text-sm font-medium", className)}>
      <input type="checkbox" className="size-5 shrink-0 rounded border-line-strong accent-primary" {...props} />
      {label}
      {aside !== undefined && <span className="ml-auto pl-2 text-muted tabular-nums">{aside}</span>}
    </label>
  );
}
