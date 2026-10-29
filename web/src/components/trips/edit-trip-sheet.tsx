"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { DateRangeField } from "@/components/ui/date-range-field";
import { GuestsGlyph } from "@/components/discovery/tag-glyphs";
import { Dialog, DialogFooter, useChanged } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Stepper } from "@/components/ui/stepper-field";
import { Ticket, TicketRow } from "@/components/ui/ticket";
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
  const [{ from: startsOn, to: endsOn }, setDates] = useState({ from: trip.starts_on ?? "", to: trip.ends_on ?? "" });
  const [guests, setGuests] = useState(String(trip.guests));
  // Closing asks first once something here has changed.
  const dirty = useChanged({ name, startsOn, endsOn, guests });
  const update = useUpdateTrip();

  const dateError = Boolean(startsOn) !== Boolean(endsOn) ? "Pick both dates, or neither" : undefined;
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
    // Named after the trip it edits (the modal redesign).
    <Dialog open onClose={onClose} dirty={dirty} placement="sheet" title={trip.name} meta="Rename it, or change its dates and guests" data-testid="edit-trip-sheet">
      <form onSubmit={submit} className="flex flex-1 flex-col gap-4">
        <fieldset disabled={update.isPending} className="flex flex-col gap-4">
          <Field
            label="Trip name"
            name="name"
            value={name}
            maxLength={80}
            required
            autoFocus={focus === "name"}
            onChange={(event) => setName(event.target.value)}
          />
          <Ticket>
            <DateRangeField
              row
              label="Dates"
              // Today at the earliest: the API refuses a past date being set. An under-way
              // trip keeps its start, and a pick moves only its end.
              min={todayIso()}
              from={startsOn}
              to={endsOn}
              onChange={setDates}
              clearable
              autoFocus={focus === "dates"}
              error={dateError}
            />
            <TicketRow
              icon={<GuestsGlyph />}
              value="Guests"
              detail="up to 50"
              control={
                <Stepper
                  label="Guests"
                  value={guestsValid ? guestsNumber : 1}
                  onChange={(value) => setGuests(String(value))}
                  min={1}
                  max={50}
                  testId="edit-trip-guests"
                />
              }
            />
          </Ticket>
        </fieldset>

        {update.error && (
          <p role="alert" data-testid="edit-trip-error" className="text-sm text-danger">
            {update.error.message}
          </p>
        )}

        <DialogFooter>
          <Button type="submit" data-testid="edit-trip-save" loading={update.isPending}>
            {update.isPending ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
