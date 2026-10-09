"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { RANGE_TYPES, todayIso } from "./format";
import { useUpdateTripItem, type Trip, type TripItem } from "./use-trips";

type Props = {
  trip: Trip;
  item: TripItem;
  onClose: () => void;
  onSaved: (trip: Trip) => void;
};

// The first date the picker offers: today, or the item's own start when it's already under
// way and left as it is (the API refuses only a past date that is being set).
function minDate(current: string | null, value: string) {
  return current && value === current && current < todayIso() ? current : todayIso();
}

// "Change date" on an item (screen 7). An undated item starts from the trip's dates
// (decision 9); the trip grows if the new dates fall outside it.
export function ItemDateSheet({ trip, item, onClose, onSaved }: Props) {
  const range = RANGE_TYPES.has(item.booking_type);
  // The trip's dates are a starting point only while they're still ahead.
  const tripAhead = trip.starts_on && trip.starts_on >= todayIso() ? trip : null;
  const [startsOn, setStartsOn] = useState(item.starts_on ?? tripAhead?.starts_on ?? "");
  const [endsOn, setEndsOn] = useState(item.ends_on ?? tripAhead?.ends_on ?? "");
  const update = useUpdateTripItem();

  // A single-day booking has one date; the API takes it as from–to of that day.
  const itemEnds = range ? endsOn : startsOn;
  const backwards = Boolean(startsOn && itemEnds && itemEnds < startsOn);
  const valid = Boolean(startsOn && itemEnds) && !backwards;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!valid) return;
    update.mutate({ id: item.id, changes: { starts_on: startsOn, ends_on: itemEnds } }, { onSuccess: onSaved });
  }

  return (
    <Dialog open onClose={onClose} placement="sheet" title="Change date" data-testid="item-date-sheet">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <p className="text-sm text-muted">{item.listing.title}</p>

        <fieldset disabled={update.isPending} className="grid grid-cols-2 gap-3">
          <Field
            label={range ? "From" : "Date"}
            type="date"
            min={minDate(item.starts_on, startsOn)}
            value={startsOn}
            autoFocus
            onChange={(event) => setStartsOn(event.target.value)}
            error={backwards ? "The end can't be before the start" : undefined}
          />
          {range && (
            <Field
              label="To"
              type="date"
              min={startsOn || todayIso()}
              value={endsOn}
              onChange={(event) => setEndsOn(event.target.value)}
            />
          )}
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
          <Button type="submit" data-testid="item-date-save" disabled={update.isPending || !valid}>
            {update.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
