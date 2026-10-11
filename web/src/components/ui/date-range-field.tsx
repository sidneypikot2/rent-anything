"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { DayPicker, type DayButtonProps } from "react-day-picker";
import { formatDateRange } from "@/lib/dates";
import { cn } from "./cn";

export type DateRange = { from: string; to: string };

type Props = {
  label: string;
  hint?: string;
  error?: string;
  // "YYYY-MM-DD", or "" when not picked. While only the start is picked, `to` is "".
  from: string;
  to: string;
  onChange: (range: DateRange) => void;
  // The first day that can be picked.
  min: string;
  // One day rather than a range: a tap sets both ends.
  single?: boolean;
  // Offers Clear, for dates that are optional.
  clearable?: boolean;
  placeholder?: string;
  // In flow under the field rather than floating over the page: for a sheet, which
  // scrolls its own content.
  inline?: boolean;
  autoFocus?: boolean;
  className?: string;
  "data-testid"?: string;
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
  "flex size-9 items-center justify-center rounded-lg text-foreground hover:bg-surface-2 aria-disabled:cursor-not-allowed aria-disabled:text-muted/40 aria-disabled:hover:bg-transparent";

// react-day-picker's parts, styled with the palette instead of its stylesheet.
const CLASS_NAMES = {
  root: "w-full",
  months: "relative flex flex-col",
  month: "flex flex-col gap-2",
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
function Day({ day, modifiers, className, ...props }: DayButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);
  // DayPicker moves keyboard focus by marking a day focused (as its own DayButton does).
  useEffect(() => {
    if (modifiers.focused) ref.current?.focus();
  }, [modifiers.focused]);
  const end = modifiers.selected && !modifiers.range_middle;
  return (
    <button
      ref={ref}
      {...props}
      data-day={toIso(day.date)}
      className={cn(
        className,
        "h-10 w-full text-sm outline-none focus-visible:ring-2 focus-visible:ring-navy",
        end ? "rounded-lg bg-primary font-semibold text-white" : modifiers.range_middle ? "bg-aqua text-navy" : "rounded-lg",
        !modifiers.selected && !modifiers.disabled && "hover:bg-surface-2",
        modifiers.disabled && "cursor-not-allowed text-muted/50",
        modifiers.today && !end && "font-semibold underline underline-offset-4",
      )}
    />
  );
}

// One field for a stretch of days: it opens a month calendar (react-day-picker) where the
// first tap picks the start and the second the end (RAA-92). A tap before the start starts
// again from there. A start already before `min` (a trip under way) is kept, and taps move
// only the end. A plain disclosure like Menu: it closes on Escape, on a click outside it
// and once the range is complete.
export function DateRangeField({
  label,
  hint,
  error,
  from,
  to,
  onChange,
  min,
  single = false,
  clearable = false,
  placeholder,
  inline = false,
  autoFocus,
  className,
  "data-testid": testId,
}: Props) {
  const [open, setOpen] = useState(false);
  // The day under the pointer, shown as the end while one is picked.
  const [hovered, setHovered] = useState<string>();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const labelId = useId();
  const valueId = useId();
  const noteId = useId();
  const calendarId = useId();
  const note = error ?? hint;
  const keepsStart = !single && Boolean(from) && from < min;

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function close() {
    setOpen(false);
    trigger.current?.focus();
  }

  // DayPicker's own range rules differ (it stretches a complete range), so a pick is
  // worked out here from the day tapped.
  function pick(date: Date) {
    const day = toIso(date);
    if (single) {
      onChange({ from: day, to: day });
      return close();
    }
    if (!from || (to && !keepsStart) || day < from) return onChange({ from: day, to: "" });
    onChange({ from, to: day });
    close();
  }

  // Escape closes the calendar only, not a sheet the field is in.
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Escape" || !open) return;
    event.preventDefault();
    event.stopPropagation();
    close();
  }

  const value = single
    ? formatDateRange(from, from)
    : from && to
      ? formatDateRange(from, to)
      : from
        ? `${formatDateRange(from, from)} – pick an end`
        : null;
  const pickingEnd = !single && Boolean(from) && (!to || keepsStart);
  const shownEnd = (pickingEnd && hovered && hovered >= from ? hovered : undefined) || to;
  const opensOn = toDate(from && from >= min ? from : min);
  const instruction = keepsStart
    ? "Under way: pick the new last day"
    : pickingEnd
      ? "Now pick the last day"
      : single
        ? undefined
        : "Pick the first day";
  const calendar = {
    timeZone: "UTC",
    weekStartsOn: 1,
    autoFocus: true,
    defaultMonth: opensOn,
    startMonth: toDate(min),
    disabled: { before: toDate(min) },
    classNames: CLASS_NAMES,
    components: { DayButton: Day },
    footer: instruction,
    onDayMouseEnter: (date: Date) => setHovered(toIso(date)),
    onDayMouseLeave: () => setHovered(undefined),
  } as const;

  return (
    <div ref={root} onKeyDown={onKeyDown} className={cn("relative flex flex-col gap-1 text-sm font-medium", className)}>
      <span id={labelId}>{label}</span>
      <button
        ref={trigger}
        type="button"
        autoFocus={autoFocus}
        aria-labelledby={`${labelId} ${valueId}`}
        aria-describedby={note ? noteId : undefined}
        aria-expanded={open}
        aria-controls={calendarId}
        data-testid={testId}
        onClick={() => {
          setHovered(undefined);
          setOpen(!open);
        }}
        className={cn(
          "flex items-center justify-between gap-2 rounded-lg border-[1.5px] bg-surface px-3 py-2 text-left font-normal outline-none",
          "focus:border-primary disabled:bg-surface-2",
          error ? "border-danger" : "border-line-strong",
          open && "border-primary",
        )}
      >
        <span id={valueId} className={value ? "text-foreground" : "text-muted/80"}>
          {value ?? placeholder ?? (single ? "Add a date" : "Add dates")}
        </span>
        <CalendarIcon />
      </button>
      {note && (
        <span id={noteId} className={cn("text-xs font-normal", error ? "text-danger" : "text-muted")}>
          {note}
        </span>
      )}

      {open && (
        <div
          id={calendarId}
          role="group"
          aria-label={label}
          className={cn(
            "flex w-full flex-col gap-2 rounded-xl border-[1.5px] border-line bg-surface p-3 font-normal",
            inline ? "mt-1" : "absolute left-0 top-full z-20 mt-1 shadow-xl shadow-navy/20 sm:w-80",
          )}
        >
          {single ? (
            <DayPicker
              {...calendar}
              mode="single"
              selected={from ? toDate(from) : undefined}
              onSelect={(_, date) => pick(date)}
            />
          ) : (
            <DayPicker
              {...calendar}
              mode="range"
              selected={from ? { from: toDate(from), to: shownEnd ? toDate(shownEnd) : undefined } : undefined}
              onSelect={(_, date) => pick(date)}
            />
          )}

          <div className="flex justify-end gap-1 text-sm">
            {clearable && from && (
              <button
                type="button"
                onClick={() => {
                  onChange({ from: "", to: "" });
                  close();
                }}
                className="rounded-lg px-2 py-1 font-medium text-link hover:bg-surface-2"
              >
                Clear
              </button>
            )}
            <button type="button" onClick={close} className="rounded-lg px-2 py-1 font-medium text-link hover:bg-surface-2">
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg aria-hidden viewBox="0 0 20 20" className="size-4 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="4.5" width="14" height="12" rx="2" />
      <path d="M3 8.5h14M7 3v3M13 3v3" />
    </svg>
  );
}
