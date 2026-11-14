"use client";

import { useEffect, useRef, useState } from "react";
import { DayPicker, type DayButtonProps, type Matcher } from "react-day-picker";
import { cn } from "./cn";
import type { DateRange } from "./date-range-field";

// react-day-picker and the calendar built on it, apart from the field (RAA-231): the header's
// search has a date field on every guest page, and the calendar only shows once it opens, so
// date-range-field.tsx loads this file then (next/dynamic) rather than in every first load.

export type CalendarProps = {
  // "YYYY-MM-DD", or "" when not picked. While only the start is picked, `to` is "".
  from: string;
  to: string;
  onChange: (range: DateRange) => void;
  min: string;
  single?: boolean;
  keepStart?: boolean;
  months?: number;
  onComplete?: () => void;
  // A rental's units free each day (RAA-315), "YYYY-MM-DD" => count: a day with none is greyed
  // out and can't be a rental's first day or one inside it, but can be its return (not taken).
  free?: Record<string, number>;
};

// The calendar runs in UTC, like the app's dates ("YYYY-MM-DD", a day with no time zone,
// and today as the UTC day), so a day never shifts with the browser's time zone.
function toDate(iso: string) {
  return new Date(`${iso}T00:00:00Z`);
}

function toIso(date: Date) {
  return date.toISOString().slice(0, 10);
}

// DayPicker marks the month buttons aria-disabled rather than disabled.
const NAV_BUTTON =
  "flex size-9 items-center justify-center rounded-control text-foreground hover:bg-surface-2 aria-disabled:cursor-not-allowed aria-disabled:text-muted/40 aria-disabled:hover:bg-transparent";

// react-day-picker's parts, styled with the palette instead of its stylesheet.
const CLASS_NAMES = {
  root: "w-full",
  months: "relative flex flex-col gap-6 md:flex-row",
  month: "flex min-w-0 flex-1 flex-col gap-2",
  month_caption: "flex h-9 items-center justify-center font-medium",
  nav: "absolute inset-x-0 top-0 flex justify-between",
  button_previous: NAV_BUTTON,
  button_next: NAV_BUTTON,
  chevron: "size-4 fill-current",
  month_grid: "w-full border-collapse",
  weekday: "py-1 text-xs font-normal text-muted",
  day: "p-0 text-center",
  footer: "pt-1 text-xs text-muted",
};

// A day, styled from its state: the picked ends, the days between, unavailable days.
function Day({ day, modifiers, className, children, ...props }: DayButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);
  // DayPicker moves keyboard focus by marking a day focused (as its own DayButton does).
  useEffect(() => {
    if (modifiers.focused) ref.current?.focus();
  }, [modifiers.focused]);
  const end = modifiers.selected && !modifiers.range_middle;
  // A range's band runs from the middle of its first day to the middle of its last, so the round
  // ends sit on it; a one-day range has none.
  const band = modifiers.range_middle
    ? "bg-action-tint"
    : modifiers.range_start && !modifiers.range_end
      ? "bg-linear-to-r from-transparent from-50% to-action-tint to-50%"
      : modifiers.range_end && !modifiers.range_start
        ? "bg-linear-to-l from-transparent from-50% to-action-tint to-50%"
        : undefined;
  return (
    <button
      ref={ref}
      {...props}
      data-day={toIso(day.date)}
      className={cn(className, "group flex h-11 w-full items-center justify-center text-sm outline-none", band, modifiers.disabled && "cursor-not-allowed")}
    >
      <span
        className={cn(
          "flex size-11 items-center justify-center rounded-full transition-colors duration-150 ease-calm group-focus-visible:ring-2 group-focus-visible:ring-navy",
          end && "bg-primary font-semibold text-white",
          modifiers.range_middle && "font-semibold text-action-ink",
          !modifiers.selected && !modifiers.disabled && "group-hover:bg-surface-2",
          modifiers.disabled && "text-muted/50",
          modifiers.today && !end && "font-semibold underline underline-offset-4",
        )}
      >
        {children}
      </span>
    </button>
  );
}

// The calendar on its own, for a control that opens it its own way (the home hero's search).
// A tap picks the start and the next the end; `onComplete` runs once the range (or, with
// `single`, the day) is picked.
export function DateRangeCalendar({
  from,
  to,
  onChange,
  min,
  single = false,
  keepStart = true,
  months = 1,
  onComplete,
  free,
}: CalendarProps) {
  // The day under the pointer, shown as the end while one is picked.
  const [hovered, setHovered] = useState<string>();
  const keepsStart = keepStart && !single && Boolean(from) && from < min;

  // DayPicker's own range rules differ (it stretches a complete range), so a pick is
  // worked out here from the day tapped.
  function pick(date: Date) {
    const day = toIso(date);
    if (single) {
      onChange({ from: day, to: day });
      return onComplete?.();
    }
    if (!from || (to && !keepsStart) || day < from) return onChange({ from: day, to: "" });
    onChange({ from, to: day });
    onComplete?.();
  }

  const pickingEnd = !single && Boolean(from) && (!to || keepsStart);
  // With `free`: a start needs a unit free that day; an end, one free on every day before it
  // from the start (the first day with none can still be the return).
  const out = (day: string) => free?.[day] === 0;
  const firstOutAfter = pickingEnd && free ? Object.keys(free).sort().find((day) => day > from && out(day)) : undefined;
  const outOfReach = (day: string) =>
    Boolean(free) && (pickingEnd && day >= from ? Boolean(firstOutAfter && day > firstOutAfter) : out(day));
  const shownEnd = (pickingEnd && hovered && hovered >= from ? hovered : undefined) || to;
  const opensOn = toDate(from && from >= min ? from : min);
  // A complete range has a hint of its own: "Pick the first day" there read as if nothing was
  // picked (the planner's When and the When bar keep the calendar open until OK).
  const instruction = keepsStart
    ? "Under way: pick the new last day"
    : pickingEnd
      ? "Now pick the last day"
      : single
        ? undefined
        : from && to
          ? "Tap a day to pick new dates"
          : "Pick the first day";
  const disabled: Matcher[] = [{ before: toDate(min) }, (date: Date) => outOfReach(toIso(date))];
  const calendar = {
    numberOfMonths: months,
    timeZone: "UTC",
    weekStartsOn: 1,
    autoFocus: true,
    defaultMonth: opensOn,
    startMonth: toDate(min),
    disabled,
    classNames: CLASS_NAMES,
    components: { DayButton: Day },
    footer: instruction,
    onDayMouseEnter: (date: Date) => setHovered(toIso(date)),
    onDayMouseLeave: () => setHovered(undefined),
  } as const;

  return single ? (
    <DayPicker {...calendar} mode="single" selected={from ? toDate(from) : undefined} onSelect={(_, date) => pick(date)} />
  ) : (
    <DayPicker
      {...calendar}
      mode="range"
      selected={from ? { from: toDate(from), to: shownEnd ? toDate(shownEnd) : undefined } : undefined}
      onSelect={(_, date) => pick(date)}
    />
  );
}
