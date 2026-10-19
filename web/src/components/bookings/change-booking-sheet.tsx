"use client";

import { useState, type FormEvent } from "react";
import { RANGE_TYPES, todayIso } from "@/components/trips/format";
import type { TripItem } from "@/components/trips/use-trips";
import { Button } from "@/components/ui/button";
import { DateRangeField } from "@/components/ui/date-range-field";
import { Dialog } from "@/components/ui/dialog";
import { StepperField } from "@/components/ui/stepper-field";
import { useChangeBooking, type GuestBooking } from "./use-bookings";

// Changing a booked item's dates or guests (RAA-135): the change goes back to the partner as a
// request (PATCH /bookings/:id, RAA-134), holding the new dates while they answer. A stay or
// rental takes a range, anything else one day, as when it was added.
export function ChangeBookingSheet({
  item,
  booking,
  onClose,
  onSent,
}: {
  item: TripItem;
  booking: GuestBooking;
  onClose: () => void;
  onSent: (booking: GuestBooking) => void;
}) {
  const range = RANGE_TYPES.has(item.booking_type);
  const [{ from, to }, setDates] = useState({ from: booking.starts_on, to: booking.ends_on });
  const [guests, setGuests] = useState(booking.guests ?? item.quantity);
  const change = useChangeBooking();

  const endsOn = range ? to : from;
  const unchanged = from === booking.starts_on && endsOn === booking.ends_on && guests === (booking.guests ?? item.quantity);
  const valid = Boolean(from && endsOn) && !unchanged;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!valid) return;
    change.mutate({ id: booking.id, changes: { starts_on: from, ends_on: endsOn, guests } }, { onSuccess: onSent });
  }

  function close() {
    if (!change.isPending) onClose();
  }

  return (
    <Dialog open onClose={close} placement="sheet" title="Edit booking" data-testid="change-booking-sheet">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <p className="text-sm text-muted">
          {item.listing.title} · {booking.reference}
        </p>

        <fieldset disabled={change.isPending} className="flex flex-col gap-4">
          <DateRangeField
            label={range ? "Dates" : "Date"}
            single={!range}
            min={todayIso()}
            from={from}
            to={to}
            onChange={setDates}
            inline
            hint={range && from && !to ? "Pick the last day too" : undefined}
          />
          <StepperField label="Guests" value={guests} onChange={setGuests} min={1} max={99} data-testid="change-booking-guests" />
        </fieldset>

        <p className="rounded-control bg-surface-2 px-3 py-2.5 text-sm">
          The partner has to accept the change. Until they answer, your booking shows as a request and the new dates are
          held for you.
        </p>

        {change.error && (
          <p role="alert" className="text-sm text-danger">
            {change.error.message}
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-3">
          <Button type="button" variant="soft" onClick={close} disabled={change.isPending}>
            Cancel
          </Button>
          <Button type="submit" data-testid="change-booking-send" disabled={change.isPending || !valid}>
            {change.isPending ? "Sending…" : "Send to the partner"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
