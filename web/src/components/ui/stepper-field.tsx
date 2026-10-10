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
  const set = (next: number) => onChange(Math.min(max, Math.max(min, Math.round(next / step) * step)));
  const buttonClass = cn(
    "flex size-9 items-center justify-center rounded-full border-[1.5px] border-line-strong text-lg text-primary",
    "hover:border-primary disabled:cursor-not-allowed disabled:opacity-40",
  );

  return (
    <div data-testid={testId} className="flex items-center justify-between gap-4 py-1">
      <div className="flex flex-col">
        <span id={labelId} className="text-sm font-medium">
          {label}
        </span>
        {hint && <span className="text-xs text-muted">{hint}</span>}
      </div>
      <div role="group" aria-labelledby={labelId} className="flex items-center gap-3">
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
        <output aria-live="polite" className="w-8 text-center text-sm font-semibold tabular-nums">
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
    </div>
  );
}
