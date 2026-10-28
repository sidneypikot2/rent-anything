"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { GuestsGlyph, ChevronGlyph } from "@/components/discovery/tag-glyphs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Dialog, DialogSummary } from "@/components/ui/dialog";
import { StepperField } from "@/components/ui/stepper-field";
import { peopleText, riders, unitsNeeded, vehicleNoun, vehiclePartyText } from "./vehicle-party";

type Props = {
  people: number;
  units: number;
  seats: number;
  // The vehicle's category ("Motorcycle"), for its words.
  category?: string;
  // Units free on the dates, when known: + stops there.
  free?: number | null;
  onChange: (people: number, units: number) => void;
  disabled?: boolean;
  "data-testid"?: string;
};

// The width from which the picker is a popover; below it, a bottom sheet (Tailwind's sm).
const WIDE = "(min-width: 40rem)";
export const MAX_PEOPLE = 50;

// People and the vehicles they take (RAA-191, the plan's mock 1): a ticket row summing them up
// ("10 people · 5 motorbikes") that opens the counters, a popover from sm and a bottom sheet on a
// phone, as RoomsAndGuests does for a stay. People go from 1 to 50; the vehicles start at what the
// people need (people ÷ seats, rounded up), − stops there and + at one each or what is free.
// Under them, how the people ride: "2 riders" a motorbike, "1 rider" for any past the minimum.
export function PeopleAndVehicles({ people, units, seats, category, free, onChange, disabled, "data-testid": testId }: Props) {
  const [open, setOpen] = useState<"popover" | "sheet" | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const labelId = useId();
  const valueId = useId();
  const panelId = useId();
  const nouns = vehicleNoun(category, 2);
  const label = `People and ${nouns}`;
  const summary = vehiclePartyText(people, units, category);

  useEffect(() => {
    if (open !== "popover") return;
    function onPointerDown(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(null);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function close() {
    setOpen(null);
    trigger.current?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Escape" || open !== "popover") return;
    event.preventDefault();
    event.stopPropagation();
    close();
  }

  const body = <VehicleCounters people={people} units={units} seats={seats} category={category} free={free} onChange={onChange} testId={testId} />;

  return (
    <div ref={root} onKeyDown={onKeyDown} className="relative flex flex-col text-sm font-semibold">
      <button
        ref={trigger}
        type="button"
        disabled={disabled}
        aria-labelledby={`${labelId} ${valueId}`}
        aria-expanded={open !== null}
        aria-controls={open === "popover" ? panelId : undefined}
        data-testid={testId}
        onClick={() => setOpen(open ? null : window.matchMedia(WIDE).matches ? "popover" : "sheet")}
        className="flex min-h-16 w-full items-center gap-3 px-3.5 py-3 text-left outline-none transition-colors duration-300 ease-calm hover:bg-surface-2 focus-visible:bg-surface-2 disabled:opacity-50"
      >
        <span className="flex size-9.5 shrink-0 items-center justify-center rounded-xl bg-action-tint text-action-ink">
          <GuestsGlyph className="size-5" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span id={labelId} className="text-xs font-semibold text-muted">
            {label}
          </span>
          <span id={valueId} className="text-control font-bold">
            {summary}
          </span>
        </span>
        <ChevronGlyph direction={open === "popover" ? "down" : "right"} className="size-4.5 shrink-0 text-muted" />
      </button>

      {open === "popover" && (
        <div
          id={panelId}
          role="group"
          aria-label={label}
          className="flex flex-col gap-3 border-t border-line px-3.5 py-3 font-normal"
          data-testid={testId && `${testId}-panel`}
        >
          {body}
          <Button type="button" variant="ghost" size="sm" className="self-end" onClick={close} data-testid={testId && `${testId}-done`}>
            Done
          </Button>
        </div>
      )}
      <Dialog
        open={open === "sheet"}
        onClose={() => setOpen(null)}
        placement="sheet"
        title={label}
        summary={<DialogSummary value={summary} />}
        actions={
          <Button type="button" onClick={() => setOpen(null)} data-testid={testId && `${testId}-done`}>
            Done
          </Button>
        }
      >
        <div className="flex flex-col gap-3 font-normal">{body}</div>
      </Dialog>
    </div>
  );
}

// The People and vehicles counters with how the people ride, for the picker and the add and edit
// sheets.
export function VehicleCounters({
  people,
  units,
  seats,
  category,
  free,
  onChange,
  testId,
}: Omit<Props, "disabled" | "data-testid"> & { testId?: string }) {
  const needed = unitsNeeded(people, seats);
  const most = Math.max(needed, Math.min(people, free ?? people));
  const noun = vehicleNoun(category);
  const nouns = vehicleNoun(category, 2);
  // A new head count keeps the vehicles the guest added past the minimum, while they still fit.
  const setPeople = (next: number) => {
    const extra = units - needed;
    const nextNeeded = unitsNeeded(next, seats);
    onChange(next, Math.max(nextNeeded, Math.min(nextNeeded + extra, next, free ?? next)));
  };
  return (
    <>
      <StepperField
        label="People"
        hint={noun === "motorbike" ? "Riders and passengers" : "Drivers and passengers"}
        value={people}
        min={1}
        max={MAX_PEOPLE}
        onChange={setPeople}
        data-testid={testId && `${testId}-people`}
      />
      <StepperField
        label={nouns[0].toUpperCase() + nouns.slice(1)}
        hint={`At least ${needed} for ${peopleText(people)}`}
        value={units}
        min={needed}
        max={most}
        onChange={(value) => onChange(people, value)}
        data-testid={testId && `${testId}-units`}
      />
      <div className="flex flex-wrap gap-1.5" aria-label={`Riders on each ${noun}`} data-testid={testId && `${testId}-riders`}>
        {riders(people, seats, units).map((load, index) => (
          <Badge key={index} tone={load < seats && units > needed && index >= units - (units - needed) ? "mist" : "kind"} className={cn("tabular-nums")}>
            {load} {load === 1 ? (noun === "motorbike" ? "rider" : "person") : noun === "motorbike" ? "riders" : "people"}
          </Badge>
        ))}
      </div>
    </>
  );
}
