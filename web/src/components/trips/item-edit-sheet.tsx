"use client";

import { useQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { apiClient } from "@/api/client";
import { CANCELLATION_POLICY } from "@/components/bookings/cancellation";
import { CategoryGlyph, GuestsGlyph, TickGlyph } from "@/components/discovery/tag-glyphs";
import { BOOKING_STATE } from "@/components/landing/launch-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DateRangeField } from "@/components/ui/date-range-field";
import { Dialog, DialogFooter, useChanged } from "@/components/ui/dialog";
import { Stepper } from "@/components/ui/stepper-field";
import { Ticket, TicketNote, TicketRow } from "@/components/ui/ticket";
import { daysBetween, guestLimitHint, noNightError, RANGE_TYPES, rentLimitHint, todayIso } from "./format";
import { ItemThumb } from "./item-thumb";
import { evenRooms, headcount, partyFromGuests, roomGuestsToSend, stayRules, type Room } from "./party";
import { RoomsAndGuests } from "./rooms-and-guests";
import { VehicleCounters } from "./people-and-vehicles";
import { PickupTimeRow, rentalClock } from "./pickup-time";
import { useListingPrices } from "./use-listing-price";
import { unitsFor } from "./vehicle-party";
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
// keeps its count until the guest lowers it. It opens on what is being changed: the listing's
// photo, name and kind, the trip it is in, then the nights the new dates make, its cancellation
// policy and that nothing is paid yet, so a guest changing it from a card knows what they hold.
// A stay's guests are its rooms (RAA-184): the split it was added with, or its guests spread
// evenly, in the rooms picker under the listing's rules (fetched, as the panel does). A vehicle
// rental's pickup time changes here too (RAA-195).
export function ItemEditSheet({ trip, item, onClose, onSaved }: Props) {
  const range = RANGE_TYPES.has(item.booking_type);
  // The trip's dates are a starting point only while they're still ahead.
  const tripAhead = trip.starts_on && trip.starts_on >= todayIso() ? trip : null;
  const [{ from: startsOn, to: endsOn }, setDates] = useState({
    from: item.starts_on ?? tripAhead?.starts_on ?? "",
    to: item.ends_on ?? tripAhead?.ends_on ?? "",
  });
  const [guests, setGuests] = useState(item.quantity);
  // A rental vehicle's units once the guest changes them (RAA-191).
  const [units, setUnits] = useState<number | null>(null);
  // A vehicle rental's pickup time (RAA-195): its own, until the guest picks another; the API
  // says which of the shop's are free on the dates and when it is due back.
  const vehicle = item.seats !== null || item.returns_at !== null;
  const [pickupTime, setPickupTime] = useState<string | null>(item.pickup_time);
  const update = useUpdateTripItem();
  // Gear is booked by the count: how many, up to the units the partner lists (max_quantity).
  const gear = item.listing.group === "gear";
  const maxGuests = Math.max(item.max_quantity ?? 99, item.quantity);
  const stay = item.booking_type === "stay";
  const { data: listing } = useQuery({
    queryKey: ["listing", item.listing.id],
    queryFn: async () => {
      const { data, error } = await apiClient().GET("/api/v1/listings/{id}", { params: { path: { id: item.listing.id } } });
      if (error || !data) throw new Error("Couldn't load this listing");
      return data;
    },
    enabled: stay,
    staleTime: 5 * 60_000,
  });
  const rules = stay && listing ? stayRules(listing.details, listing.units_count, listing.fees) : null;
  const [typedRooms, setRooms] = useState<{ rooms: Room[]; pets: number } | null>(null);
  // Closing asks first once something here has changed.
  const dirty = useChanged({ startsOn, endsOn, guests, units, typedRooms });
  const arrangement = rules ? (typedRooms ?? { rooms: startingRooms(trip, item, rules), pets: item.pets }) : null;

  // A single-day booking has one date; the API takes it as from–to of that day.
  const itemEnds = range ? endsOn : startsOn;
  const noNight = noNightError(item.booking_type, startsOn, endsOn);
  const valid = Boolean(startsOn && itemEnds) && !noNight;
  const nights = item.booking_type === "stay" && valid ? daysBetween(startsOn, endsOn) : null;
  const policy = CANCELLATION_POLICY[item.cancellation_policy];
  const [rental] = useListingPrices(
    vehicle
      ? [{ listingId: item.listing.id, startsOn: valid ? startsOn : undefined, endsOn: valid ? itemEnds : undefined, quantity: guests, units: units ?? item.units_chosen ?? undefined, pickupTime }]
      : [],
  );
  const where = item.destination?.name ?? item.area.name;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!valid) return;
    const dates = { starts_on: startsOn, ends_on: itemEnds };
    // A split sets the guests; a shared room takes none, so its guests go as they are.
    const split = arrangement && rules ? roomGuestsToSend(arrangement.rooms, rules) : null;
    // A vehicle's units go with its people: the ones chosen, or null to derive them (RAA-191).
    const vehicleUnits = {
      ...(item.seats ? { units: units ?? item.units_chosen } : {}),
      ...(vehicle && pickupTime !== item.pickup_time ? { pickup_time: pickupTime } : {}),
    };
    const changes = !arrangement
      ? { ...dates, quantity: guests, ...vehicleUnits }
      : split
        ? { ...dates, room_guests: split, pets: arrangement.pets }
        : { ...dates, quantity: headcount(arrangement.rooms[0]), pets: arrangement.pets };
    update.mutate({ id: item.id, changes }, { onSuccess: onSaved });
  }

  return (
    // Named after the listing, with the trip it is in (the modal redesign): the rows say what
    // changes, the button says it saves.
    <Dialog
      open
      onClose={onClose} dirty={dirty}
      placement="sheet"
      title={item.listing.title}
      meta={
        <>
          {[item.listing.category, where].filter(Boolean).join(" · ")}
          <span className="flex items-center gap-1.5 font-medium text-primary">
            <TickGlyph aria-hidden className="size-3.5 shrink-0" />
            <span className="truncate">In {trip.name}</span>
          </span>
        </>
      }
      thumb={<ItemThumb item={item} />}
      data-testid="item-edit-sheet"
    >
      <form onSubmit={submit} className="flex flex-1 flex-col gap-4">
        <fieldset disabled={update.isPending} className="flex flex-col gap-4">
          <Ticket>
            <DateRangeField
              row
              label={range ? "Dates" : "Date"}
              single={!range}
              min={todayIso()}
              from={startsOn}
              to={endsOn}
              onChange={setDates}
              hint={
                range && startsOn && !endsOn
                  ? "Pick the last day too"
                  : nights
                    ? `${nights} ${nights === 1 ? "night" : "nights"}`
                    : undefined
              }
              error={noNight}
            />
            {arrangement && rules ? (
              <RoomsAndGuests
                row
                rooms={arrangement.rooms}
                pets={arrangement.pets}
                rules={rules}
                onChange={(rooms, pets) => setRooms({ rooms, pets })}
                data-testid="item-edit-rooms"
              />
            ) : item.seats ? (
              <div className="flex flex-col gap-1 px-3.5 py-3" data-testid="item-edit-vehicles">
                <VehicleCounters
                  people={guests}
                  units={units ?? unitsFor(guests, item.seats, item.units_chosen)}
                  seats={item.seats}
                  category={item.listing.category}
                  free={item.units_free}
                  onChange={(people, next) => {
                    setGuests(people);
                    setUnits(next);
                  }}
                  testId="item-edit-vehicles"
                />
              </div>
            ) : (
              <TicketRow
                icon={gear ? <CategoryGlyph name={item.listing.category ?? ""} /> : <GuestsGlyph />}
                value={gear ? "How many" : "Guests"}
                detail={(gear ? rentLimitHint(item.max_quantity) : guestLimitHint(item.max_guests))?.toLowerCase()}
                control={
                  <Stepper label={gear ? "How many" : "Guests"} value={guests} onChange={setGuests} min={1} max={maxGuests} testId="item-edit-guests" />
                }
                data-testid="item-edit-guests"
              />
            )}
            {rental?.data?.pickup_times && (
              <PickupTimeRow
                times={rental.data.pickup_times}
                value={pickupTime ?? (rental.data.returns_at ? rentalClock(rental.data.returns_at) : null)}
                onChange={setPickupTime}
                returnsAt={rental.data.returns_at}
              />
            )}
            {rental?.data?.unavailable && <TicketNote tone="warning">{rental.data.unavailable}</TicketNote>}
            {item.unavailable && <TicketNote tone="warning">{item.unavailable}. Pick other dates to keep it.</TicketNote>}
          </Ticket>
        </fieldset>

        <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
          {policy && (
            <Badge tone={item.cancellation_policy === "non_refundable" ? "fact" : "emerald"} className="min-h-6 px-2.5 text-xs">
              {policy.name}
            </Badge>
          )}
          <span>Saved to your trip; {BOOKING_STATE.unpaid}.</span>
        </div>

        {update.error && (
          <p role="alert" className="text-sm text-danger">
            {update.error.message}
          </p>
        )}

        <DialogFooter>
          <Button type="submit" data-testid="item-edit-save" loading={update.isPending} disabled={!valid || (stay && !listing)}>
            {update.isPending ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

// A stay's rooms as it was added: its own split, or its guests spread evenly — the trip's party
// when the stay is for all of it, otherwise adults.
function startingRooms(trip: Trip, item: TripItem, rules: ReturnType<typeof stayRules>): Room[] {
  if (item.room_guests) return item.room_guests;
  const party = item.quantity === trip.guests ? partyFromGuests(trip.guests, trip) : partyFromGuests(item.quantity);
  return evenRooms(party, rules);
}
