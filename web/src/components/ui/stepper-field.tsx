import { useId } from "react";
import { cn } from "./cn";

// A small count with − and + beside its label: "Guests  − 2 +". For numbers a partner
// nudges rather than types; `step` can be a fraction (bathrooms go up by 0.5).
export function StepperField({
  label,
  hint,
  value,
  onChange,
  min = 0,
  max = 99,
  step = 1,
  "data-testid": testId,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  "data-testid"?: string;
}) {
  const labelId = useId();
  return (
    <div data-testid={testId} className="flex items-center justify-between gap-4 py-1">
      <div className="flex flex-col">
        <span id={labelId} className="text-sm font-semibold">
          {label}
        </span>
        {hint && <span className="text-xs text-muted">{hint}</span>}
      </div>
      <Stepper label={label} labelledBy={labelId} value={value} onChange={onChange} min={min} max={max} step={step} testId={testId} size="lg" />
    </div>
  );
}

// The − count + on its own, for a row that says its label itself (a ticket row in a dialog).
// `size="sm"`: 36px discs, still 44px to tap.
export function Stepper({
  label,
  labelledBy,
  value,
  onChange,
  min = 0,
  max = 99,
  step = 1,
  testId,
  size = "sm",
}: {
  label: string;
  labelledBy?: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  testId?: string;
  size?: "sm" | "lg";
}) {
  const set = (next: number) => onChange(Math.min(max, Math.max(min, Math.round(next / step) * step)));
  const buttonClass = cn(
    "flex items-center justify-center rounded-button border text-lg text-primary transition-colors duration-150 ease-calm",
    size === "sm" ? "tap-target size-9 border-[1.5px] border-primary" : "size-11 border-line-strong",
    "hover:border-primary hover:bg-lagoon-tint disabled:cursor-not-allowed disabled:border-line-strong disabled:opacity-40",
  );
  return (
    <div role="group" aria-labelledby={labelledBy} aria-label={labelledBy ? undefined : label} className={cn("flex shrink-0 items-center", size === "sm" ? "gap-2.5" : "gap-3")}>
      <button
        type="button"
        aria-label={`Fewer: ${label}`}
        className={buttonClass}
        disabled={value <= min}
        onClick={() => set(value - step)}
        data-testid={testId && `${testId}-less`}
      >
        −
      </button>
      <output aria-live="polite" className={cn("text-center font-semibold tabular-nums", size === "sm" ? "w-6 text-control font-bold" : "w-8 text-sm")}>
        {value}
      </output>
      <button
        type="button"
        aria-label={`More: ${label}`}
        className={buttonClass}
        disabled={value >= max}
        onClick={() => set(value + step)}
        data-testid={testId && `${testId}-more`}
      >
        +
      </button>
    </div>
  );
}
