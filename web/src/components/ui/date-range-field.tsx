"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { formatDateRange, todayIso } from "@/lib/dates";
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

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

// Calendar maths on "YYYY-MM-DD" strings, in UTC like the rest of the app's dates.
function toDate(iso: string) {
  return new Date(`${iso}T00:00:00Z`);
}

function toIso(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(iso: string, days: number) {
  const date = toDate(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return toIso(date);
}

// The same day of another month, or that month's last day when it is shorter.
function addMonths(iso: string, months: number) {
  const date = toDate(iso);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, last));
  return toIso(date);
}

// "YYYY-MM-01" of the month a day falls in.
function monthOf(iso: string) {
  return `${iso.slice(0, 7)}-01`;
}

// The month's days, padded with nulls so the first falls under its weekday (Monday first).
function monthDays(month: string) {
  const first = toDate(month);
  const offset = (first.getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  return [...Array<null>(offset).fill(null), ...Array.from({ length: count }, (_, index) => addDays(month, index))];
}

function formatMonth(month: string) {
  return toDate(month).toLocaleDateString("en-US", { timeZone: "UTC", month: "long", year: "numeric" });
}

function formatFullDay(iso: string) {
  return toDate(iso).toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// One field for a stretch of days: it opens a month calendar where the first tap picks the
// start and the second the end (RAA-92). A tap before the start starts again from there.
// A start already before `min` (a trip under way) is kept, and taps move only the end.
// A plain disclosure like Menu: it closes on Escape, on a click outside it and once the
// range is complete.
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
  const [month, setMonth] = useState(() => monthOf(from || min));
  // The day keyboard focus is on, and the one under the pointer while an end is picked.
  const [focusDay, setFocusDay] = useState(from || min);
  const [hovered, setHovered] = useState<string>();
  const moveFocus = useRef(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const grid = useRef<HTMLDivElement>(null);
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

  // Keyboard moves (and opening) put focus on the day they land on, once it is rendered.
  useEffect(() => {
    if (!open || !moveFocus.current) return;
    moveFocus.current = false;
    grid.current?.querySelector<HTMLButtonElement>(`[data-day="${focusDay}"]`)?.focus();
  }, [open, focusDay, month]);

  function show() {
    const start = from && from >= min ? from : min;
    setMonth(monthOf(start));
    setFocusDay(start);
    setHovered(undefined);
    moveFocus.current = true;
    setOpen(true);
  }

  function close() {
    setOpen(false);
    trigger.current?.focus();
  }

  function pick(day: string) {
    if (single) {
      onChange({ from: day, to: day });
      return close();
    }
    if (!from || (to && !keepsStart) || day < from) return onChange({ from: day, to: "" });
    onChange({ from, to: day });
    close();
  }

  function focusOn(day: string) {
    const target = day < min ? min : day;
    setFocusDay(target);
    setMonth(monthOf(target));
    moveFocus.current = true;
  }

  function onDayKeyDown(event: KeyboardEvent<HTMLButtonElement>, day: string) {
    const moves: Record<string, () => string> = {
      ArrowLeft: () => addDays(day, -1),
      ArrowRight: () => addDays(day, 1),
      ArrowUp: () => addDays(day, -7),
      ArrowDown: () => addDays(day, 7),
      PageUp: () => addMonths(day, -1),
      PageDown: () => addMonths(day, 1),
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    focusOn(move());
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
  // The end shown while picking one: the day under the pointer, or the focused day.
  const pickingEnd = !single && Boolean(from) && (!to || keepsStart);
  const shownEnd =
    (pickingEnd && hovered && hovered >= from ? hovered : undefined) ||
    to ||
    (pickingEnd && focusDay >= from ? focusDay : undefined) ||
    from;
  const today = todayIso();

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
        onClick={() => (open ? setOpen(false) : show())}
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
          <div className="flex items-center justify-between">
            <MonthButton
              label="Previous month"
              disabled={month <= monthOf(min)}
              onClick={() => setMonth(addMonths(month, -1))}
            >
              ‹
            </MonthButton>
            <p aria-live="polite" className="font-medium">
              {formatMonth(month)}
            </p>
            <MonthButton label="Next month" onClick={() => setMonth(addMonths(month, 1))}>
              ›
            </MonthButton>
          </div>

          <div ref={grid} className="grid grid-cols-7 gap-y-1 text-center" onPointerLeave={() => setHovered(undefined)}>
            {WEEKDAYS.map((weekday) => (
              <span key={weekday} aria-hidden className="py-1 text-xs text-muted">
                {weekday}
              </span>
            ))}
            {monthDays(month).map((day, index) => {
              if (!day) return <span key={`blank-${index}`} />;
              const disabled = day < min;
              const end = day === from || day === shownEnd;
              const between = Boolean(from) && day > from && day < shownEnd;
              const picked = Boolean(from) && day >= from && day <= (to || from);
              return (
                <button
                  key={day}
                  type="button"
                  data-day={day}
                  disabled={disabled}
                  tabIndex={day === focusDay ? 0 : -1}
                  aria-label={formatFullDay(day)}
                  aria-pressed={picked}
                  onClick={() => pick(day)}
                  onPointerEnter={() => setHovered(day)}
                  onKeyDown={(event) => onDayKeyDown(event, day)}
                  className={cn(
                    "h-10 text-sm outline-none focus-visible:ring-2 focus-visible:ring-navy",
                    end ? "rounded-lg bg-primary font-semibold text-white" : between ? "bg-aqua text-navy" : "rounded-lg",
                    !end && !between && !disabled && "hover:bg-surface-2",
                    disabled && "cursor-not-allowed text-muted/50",
                    day === today && !end && "font-semibold underline underline-offset-4",
                  )}
                >
                  {Number(day.slice(8))}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-3 text-sm">
            <p className="text-xs text-muted">{keepsStart ? "Under way: pick the new last day" : pickingEnd ? "Now pick the last day" : single ? "" : "Pick the first day"}</p>
            <div className="flex gap-1">
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
        </div>
      )}
    </div>
  );
}

function MonthButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-9 items-center justify-center rounded-lg text-xl leading-none text-foreground hover:bg-surface-2 disabled:text-muted/40 disabled:hover:bg-transparent"
    >
      {children}
    </button>
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
