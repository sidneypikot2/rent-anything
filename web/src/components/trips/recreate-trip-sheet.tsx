"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { DateRangeField } from "@/components/ui/date-range-field";
import { GuestsGlyph } from "@/components/discovery/tag-glyphs";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Stepper } from "@/components/ui/stepper-field";
import { Ticket, TicketNote, TicketRow } from "@/components/ui/ticket";
import { ItemThumb } from "./item-thumb";
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
    // Named after the trip being planned again (the modal redesign).
    <Dialog
      open
      onClose={onClose}
      placement="sheet"
      title={trip.name}
      meta={`Plan it again: the same ${trip.items.length === 1 ? "item" : "items"} in a new trip, nothing booked`}
      data-testid="recreate-trip-sheet"
    >
      <form onSubmit={submit} className="flex flex-1 flex-col gap-4">
        <fieldset disabled={copy.isPending} className="flex flex-col gap-4">
          <Field label="Trip name" name="name" value={name} maxLength={80} required onChange={(event) => setName(event.target.value)} />
          <Ticket>
            {dated && (
              <DateRangeField
                row
                label="New start date"
                single
                min={todayIso()}
                from={startsOn}
                to={startsOn}
                onChange={({ from }) => setStartsOn(from)}
                hint={`was ${formatDateRange(trip.starts_on, trip.ends_on)}`}
              />
            )}
            <TicketRow
              icon={<GuestsGlyph />}
              value="Guests"
              detail="up to 50"
              control={<Stepper label="Guests" value={guests} onChange={setGuests} min={1} max={50} testId="recreate-guests" />}
              data-testid="recreate-guests"
            />
          </Ticket>
        </fieldset>

        <Ticket data-testid="recreate-preview">
          {trip.items.map((item) => (
            <TicketRow
              key={item.id}
              media={<ItemThumb item={item} size="sm" />}
              value={<span className={item.listing_active ? undefined : "text-muted line-through"}>{item.listing.title}</span>}
              label={
                <span className={item.listing_active ? undefined : "text-warning"}>
                  {item.listing_active
                    ? (formatDateRange(moved(item.starts_on), moved(item.ends_on)) ?? (dated && item.starts_on ? "Pick a start date" : "No date"))
                    : "Left out: no longer available"}
                </span>
              }
            />
          ))}
          <TicketNote>Check each one&apos;s price and dates in your cart, then send the requests.</TicketNote>
        </Ticket>

        {copy.error && (
          <p role="alert" className="text-sm text-danger">
            {copy.error.message}
          </p>
        )}

        <DialogFooter>
          <Button type="submit" data-testid="recreate-trip-save" loading={copy.isPending} disabled={!ready}>
            {copy.isPending ? "Planning…" : "Add to my cart"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
