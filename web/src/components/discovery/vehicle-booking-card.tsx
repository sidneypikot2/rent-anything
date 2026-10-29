"use client";

import { useState, type ReactNode } from "react";
import type { ListingDetail } from "@/api/discovery";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Ticket, TicketNote } from "@/components/ui/ticket";
import { useSession } from "@/lib/auth/session";
import { addPreview } from "@/components/trips/add-preview";
import { addDays, formatDateRange, todayIso } from "@/components/trips/format";
import { PeopleAndVehicles, MAX_PEOPLE } from "@/components/trips/people-and-vehicles";
import { DeliveryOptions, needsAddress, NO_DELIVERY, type Delivery } from "@/components/trips/delivery-options";
import { formatRentalSpan, PickupTimeRow, rentalClock } from "@/components/trips/pickup-time";
import { DateRangeField } from "@/components/ui/date-range-field";
import { PriceBreakdown, usePriceBreakdown } from "@/components/trips/price-breakdown";
import { useOptionalTripAdd } from "@/components/trips/trip-add-provider";
import type { TripDates } from "@/components/trips/trip-dates";
import { peopleText, rentalDays, seatsLabel, unitsNeeded, vehicleNoun } from "@/components/trips/vehicle-party";
import { useShopListings } from "@/components/trips/use-shop-listings";
import { ShopPopup } from "./shop-popup";

type Rate = NonNullable<ListingDetail["vehicle_rate"]>;

// A rental vehicle's booking card (RAA-191, the plan's mock 1): its seats, how many are free on
// the page's dates, the people and the vehicles they take (PeopleAndVehicles), its price from
// its rate (rent for each vehicle and day, the refundable deposit for each) and Add to trip with
// both. A group that needs more than are free is told so and can't add; "More from this shop"
// opens the shop's other models (ShopPopup). The price is the API's, as checkout charges it,
// as are the pickup times free on the dates and when it is due back (RAA-195).
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
  seats: number;
  add?: boolean;
  // Over Add to trip: on the listing page, what saving costs and whether the trip holds it.
  aside?: ReactNode;
}) {
  const session = useSession();
  const flow = useOptionalTripAdd();
  const category = listing.category.name;
  // The people are the trip's (the page's guests: the trip's when one is shown, RAA-191), not asked here.
  const people = Math.min(Math.max(dates.guests, 1), MAX_PEOPLE);
  const [units, setUnits] = useState(unitsNeeded(people, seats));
  const [shopOpen, setShopOpen] = useState(false);
  // Its pickup time (RAA-195): null takes the shop's default until the guest picks one.
  const [pickupTime, setPickupTime] = useState<string | null>(null);
  // Delivery and pick-up (RAA-195), where the shop offers them. In a side panel (`add={false}`)
  // the add sheet asks them instead, as its foot's Add to trip opens it.
  const [delivery, setDelivery] = useState<Delivery>(NO_DELIVERY);
  const fees = { delivery: rate.delivery_fee_cents, returnPickup: rate.return_pickup_fee_cents };
  const chosenDelivery = canAdd ? delivery : null;
  // Its own dates, the page's at first: a bike for 1 day of a week-long trip. One date is one day.
  const [rental, setRental] = useState({ from: dates.from ?? "", to: dates.to ?? "" });
  const from = rental.from || undefined;
  const to = rental.from ? rental.to || addDays(rental.from, 1) : undefined;
  const dated = Boolean(from && to);
  const shop = useShopListings(listing.business.id, listing.category.slug, from, to, pickupTime);
  const models = shop.data?.listings ?? [];
  const free = dated ? (models.find((model) => model.id === listing.id)?.units_free ?? null) : null;
  const others = models.filter((model) => model.id !== listing.id).length;

  const needed = unitsNeeded(people, seats);
  const short = free !== null && needed > free;
  const days = rentalDays(from, to);
  // Priced by the API as checkout will (RAA-191): the vehicles for the days, the deposit apart.
  const breakdown = usePriceBreakdown([{ listingId: listing.id, startsOn: from, endsOn: to, quantity: people, units, pickupTime, delivery: chosenDelivery }]);
  const pickupTimes = breakdown.price?.pickupTimes;
  const returnsAt = breakdown.price?.returnsAt;
  const noun = vehicleNoun(category);
  const nouns = (count: number) => vehicleNoun(category, count);
  const model = models.find((each) => each.id === listing.id);
  const span = model?.starts_at && model.ends_at ? formatRentalSpan(model.starts_at, model.ends_at) : formatDateRange(from, to);
  const guest = !session || session.user.role === "guest";
  const busy = flow?.busyListingId === listing.id;

  return (
    <Card clip={false} data-testid="vehicle-booking">
      <CardBody pad="lg" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-3">
            <p className="text-lg font-semibold">{listing.title}</p>
            <Badge tone="kind" data-testid="vehicle-seats">
              {seatsLabel(seats, category)}
            </Badge>
          </div>
          <p className="text-sm text-muted" data-testid="vehicle-free">
            {seats} per {noun}
            {free !== null && ` · ${free} available · ${span}`}
          </p>
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
            hint={from && to ? `${days} ${days === 1 ? "day" : "days"} · back ${formatDateRange(to, to)}` : undefined}
            data-testid="vehicle-dates"
          />
          <PeopleAndVehicles
            people={people}
            units={units}
            seats={seats}
            category={category}
            free={free}
            fixedPeople
            onChange={(_people, nextUnits) => setUnits(nextUnits)}
            data-testid="vehicle-party"
          />
          {short && (
            <TicketNote tone="warning" data-testid="vehicle-short">
              {peopleText(people)} {people === 1 ? "needs" : "need"} {needed} {nouns(needed)}, and only {free} {free === 1 ? "is" : "are"}{" "}
              available. Pick other dates or add another listing.
            </TicketNote>
          )}
          {pickupTimes && (
            <PickupTimeRow
              times={pickupTimes}
              value={pickupTime ?? (returnsAt ? rentalClock(returnsAt) : null)}
              onChange={setPickupTime}
              returnsAt={returnsAt}
            />
          )}
          {canAdd && <DeliveryOptions fees={fees} value={delivery} onChange={setDelivery} />}
          <PriceBreakdown breakdown={breakdown} />
        </Ticket>


        {canAdd && aside}
        {guest && canAdd && flow && (
          <Button
            size="touch"
            glyph="plus"
            data-testid="add-to-trip"
            loading={busy}
            disabled={session === undefined || short || needsAddress(delivery)}
            onClick={() =>
              flow.add({
                listingId: listing.id,
                title: listing.title,
                range: true,
                bookingType: listing.booking_type,
                startsOn: from,
                endsOn: to,
                quantity: people,
                units,
                pickupTime,
                delivery: chosenDelivery,
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
            More from this shop · {others} other {others === 1 ? "model" : "models"}
          </button>
        )}
      </CardBody>
      {shopOpen && (
        <ShopPopup
          business={listing.business}
          category={listing.category}
          area={listing.area.name}
          dates={{ ...dates, from, to }}
          people={people}
          onClose={() => setShopOpen(false)}
        />
      )}
    </Card>
  );
}
