"use client";

import { useState, type ReactNode } from "react";
import type { ListingDetail } from "@/api/discovery";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Stepper } from "@/components/ui/stepper-field";
import { Ticket, TicketNote, TicketRow } from "@/components/ui/ticket";
import { useSession } from "@/lib/auth/session";
import { addPreview } from "@/components/trips/add-preview";
import { addDays, formatDateRange, todayIso } from "@/components/trips/format";
import { PeopleAndVehicles, MAX_PEOPLE } from "@/components/trips/people-and-vehicles";
import { AtTheShopRow, ChildHelmetsRow, DeliveryOptions, needsAddress, NO_DELIVERY, wantsDelivery, type Delivery } from "@/components/trips/delivery-options";
import { formatRentalSpan, PickupTimeRow, rentalClock } from "@/components/trips/pickup-time";
import { DateRangeField } from "@/components/ui/date-range-field";
import { PriceBreakdown, usePriceBreakdown } from "@/components/trips/price-breakdown";
import { useOptionalTripAdd } from "@/components/trips/trip-add-provider";
import type { TripDates } from "@/components/trips/trip-dates";
import { heldOfListing, peopleText, rentalDays, ridersFor, ridesHeld, seatsLabel, shopNoun, unitsNeeded, vehicleNoun } from "@/components/trips/vehicle-party";
import { CoverBar } from "@/components/trips/cover-bar";
import { useAddTargetTrip } from "@/components/trips/use-trip-here";
import { freeRun, useListingAvailability } from "@/components/trips/use-listing-availability";
import { useShopListings } from "@/components/trips/use-shop-listings";
import { ShopPopup } from "./shop-popup";
import { CategoryGlyph } from "./tag-glyphs";

type Rate = NonNullable<ListingDetail["vehicle_rate"]>;

// A rental vehicle's booking card (RAA-191, the plan's mock 1): its seats, how many are free on
// the page's dates, the people and the vehicles they take (PeopleAndVehicles), its price from
// its rate (rent for each vehicle and day, the refundable deposit for each) and Add to trip with
// both. A group that needs more than are free is told so and can't add; "More from this shop"
// opens the shop's other models (ShopPopup). The price is the API's, as checkout charges it,
// as are the pickup times free on the dates and when it is due back (RAA-195), asked right under
// the dates (RAA-205).
// Gear (RAA-255) has no `seats`: the same card, asking How many instead of the people and vehicles.
// `add={false}` in a side panel, whose foot holds Add to trip.
// `rate` says the vehicle is priced; the price itself is the API's.
export function VehicleBookingCard({
  listing,
  rate,
  dates,
  seats,
  add: canAdd = true,
  aside,
}: {
  listing: ListingDetail;
  rate: Rate;
  dates: TripDates;
  seats: number | null;
  add?: boolean;
  // Over Add to trip: on the listing page, what saving costs and whether the trip holds it.
  aside?: ReactNode;
}) {
  const session = useSession();
  const flow = useOptionalTripAdd();
  const category = listing.category.name;
  // The page's guests (RAA-191); not asked here.
  const pageGuests = Math.min(Math.max(dates.guests, 1), MAX_PEOPLE);
  const counted = seats === null;
  // How many the guest picked (a vehicle's units, or how many of the gear); null until they pick,
  // while the card suggests what the people still without a ride need (RAA-315).
  const [pickedUnits, setUnits] = useState<number | null>(null);
  const [shopOpen, setShopOpen] = useState(false);
  // Its pickup time (RAA-195): null takes the shop's default until the guest picks one.
  const [pickupTime, setPickupTime] = useState<string | null>(null);
  // Delivery and pick-up (RAA-195), where the shop offers them, to a pin on its zones (RAA-205).
  // In a side panel (`add={false}`) there are none: the guest collects it at the shop.
  const [delivery, setDelivery] = useState<Delivery>(NO_DELIVERY);
  const fees = { delivery: rate.delivery_fee_cents, returnPickup: rate.return_pickup_fee_cents };
  const chosenDelivery = canAdd ? delivery : null;
  // A motorcycle's child helmets (RAA-205), one a vehicle at most; the add sheet asks them in a panel.
  const [childHelmets, setChildHelmets] = useState(0);
  // Its own dates, the page's at first: a bike for 1 day of a week-long trip. One date is one day.
  // The calendar shows each day's units free and won't let a rental start on, or run through, a
  // day with none (RAA-315): the dates can't be wrong, so no notes after the fact. Until the guest
  // picks, the rental is the page's dates cut to the longest run with one free.
  const availability = useListingAvailability(listing.id);
  const [chosen, setRental] = useState<{ from: string; to: string } | null>(null);
  const rental = chosen ?? freeRun(availability, dates.from ?? "", dates.to ?? "") ?? { from: dates.from ?? "", to: dates.to ?? "" };
  const from = rental.from || undefined;
  // One date is one day, back the next (a one-day trip's end is its start).
  const to = rental.from ? (rental.to && rental.to > rental.from ? rental.to : addDays(rental.from, 1)) : undefined;
  const dated = Boolean(from && to);
  const shop = useShopListings(listing.business.id, counted ? { group: "gear" } : { category: listing.category.slug }, from, to, pickupTime);
  const models = shop.data?.listings ?? [];
  const others = models.filter((model) => model.id !== listing.id).length;
  // The trip the add goes to (RAA-315): its vehicle rentals on these days already give some of its
  // people a ride, and its units of this one aren't booked yet, so not out of what is free.
  const target = useAddTargetTrip(flow?.places, counted ? undefined : listing.id, from, to);
  const tripItems = target?.items ?? [];
  // The people are that trip's, as the add sheet counts them (the planner's URL carries no guests);
  // with no trip yet, the page's. Gear goes by the count.
  const people = !counted && target ? Math.min(Math.max(target.guests, 1), MAX_PEOPLE) : pageGuests;
  const held = counted ? null : ridesHeld(tripItems, from, to, people);
  const shopFree = dated ? (models.find((model) => model.id === listing.id)?.units_free ?? null) : null;
  const free = shopFree === null ? null : Math.max(shopFree - (counted ? 0 : heldOfListing(tripItems, listing.id, from, to)), 0);
  // Those still without a ride on these days; with everyone riding, the whole group, from 1 vehicle.
  const toRide = held && held.least < people ? people - held.least : people;
  const suggested = counted ? 1 : held && held.least >= people && held.units > 0 ? 1 : unitsNeeded(toRide, seats);
  // As many as the guest wants, whatever the people (RAA-315), up to what is free (or the fleet).
  const units = Math.max(1, Math.min(pickedUnits ?? suggested, free ?? listing.units_count ?? 99));
  const riding = counted ? units : ridersFor(toRide, seats, units);

  const short = free === 0;
  const days = rentalDays(from, to);
  // Priced by the API as checkout will (RAA-191): the vehicles for the days, the deposit apart.
  const helmets = canAdd ? Math.min(childHelmets, units) : 0;
  const breakdown = usePriceBreakdown([
    {
      listingId: listing.id,
      startsOn: from,
      endsOn: to,
      quantity: riding,
      units: counted ? undefined : units,
      pickupTime,
      delivery: chosenDelivery,
      childHelmets: helmets,
    },
  ]);
  const pickupTimes = breakdown.price?.pickupTimes;
  const returnsAt = breakdown.price?.returnsAt;
  const model = models.find((each) => each.id === listing.id);
  const noun = vehicleNoun(category);
  const nouns = (count: number) => (counted ? shopNoun(model ? [model] : [], count) : vehicleNoun(category, count));
  const span = model?.starts_at && model.ends_at ? formatRentalSpan(model.starts_at, model.ends_at) : formatDateRange(from, to);
  const guest = !session || session.user.role === "guest";
  const busy = flow?.busyListingId === listing.id;

  return (
    <Card clip={false} data-testid="vehicle-booking">
      <CardBody pad="lg" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-3">
            <p className="text-lg font-semibold">{listing.title}</p>
            {!counted && (
              <Badge tone="kind" data-testid="vehicle-seats">
                {seatsLabel(seats, category)}
              </Badge>
            )}
          </div>
          {(!counted || free !== null) && (
            <p className="text-sm text-muted" data-testid="vehicle-free">
              {[
                !counted && `${seats} per ${noun}`,
                free !== null && `${free} available`,
                free !== null && span,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
        </div>

        <Ticket>
          <DateRangeField
            row
            label="Rental dates"
            min={todayIso()}
            from={rental.from}
            to={rental.to}
            onChange={setRental}
            placeholder="Pick dates"
            free={availability}
            hint={from && to ? `${days} ${days === 1 ? "day" : "days"} · back ${formatDateRange(to, to)}` : undefined}
            data-testid="vehicle-dates"
          />
          {pickupTimes && (
            <PickupTimeRow
              times={pickupTimes}
              value={pickupTime ?? (returnsAt ? rentalClock(returnsAt) : null)}
              onChange={setPickupTime}
              returnsAt={returnsAt}
            />
          )}
          {counted ? (
            <TicketRow
              icon={<CategoryGlyph name={category} />}
              value="How many"
              control={
                <Stepper
                  label="How many"
                  value={units}
                  onChange={setUnits}
                  min={1}
                  max={Math.max(free ?? listing.units_count ?? 99, 1)}
                  testId="vehicle-count"
                />
              }
              data-testid="vehicle-count"
            />
          ) : (
            <PeopleAndVehicles
              people={toRide}
              units={units}
              seats={seats}
              category={category}
              free={free}
              fixedPeople
              onChange={(_people, nextUnits) => setUnits(nextUnits)}
              data-testid="vehicle-party"
            />
          )}
          {short && (
            <TicketNote tone="warning" data-testid="vehicle-short">
              None {shopFree ? "more " : ""}available on these dates. Pick other dates or add another listing.
            </TicketNote>
          )}
          {canAdd && (
            <DeliveryOptions
              fees={fees}
              value={delivery}
              onChange={setDelivery}
              zones={rate.delivery_zones}
              center={model?.approx_location}
              counted={counted}
            />
          )}
          {!wantsDelivery(chosenDelivery) && <AtTheShopRow place={listing.area.name} />}
          {canAdd && <ChildHelmetsRow fee={rate.child_helmet_fee_cents} value={helmets} max={units} onChange={setChildHelmets} />}
          <PriceBreakdown breakdown={breakdown} />
        </Ticket>

        {held && (
          <CoverBar
            people={people}
            covered={Math.min(held.least + (short ? 0 : riding), people)}
            summary={
              held.units > 0
                ? `${peopleText(people)} · ${held.units} ${nouns(held.units)} in your trip, ${units} more here`
                : `${peopleText(people)} · ${units} ${nouns(units)}, ${units * (seats ?? 1)} seats`
            }
            need="a ride"
            done="Everyone has a seat"
            data-testid="vehicle-cover"
          />
        )}


        {canAdd && aside}
        {guest && canAdd && flow && (
          <Button
            size="touch"
            glyph="plus"
            data-testid="add-to-trip"
            loading={busy}
            disabled={session === undefined || short || needsAddress(delivery) || Boolean(wantsDelivery(delivery) && breakdown.price?.unavailable)}
            onClick={() =>
              flow.add({
                listingId: listing.id,
                title: listing.title,
                range: true,
                bookingType: listing.booking_type,
                startsOn: from,
                endsOn: to,
                // A vehicle: the people it carries; gear: the page's guests, for a new trip, and how
                // many apart (the sheet's `count`).
                quantity: counted ? people : riding,
                units: counted ? undefined : units,
                count: counted ? units : undefined,
                pickupTime,
                delivery: chosenDelivery,
                childHelmets: helmets,
                guests: dates.guests,
                preview: addPreview(listing),
              })
            }
          >
            {busy ? "Adding…" : `Add ${units} ${nouns(units)} to trip`}
          </Button>
        )}

        {others > 0 && flow && (
          <button
            type="button"
            onClick={() => setShopOpen(true)}
            className="tap-target self-start text-sm font-semibold text-link underline underline-offset-4 hover:text-primary"
            data-testid="more-from-shop"
          >
            More from this shop · {others} other {counted ? (others === 1 ? "item" : "items") : others === 1 ? "model" : "models"}
          </button>
        )}
      </CardBody>
      {shopOpen && (
        <ShopPopup
          business={listing.business}
          category={listing.category}
          group={counted ? "gear" : undefined}
          area={listing.area.name}
          dates={{ ...dates, from, to }}
          people={people}
          onClose={() => setShopOpen(false)}
        />
      )}
    </Card>
  );
}
