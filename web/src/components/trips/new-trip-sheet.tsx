"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { DateRangeField } from "@/components/ui/date-range-field";
import { GuestsGlyph } from "@/components/discovery/tag-glyphs";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Stepper } from "@/components/ui/stepper-field";
import { Ticket, TicketRow } from "@/components/ui/ticket";
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
    <Dialog open onClose={onClose} placement="sheet" title="A new trip" meta="Name it, then add things from any place" data-testid="new-trip-sheet">
      <form onSubmit={submit} className="flex flex-1 flex-col gap-4">
        <fieldset disabled={create.isPending} className="flex flex-col gap-4">
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
          <Ticket>
            <DateRangeField
              row
              label="Dates"
              min={todayIso()}
              from={startsOn}
              to={endsOn}
              onChange={setDates}
              clearable
              error={dateError}
              hint="optional"
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
                  testId="new-trip-guests"
                />
              }
            />
          </Ticket>
        </fieldset>

        {create.error && (
          <p role="alert" className="text-sm text-danger">
            {create.error.message}
          </p>
        )}

        <DialogFooter>
          <Button type="submit" data-testid="new-trip-save" loading={create.isPending}>
            {create.isPending ? "Creating…" : "Create trip"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
