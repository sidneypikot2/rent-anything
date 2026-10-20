"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { DateRangeField } from "@/components/ui/date-range-field";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { StepperField } from "@/components/ui/stepper-field";
import { addDays, daysBetween, formatDateRange, todayIso } from "./format";
import { useCopyTrip, type Trip } from "./use-trips";

export type Copied = NonNullable<ReturnType<typeof useCopyTrip>["data"]>;

// The toast after a copy: where it went, and what was left out.
export function recreatedNotice({ trip, skipped }: Copied) {
  const left = skipped.length > 0 ? ` · left out ${skipped.map((item) => item.title).join(", ")}` : "";
  return `Planned ${trip.name}${left}`;
}

// "Plan this trip again" (RAA-140): the trip copied to a new start date, every item moved by
// as many days, nothing booked, into the cart. The preview shows each item's new dates and
// the ones that will be left out because their listing can't be booked any more; the API
// decides that again when it copies.
export function RecreateTripSheet({
  trip,
  onClose,
  onCopied,
}: {
  trip: Trip;
  onClose: () => void;
  onCopied: (copied: Copied) => void;
}) {
  const dated = Boolean(trip.starts_on);
  const [name, setName] = useState(`${trip.name.slice(0, 74)} again`);
  const [startsOn, setStartsOn] = useState("");
  const [guests, setGuests] = useState(trip.guests);
  const copy = useCopyTrip();
  const shift = dated && startsOn ? daysBetween(trip.starts_on!, startsOn) : null;
  const ready = Boolean(name.trim()) && (!dated || Boolean(startsOn));

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready) return;
    copy.mutate(
      { id: trip.id, changes: { name: name.trim(), guests, ...(dated ? { starts_on: startsOn } : {}) } },
      { onSuccess: onCopied },
    );
  }

  function moved(iso: string | null) {
    return iso && shift !== null ? addDays(iso, shift) : null;
  }

  return (
    <Dialog open onClose={onClose} placement="sheet" title="Plan this trip again" data-testid="recreate-trip-sheet">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <p className="text-sm text-muted">
          The same {trip.items.length === 1 ? "item" : "items"} in a new trip in your cart, nothing booked. Check each
          one&apos;s price and dates there, then send the requests.
        </p>
        <fieldset disabled={copy.isPending} className="flex flex-col gap-3">
          <Field
            label="Trip name"
            name="name"
            value={name}
            maxLength={80}
            required
            onChange={(event) => setName(event.target.value)}
          />
          {dated && (
            <DateRangeField
              label="New start date"
              single
              min={todayIso()}
              from={startsOn}
              to={startsOn}
              onChange={({ from }) => setStartsOn(from)}
              inline
              hint={`It was ${formatDateRange(trip.starts_on, trip.ends_on)}`}
            />
          )}
          <StepperField label="Guests" value={guests} onChange={setGuests} min={1} max={50} data-testid="recreate-guests" />
        </fieldset>

        <ul className="flex flex-col gap-1.5 rounded-control bg-surface-2 p-4 text-sm" data-testid="recreate-preview">
          {trip.items.map((item) => (
            <li key={item.id} className="flex flex-wrap justify-between gap-x-3">
              <span className={item.listing_active ? "font-semibold" : "text-muted line-through"}>{item.listing.title}</span>
              <span className={item.listing_active ? "text-muted" : "font-semibold text-warning"}>
                {item.listing_active
                  ? (formatDateRange(moved(item.starts_on), moved(item.ends_on)) ??
                    (dated && item.starts_on ? "Pick a start date" : "No date"))
                  : "Left out: no longer available"}
              </span>
            </li>
          ))}
        </ul>

        {copy.error && (
          <p role="alert" className="text-sm text-danger">
            {copy.error.message}
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-3">
          <Button type="button" variant="soft" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" data-testid="recreate-trip-save" disabled={copy.isPending || !ready}>
            {copy.isPending ? "Planning…" : "Add to my cart"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
