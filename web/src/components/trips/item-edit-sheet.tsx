"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { DateRangeField } from "@/components/ui/date-range-field";
import { Dialog } from "@/components/ui/dialog";
import { StepperField } from "@/components/ui/stepper-field";
import { guestLimitHint, noNightError, RANGE_TYPES, todayIso } from "./format";
import { useUpdateTripItem, type Trip, type TripItem } from "./use-trips";

type Props = {
  trip: Trip;
  item: TripItem;
  onClose: () => void;
  onSaved: (trip: Trip) => void;
};

// Edit an item's dates and guests (screen 7). An undated item starts from the trip's dates
// (decision 9); the trip grows if the new dates fall outside it. Guests go up to what the
// listing takes (`max_guests`), so + stops there; an item added with more before the limit
// keeps its count until the guest lowers it.
export function ItemEditSheet({ trip, item, onClose, onSaved }: Props) {
  const range = RANGE_TYPES.has(item.booking_type);
  // The trip's dates are a starting point only while they're still ahead.
  const tripAhead = trip.starts_on && trip.starts_on >= todayIso() ? trip : null;
  const [{ from: startsOn, to: endsOn }, setDates] = useState({
    from: item.starts_on ?? tripAhead?.starts_on ?? "",
    to: item.ends_on ?? tripAhead?.ends_on ?? "",
  });
  const [guests, setGuests] = useState(item.quantity);
  const update = useUpdateTripItem();
  const maxGuests = Math.max(item.max_guests ?? 99, item.quantity);

  // A single-day booking has one date; the API takes it as from–to of that day.
  const itemEnds = range ? endsOn : startsOn;
  const noNight = noNightError(item.booking_type, startsOn, endsOn);
  const valid = Boolean(startsOn && itemEnds) && !noNight;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!valid) return;
    update.mutate(
      { id: item.id, changes: { starts_on: startsOn, ends_on: itemEnds, quantity: guests } },
      { onSuccess: onSaved },
    );
  }

  return (
    <Dialog open onClose={onClose} placement="sheet" title="Edit" data-testid="item-edit-sheet">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <p className="text-sm text-muted">{item.listing.title}</p>

        <fieldset disabled={update.isPending} className="flex flex-col gap-4">
          <DateRangeField
            label={range ? "Dates" : "Date"}
            single={!range}
            min={todayIso()}
            from={startsOn}
            to={endsOn}
            onChange={setDates}
            inline
            autoFocus
            hint={range && startsOn && !endsOn ? "Pick the last day too" : undefined}
            error={noNight}
          />
          <StepperField
            label="Guests"
            hint={guestLimitHint(item.max_guests)}
            value={guests}
            onChange={setGuests}
            min={1}
            max={maxGuests}
            data-testid="item-edit-guests"
          />
        </fieldset>

        {update.error && (
          <p role="alert" className="text-sm text-danger">
            {update.error.message}
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-3">
          <Button type="button" variant="soft" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" data-testid="item-edit-save" disabled={update.isPending || !valid}>
            {update.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
