"use client";

import dynamic from "next/dynamic";
import { useEffect, useId, useImperativeHandle, useRef, useState, type KeyboardEvent, type Ref } from "react";
import { CalendarGlyph, ChevronGlyph, CloseGlyph } from "@/components/discovery/tag-glyphs";
import { formatDateRange } from "@/lib/dates";
import { Button } from "./button";
import { cn } from "./cn";
import { Dialog } from "./dialog";

export type DateRange = { from: string; to: string };
// Lets a form open the calendar itself, e.g. when it is sent with no dates picked.
export type DateRangeFieldHandle = { open: () => void };

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
  // A start already before `min` stays and taps move only the end (a trip under way). False
  // for something whose past start is of no use, like a cart item that can't be booked any
  // more: a tap then picks a new start.
  keepStart?: boolean;
  // Offers Clear, for dates that are optional.
  clearable?: boolean;
  placeholder?: string;
  // In flow under the field rather than floating over the page: for a sheet, which
  // scrolls its own content.
  inline?: boolean;
  // A ticket row in a dialog (the modal redesign): the calendar icon in its well, the label over
  // the dates, a chevron; the calendar opens under it, inside the ticket.
  row?: boolean;
  // A field on a page (What to book's dates bar, the planner's When) that opens the calendar in a
  // centred dialog, two months across from md, the picked days applied by OK. With `row`, a set
  // range also clears from the bar's own X.
  modal?: boolean;
  autoFocus?: boolean;
  // A rental's units free each day (RAA-315): the calendar greys out a day with none, so a rental
  // can't start on, or run through, one.
  free?: Record<string, number>;
  // The When bar's taller row (with `row modal`).
  bar?: boolean;
  className?: string;
  "data-testid"?: string;
  ref?: Ref<DateRangeFieldHandle>;
};

// The calendar (react-day-picker) loads when the field first opens, not with the page (RAA-231);
// until then a blank of about its height holds the place.
export const DateRangeCalendar = dynamic(() => import("./date-range-calendar").then((module) => module.DateRangeCalendar), {
  ssr: false,
  loading: () => <div aria-hidden className="h-80 w-full" />,
});

// One field for a stretch of days: it opens a month calendar (react-day-picker) where the
// first tap picks the start and the second the end (RAA-92). A tap before the start starts
// again from there. A start already before `min` (a trip under way) is kept, and taps move
// only the end, unless `keepStart` is false. A plain disclosure like Menu: it closes on Escape, on a click outside it
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
  keepStart = true,
  clearable = false,
  placeholder,
  inline = false,
  row = false,
  modal = false,
  autoFocus,
  free,
  bar = false,
  className,
  "data-testid": testId,
  ref,
}: Props) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const labelId = useId();
  const valueId = useId();
  const noteId = useId();
  const calendarId = useId();
  const note = error ?? hint;

  // The dialog's picks, applied by OK; it opens on the field's own.
  const [draft, setDraft] = useState<DateRange>({ from, to });

  useImperativeHandle(ref, () => ({
    open() {
      if (modal) setDraft({ from, to });
      setOpen(true);
      trigger.current?.focus();
    },
  }));

  useEffect(() => {
    if (!open || modal) return;
    function onPointerDown(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, modal]);

  function close() {
    setOpen(false);
    trigger.current?.focus();
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

  // A modal bar with dates set clears from its own X, where the chevron was.
  const quickClear = row && modal && clearable && Boolean(from);
  const openCalendar = () => {
    if (modal && !open) setDraft({ from, to });
    setOpen(!open);
  };

  return (
    <div ref={root} onKeyDown={onKeyDown} className={cn("relative flex flex-col text-sm font-semibold", !row && "gap-1.5", className)}>
      {row ? (
        <>
        <button
          ref={trigger}
          type="button"
          autoFocus={autoFocus}
          aria-labelledby={`${labelId} ${valueId}`}
          aria-describedby={note ? noteId : undefined}
          aria-expanded={open}
          aria-controls={calendarId}
          data-testid={testId}
          onClick={openCalendar}
          className={cn("flex min-h-16 w-full items-center gap-3 rounded-[inherit] px-3.5 py-3 text-left outline-none transition-colors duration-300 ease-calm hover:bg-surface-2 focus-visible:bg-surface-2", bar && "max-sm:min-h-14 max-sm:py-2 sm:min-h-20 sm:px-4", quickClear && "pr-16")}
        >
          <span className={cn("flex size-9.5 shrink-0 items-center justify-center rounded-xl bg-action-tint text-action-ink", bar && "max-sm:size-8")}>
            <CalendarGlyph className={cn("size-5", bar && "max-sm:size-4.5")} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span id={labelId} className="text-xs font-semibold text-muted">
              {label}
            </span>
            <span id={valueId} className={cn("text-control font-bold", bar && "max-sm:text-sm", !value && "text-muted")}>
              {value ?? placeholder ?? (single ? "Add a date" : "Add dates")}
              {note && (
                <span id={noteId} className={cn("font-medium", error ? "text-danger" : "text-muted")}>
                  {" "}· {note}
                </span>
              )}
            </span>
          </span>
          {!quickClear && (
            <ChevronGlyph direction={modal ? "down" : open ? "down" : "right"} className="size-4.5 shrink-0 text-muted" />
          )}
        </button>
        {quickClear && (
          // Beside the trigger rather than in it (a button can't hold one), over its right end.
          <button
            type="button"
            aria-label={single ? "Clear date" : "Clear dates"}
            onClick={() => {
              setOpen(false);
              onChange({ from: "", to: "" });
            }}
            className="absolute right-3 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full text-muted outline-none transition-colors duration-150 ease-calm hover:bg-surface-2 hover:text-foreground focus-visible:ring-4 focus-visible:ring-sky-mist"
          >
            <CloseGlyph className="size-4.5" />
          </button>
        )}
        </>
      ) : (
      <>
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
        onClick={openCalendar}
        className={cn(
          "flex items-center justify-between gap-2 min-h-12 rounded-control border bg-surface px-4 py-2.5 text-left font-normal outline-none",
          "focus:border-primary focus:ring-4 focus:ring-sky-mist disabled:bg-surface-2",
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
      </>
      )}

      {open && !modal && (
        <div
          id={calendarId}
          role="group"
          aria-label={label}
          className={cn(
            "flex w-full flex-col gap-2 bg-surface p-3 font-normal",
            row ? "border-t border-line" : "card-edge rounded-control",
            !row && (inline ? "mt-1" : "absolute left-0 top-full z-20 mt-1 shadow-lift sm:w-80"),
          )}
        >
          <DateRangeCalendar from={from} to={to} onChange={onChange} min={min} single={single} keepStart={keepStart} onComplete={close} free={free} />

          <div className="flex justify-end gap-1 text-sm">
            {clearable && from && (
              <button
                type="button"
                onClick={() => {
                  onChange({ from: "", to: "" });
                  close();
                }}
                className="rounded-control px-2 py-1 font-medium text-primary hover:bg-surface-2"
              >
                Clear
              </button>
            )}
            <button type="button" onClick={close} className="rounded-control px-2 py-1 font-medium text-primary hover:bg-surface-2">
              Done
            </button>
          </div>
        </div>
      )}

      {modal && (
        <Dialog
          open={open}
          onClose={close}
          placement="overlay"
          title={label}
          meta={draft.from && draft.to ? formatDateRange(draft.from, draft.to) : draft.from ? "Now pick the last day" : (placeholder ?? "Pick the first day")}
          actions={
            <>
              <button
                type="button"
                onClick={() => setDraft({ from: "", to: "" })}
                disabled={!draft.from}
                className="min-h-11 px-2 text-control font-semibold text-primary underline underline-offset-4 disabled:text-muted disabled:no-underline"
              >
                Clear
              </button>
              <Button
                type="button"
                disabled={Boolean(draft.from) && !draft.to}
                onClick={() => {
                  onChange(draft);
                  close();
                }}
                data-testid={testId && `${testId}-ok`}
              >
                OK
              </Button>
            </>
          }
          data-testid={testId && `${testId}-dialog`}
        >
          <div id={calendarId}>
            <DateRangeCalendar from={draft.from} to={draft.to} onChange={setDraft} min={min} single={single} keepStart={keepStart} months={2} free={free} />
          </div>
        </Dialog>
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
