"use client";

import { useState, type FormEvent } from "react";
import { GuestsGlyph } from "@/components/discovery/tag-glyphs";
import { RANGE_TYPES, todayIso } from "@/components/trips/format";
import { ItemThumb } from "@/components/trips/item-thumb";
import type { TripItem } from "@/components/trips/use-trips";
import { Button } from "@/components/ui/button";
import { DateRangeField } from "@/components/ui/date-range-field";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import { Stepper } from "@/components/ui/stepper-field";
import { Ticket, TicketNote, TicketRow } from "@/components/ui/ticket";
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
    // Named after the booked listing (the modal redesign); the button says where the change goes.
    <Dialog
      open
      onClose={close}
      // Closing asks first once the dates or guests differ from the booking's.
      dirty={!unchanged}
      placement="sheet"
      title={item.listing.title}
      meta={`Booking ${booking.reference}`}
      thumb={<ItemThumb item={item} />}
      data-testid="change-booking-sheet"
    >
      <form onSubmit={submit} className="flex flex-1 flex-col gap-4">
        <fieldset disabled={change.isPending} className="flex flex-col gap-4">
          <Ticket>
            <DateRangeField
              row
              label={range ? "Dates" : "Date"}
              single={!range}
              min={todayIso()}
              from={from}
              to={to}
              onChange={setDates}
              hint={range && from && !to ? "Pick the last day too" : undefined}
            />
            <TicketRow
              icon={<GuestsGlyph />}
              value="Guests"
              control={<Stepper label="Guests" value={guests} onChange={setGuests} min={1} max={99} testId="change-booking-guests" />}
              data-testid="change-booking-guests"
            />
            <TicketNote>
              The partner has to accept the change. Until they answer, your booking shows as a request and the new dates are
              held for you.
            </TicketNote>
          </Ticket>
        </fieldset>

        {change.error && (
          <p role="alert" className="text-sm text-danger">
            {change.error.message}
          </p>
        )}

        <DialogFooter>
          <Button type="submit" data-testid="change-booking-send" loading={change.isPending} disabled={!valid}>
            {change.isPending ? "Sending…" : "Send to the partner"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
