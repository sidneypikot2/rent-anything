"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { DateRangeField } from "@/components/ui/date-range-field";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { todayIso } from "./format";
import { useCreateTrip, type Trip } from "./use-trips";

type Props = {
  onClose: () => void;
  onCreated: (trip: Trip) => void;
};

// "Plan a new trip" (screen 8), for guests who name a trip before adding to it. The first
// add makes one by itself, so this is never in the way.
export function NewTripSheet({ onClose, onCreated }: Props) {
  const [name, setName] = useState("");
  const [{ from: startsOn, to: endsOn }, setDates] = useState({ from: "", to: "" });
  const [guests, setGuests] = useState("1");
  const create = useCreateTrip();

  const dateError = Boolean(startsOn) !== Boolean(endsOn) ? "Pick both dates, or neither" : undefined;
  const guestsNumber = Number(guests);
  const guestsValid = Number.isInteger(guestsNumber) && guestsNumber >= 1 && guestsNumber <= 50;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (dateError || !guestsValid || !name.trim()) return;
    create.mutate(
      { name: name.trim(), guests: guestsNumber, starts_on: startsOn || null, ends_on: endsOn || null },
      { onSuccess: onCreated },
    );
  }

  return (
    <Dialog open onClose={onClose} placement="sheet" title="Plan a new trip" data-testid="new-trip-sheet">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <fieldset disabled={create.isPending} className="flex flex-col gap-3">
          <Field
            label="Trip name"
            name="name"
            value={name}
            maxLength={80}
            required
            autoFocus
            placeholder="Bantayan – Malapascua escapade"
            onChange={(event) => setName(event.target.value)}
          />
          <DateRangeField
            label="Dates"
            min={todayIso()}
            from={startsOn}
            to={endsOn}
            onChange={setDates}
            clearable
            inline
            error={dateError}
            hint="Optional"
          />
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

        {create.error && (
          <p role="alert" className="text-sm text-danger">
            {create.error.message}
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-3">
          <Button type="button" variant="soft" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" data-testid="new-trip-save" disabled={create.isPending}>
            {create.isPending ? "Creating…" : "Create trip"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
