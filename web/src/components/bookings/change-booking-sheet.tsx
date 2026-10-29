"use client";

import { useState, type FormEvent } from "react";
import { CategoryGlyph, GuestsGlyph } from "@/components/discovery/tag-glyphs";
import { guestLimitHint, noNightError, RANGE_TYPES, rentLimitHint, todayIso } from "@/components/trips/format";
import { ItemThumb } from "@/components/trips/item-thumb";
import { evenRooms, headcount, partyFromGuests, roomGuestsToSend, type Room } from "@/components/trips/party";
import { VehicleCounters } from "@/components/trips/people-and-vehicles";
import { PickupTimeRow, rentalClock } from "@/components/trips/pickup-time";
import { RoomsAndGuests } from "@/components/trips/rooms-and-guests";
import { useListingPrices } from "@/components/trips/use-listing-price";
import { useStayRules } from "@/components/trips/use-stay-rules";
import type { TripItem } from "@/components/trips/use-trips";
import { Button } from "@/components/ui/button";
import { DateRangeField } from "@/components/ui/date-range-field";
import { Dialog, DialogFooter, useChanged } from "@/components/ui/dialog";
import { Stepper } from "@/components/ui/stepper-field";
import { Ticket, TicketNote, TicketRow } from "@/components/ui/ticket";
import { useChangeBooking, type BookingChanges, type GuestBooking } from "./use-bookings";

// Changing a booked item (RAA-135): the change goes back to the partner as a request
// (PATCH /bookings/:id, RAA-134), holding the new dates while they answer. It asks what the
// item sheet asks for its kind (RAA-200): a stay its rooms and guests, a vehicle its people and
// vehicles and its pickup time, gear how many, anything else its guests. A stay or rental takes
// a range, anything else one day, as when it was added.
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
  const stay = item.booking_type === "stay";
  // Gear is booked by the count: how many, up to the units the partner lists.
  const gear = item.listing.group === "gear";
  const vehicle = item.seats !== null || item.returns_at !== null;
  const startGuests = booking.guests ?? booking.quantity;
  const startPickup = item.pickup_time ?? (booking.starts_at ? rentalClock(booking.starts_at) : null);

  const [{ from, to }, setDates] = useState({ from: booking.starts_on, to: booking.ends_on });
  const [guests, setGuests] = useState(startGuests);
  const [units, setUnits] = useState(booking.quantity);
  const [pickupTime, setPickupTime] = useState(startPickup);
  const rules = useStayRules(item.listing.id, stay);
  const [typedRooms, setRooms] = useState<{ rooms: Room[]; pets: number } | null>(null);
  const arrangement = rules
    ? (typedRooms ?? { rooms: booking.room_guests ?? evenRooms(partyFromGuests(startGuests), rules), pets: booking.pets })
    : null;
  const change = useChangeBooking();

  const endsOn = range ? to : from;
  const noNight = noNightError(item.booking_type, from, to);
  const changed = useChanged({ from, endsOn, guests, units, pickupTime, typedRooms });
  const valid = Boolean(from && endsOn) && !noNight && changed && (!stay || Boolean(rules));
  // The shop's pickup times and when it is due back. Which are free counts this booking's own
  // hours as taken, so every time is offered and the change itself refuses one that clashes.
  const [rental] = useListingPrices(
    vehicle
      ? [{ listingId: item.listing.id, startsOn: from && endsOn ? from : undefined, endsOn: from && endsOn ? endsOn : undefined, quantity: guests, units: item.seats ? units : undefined, pickupTime }]
      : [],
  );
  const pickupTimes = rental?.data?.pickup_times?.map((time) => ({ ...time, available: true }));
  const countLabel = gear ? "How many" : "Guests";
  const max = Math.max((gear ? item.max_quantity : item.max_guests) ?? 99, startGuests);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!valid) return;
    const changes: BookingChanges = { starts_on: from, ends_on: endsOn };
    if (arrangement && rules) {
      // A split sets the guests; a shared room takes none, so its guests go as they are.
      const split = roomGuestsToSend(arrangement.rooms, rules);
      Object.assign(changes, split ? { room_guests: split } : { guests: headcount(arrangement.rooms[0]) }, { pets: arrangement.pets });
    } else {
      changes.guests = guests;
      if (item.seats) changes.units = units;
    }
    if (vehicle && pickupTime && pickupTime !== startPickup) changes.pickup_time = pickupTime;
    change.mutate({ id: booking.id, changes }, { onSuccess: onSent });
  }

  function close() {
    if (!change.isPending) onClose();
  }

  return (
    // Named after the booked listing (the modal redesign); the button says where the change goes.
    <Dialog
      open
      onClose={close}
      // Closing asks first once anything differs from the booking.
      dirty={changed}
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
              error={noNight}
            />
            {stay ? (
              arrangement && rules ? (
                <RoomsAndGuests
                  row
                  rooms={arrangement.rooms}
                  pets={arrangement.pets}
                  rules={rules}
                  onChange={(rooms, pets) => setRooms({ rooms, pets })}
                  data-testid="change-booking-rooms"
                />
              ) : (
                <div role="status" aria-busy className="m-3.5 h-12 rounded-control bg-mist motion-safe:animate-pulse" />
              )
            ) : item.seats ? (
              <div className="flex flex-col gap-1 px-3.5 py-3" data-testid="change-booking-vehicles">
                <VehicleCounters
                  people={guests}
                  units={units}
                  seats={item.seats}
                  category={item.listing.category}
                  onChange={(people, next) => {
                    setGuests(people);
                    setUnits(next);
                  }}
                  testId="change-booking-vehicles"
                />
              </div>
            ) : (
              <TicketRow
                icon={gear ? <CategoryGlyph name={item.listing.category ?? ""} /> : <GuestsGlyph />}
                value={countLabel}
                detail={(gear ? rentLimitHint(item.max_quantity) : guestLimitHint(item.max_guests))?.toLowerCase()}
                control={<Stepper label={countLabel} value={guests} onChange={setGuests} min={1} max={max} testId="change-booking-guests" />}
                data-testid="change-booking-guests"
              />
            )}
            {vehicle && pickupTimes && (
              <PickupTimeRow times={pickupTimes} value={pickupTime} onChange={setPickupTime} returnsAt={rental?.data?.returns_at} />
            )}
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
