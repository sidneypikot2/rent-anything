"use client";

import { DayPicker, type DayButtonProps } from "react-day-picker";
import { cn } from "./cn";
import { CLASS_NAMES, toDate, toIso } from "./date-range-field";

// How a day reads: a day something happens (open), one added by hand (extra), one taken
// out (blocked). Unmarked days are plain.
export type DayMark = "open" | "extra" | "blocked";

const MARKS: Record<DayMark, { day: string; swatch: string; label: string }> = {
  open: { day: "bg-mist font-semibold text-primary", swatch: "bg-mist border-line", label: "Runs" },
  extra: { day: "bg-aqua font-semibold text-navy ring-1 ring-inset ring-primary", swatch: "bg-aqua border-primary", label: "Added date" },
  blocked: { day: "bg-surface-2 text-muted line-through", swatch: "bg-surface-2 border-line-strong", label: "Blocked" },
};

// A day, styled from its mark.
function Day({ day, modifiers, className, ...props }: DayButtonProps) {
  const mark = (["blocked", "extra", "open"] as const).find((name) => modifiers[name]);
  return (
    <button
      {...props}
      data-day={toIso(day.date)}
      data-mark={mark}
      className={cn(
        className,
        "h-10 w-full rounded-control text-sm outline-none transition-colors duration-300 ease-calm",
        "focus-visible:ring-2 focus-visible:ring-navy",
        mark ? MARKS[mark].day : !modifiers.disabled && "hover:bg-surface-2",
        modifiers.disabled && "cursor-not-allowed text-muted/50",
        modifiers.today && "underline underline-offset-4",
      )}
    />
  );
}

// A month calendar that stays open, for seeing and changing a schedule rather than picking
// dates (RAA-111): each day carries a mark and a tap on one reports it. Days before `min`
// can't be tapped. In UTC like DateRangeField, so a day never shifts with the time zone.
export function MonthCalendar({
  label,
  min,
  mark,
  onDayClick,
  months = 1,
  "data-testid": testId,
}: {
  label: string;
  // "YYYY-MM-DD": the first day that can be tapped, and the month it opens on.
  min: string;
  mark: (day: string) => DayMark | undefined;
  onDayClick: (day: string) => void;
  months?: 1 | 2;
  "data-testid"?: string;
}) {
  const marked = (name: DayMark) => (date: Date) => mark(toIso(date)) === name;

  return (
    <div role="group" aria-label={label} data-testid={testId} className="flex flex-col gap-3">
      <DayPicker
        timeZone="UTC"
        weekStartsOn={1}
        numberOfMonths={months}
        defaultMonth={toDate(min)}
        startMonth={toDate(min)}
        disabled={{ before: toDate(min) }}
        modifiers={{ open: marked("open"), extra: marked("extra"), blocked: marked("blocked") }}
        onDayClick={(date, modifiers) => {
          if (!modifiers.disabled) onDayClick(toIso(date));
        }}
        classNames={{ ...CLASS_NAMES, months: cn(CLASS_NAMES.months, months === 2 && "gap-6 sm:flex-row") }}
        components={{ DayButton: Day }}
      />
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {Object.values(MARKS).map((item) => (
          <li key={item.label} className="flex items-center gap-1.5">
            <span aria-hidden className={cn("size-3 rounded-sm border", item.swatch)} />
            {item.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
