"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { todayIso } from "./format";
import { useUpdateTrip, type Trip } from "./use-trips";

// Which field the toast's action leads to: Rename or Change dates.
export type EditFocus = "name" | "dates";

type Props = {
  trip: Trip;
  focus: EditFocus;
  onClose: () => void;
  onSaved: (trip: Trip) => void;
};

// "Edit trip" (screen 5): name, dates and guests. The server refuses dates that would
// leave one of the trip's items outside them, and says so here.
export function EditTripSheet({ trip, focus, onClose, onSaved }: Props) {
  const [name, setName] = useState(trip.name);
  const [startsOn, setStartsOn] = useState(trip.starts_on ?? "");
  const [endsOn, setEndsOn] = useState(trip.ends_on ?? "");
  const [guests, setGuests] = useState(String(trip.guests));
  const update = useUpdateTrip();

  const halfDated = Boolean(startsOn) !== Boolean(endsOn);
  const backwards = Boolean(startsOn && endsOn && endsOn < startsOn);
  const dateError = halfDated
    ? "Pick both dates, or neither"
    : backwards
      ? "The end can't be before the start"
      : undefined;
  const guestsNumber = Number(guests);
  const guestsValid = Number.isInteger(guestsNumber) && guestsNumber >= 1 && guestsNumber <= 50;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (dateError || !guestsValid || !name.trim()) return;
    // Dates go only when they changed: an under-way trip's start is in the past, and the
    // API refuses a past date that is being set.
    const datesChanged = startsOn !== (trip.starts_on ?? "") || endsOn !== (trip.ends_on ?? "");
    const dates = datesChanged ? { starts_on: startsOn || null, ends_on: endsOn || null } : {};
    update.mutate(
      { id: trip.id, changes: { name: name.trim(), guests: guestsNumber, ...dates } },
      { onSuccess: onSaved },
    );
  }

  return (
    <Dialog open onClose={onClose} placement="sheet" title="Edit trip" data-testid="edit-trip-sheet">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <fieldset disabled={update.isPending} className="flex flex-col gap-3">
          <Field
            label="Trip name"
            name="name"
            value={name}
            maxLength={80}
            required
            autoFocus={focus === "name"}
            onChange={(event) => setName(event.target.value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="From"
              type="date"
              // Today at the earliest: the API refuses a past date being set. An under-way
              // trip's start stays valid while it's left as it is.
              min={trip.starts_on && startsOn === trip.starts_on && startsOn < todayIso() ? trip.starts_on : todayIso()}
              value={startsOn}
              autoFocus={focus === "dates"}
              onChange={(event) => setStartsOn(event.target.value)}
              error={dateError}
            />
            <Field
              label="To"
              type="date"
              min={startsOn || todayIso()}
              value={endsOn}
              onChange={(event) => setEndsOn(event.target.value)}
            />
          </div>
          <Field
            label="Guests"
            type="number"
            min={1}
            max={50}
            value={guests}
            onChange={(event) => setGuests(event.target.value)}
            error={guestsValid ? undefined : "1 to 50"}
          />
        </fieldset>

        {update.error && (
          <p role="alert" data-testid="edit-trip-error" className="text-sm text-danger">
            {update.error.message}
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-3">
          <Button type="button" variant="soft" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" data-testid="edit-trip-save" disabled={update.isPending}>
            {update.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
