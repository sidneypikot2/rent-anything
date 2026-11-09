"use client";

import { Button } from "@/components/ui/button";
import { SelectField } from "@/components/ui/select-field";
import { HALF_HOURS, nextHalfHour } from "@/lib/times";

export { HALF_HOURS, timeText } from "@/lib/times";

// One time from the half hours, or none when `optional` ("Not set").
export function TimeSelect({
  label,
  value,
  onChange,
  optional = false,
  error,
  testId,
}: {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
  optional?: boolean;
  error?: string;
  testId?: string;
}) {
  return (
    <SelectField
      label={label}
      options={optional ? [{ value: "", label: "Not set" }, ...HALF_HOURS] : HALF_HOURS}
      value={value ?? ""}
      onChange={(event) => onChange(event.target.value || null)}
      error={error}
      data-testid={testId}
    />
  );
}

// A list of times, each removable, with "+ Add" below up to `max`. `min` rows always stay
// (a water activity's departures need one; a tour's start times none, meaning any time).
export function TimesListField({
  times,
  onChange,
  itemLabel,
  addLabel,
  max,
  min = 0,
  error,
  testId,
}: {
  times: string[];
  onChange: (times: string[]) => void;
  itemLabel: string;
  addLabel: string;
  max: number;
  min?: number;
  error?: string;
  testId?: string;
}) {
  return (
    <div className="flex flex-col gap-3" data-testid={testId}>
      {times.map((time, index) => (
        <div key={index} className="grid grid-cols-[1fr_auto] items-end gap-3">
          <SelectField
            label={`${itemLabel} ${index + 1}`}
            options={HALF_HOURS}
            value={time}
            onChange={(event) => onChange(times.map((other, at) => (at === index ? event.target.value : other)))}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={times.length <= min}
            onClick={() => onChange(times.filter((_, at) => at !== index))}
            aria-label={`Remove ${itemLabel.toLowerCase()} ${index + 1}`}
          >
            Remove
          </Button>
        </div>
      ))}
      {error && <p className="text-sm font-semibold text-danger">{error}</p>}
      {times.length < max && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={() => onChange([...times, nextHalfHour(times.at(-1))])}
        >
          + {addLabel}
        </Button>
      )}
    </div>
  );
}
