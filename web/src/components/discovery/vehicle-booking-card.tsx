"use client";

import { useState } from "react";
import type { ListingDetail } from "@/api/discovery";
import { CalendarGlyph } from "@/components/discovery/tag-glyphs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Ticket, TicketNote, TicketRow } from "@/components/ui/ticket";
import { useSession } from "@/lib/auth/session";
import { formatPeso } from "@/lib/money";
import { addPreview } from "@/components/trips/add-preview";
import { formatDateRange } from "@/components/trips/format";
import { PeopleAndVehicles, MAX_PEOPLE } from "@/components/trips/people-and-vehicles";
import { useOptionalTripAdd } from "@/components/trips/trip-add-provider";
import type { TripDates } from "@/components/trips/trip-dates";
import { peopleText, rentalDays, seatsLabel, unitsNeeded, vehicleNoun } from "@/components/trips/vehicle-party";
import { useShopListings } from "@/components/trips/use-shop-listings";
import { ShopPopup } from "./shop-popup";

type Rate = NonNullable<ListingDetail["vehicle_rate"]>;

// A rental vehicle's booking card (RAA-191, the plan's mock 1): its seats, how many are free on
// the page's dates, the people and the vehicles they take (PeopleAndVehicles), an estimate from
// its rate (rent for each vehicle and day, the refundable deposit for each) and Add to trip with
// both. A group that needs more than are free is told so and can't add; "More from this shop"
// opens the shop's other models (ShopPopup). The price is an estimate: rentals are confirmed with
// the partner at checkout.
// `add={false}` in a side panel, whose foot holds Add to trip.
export function VehicleBookingCard({
  listing,
  rate,
  dates,
  seats,
  add: canAdd = true,
}: {
  listing: ListingDetail;
  rate: Rate;
  dates: TripDates;
  seats: number;
  add?: boolean;
}) {
  const session = useSession();
  const flow = useOptionalTripAdd();
  const category = listing.category.name;
  const [people, setPeople] = useState(Math.min(Math.max(dates.guests, 1), MAX_PEOPLE));
  const [units, setUnits] = useState(unitsNeeded(people, seats));
  const [shopOpen, setShopOpen] = useState(false);
  const dated = Boolean(dates.from && dates.to);
  const shop = useShopListings(listing.business.id, listing.category.slug, dates.from, dates.to);
  const models = shop.data?.listings ?? [];
  const free = dated ? (models.find((model) => model.id === listing.id)?.units_free ?? null) : null;
  const others = models.filter((model) => model.id !== listing.id).length;

  const needed = unitsNeeded(people, seats);
  const short = free !== null && needed > free;
  const days = rentalDays(dates.from, dates.to);
  const rent = units * rate.daily_price_cents * days;
  const deposit = units * (rate.security_deposit_cents ?? 0);
  const noun = vehicleNoun(category);
  const nouns = (count: number) => vehicleNoun(category, count);
  const when = formatDateRange(dates.from, dates.to);
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
            {free !== null && ` · ${free} ${free === 1 ? "unit" : "units"} available ${when}`}
          </p>
        </div>

        <Ticket>
          <TicketRow
            icon={<CalendarGlyph />}
            label="Dates"
            value={when ?? "Pick dates in the search"}
            detail={dated ? `${days} ${days === 1 ? "day" : "days"}` : undefined}
          />
          <PeopleAndVehicles
            people={people}
            units={units}
            seats={seats}
            category={category}
            free={free}
            onChange={(nextPeople, nextUnits) => {
              setPeople(nextPeople);
              setUnits(nextUnits);
            }}
            data-testid="vehicle-party"
          />
          {short && (
            <TicketNote tone="warning" data-testid="vehicle-short">
              {peopleText(people)} {people === 1 ? "needs" : "need"} {needed} {nouns(needed)}, and only {free} {free === 1 ? "is" : "are"}{" "}
              available. Pick other dates or add another listing.
            </TicketNote>
          )}
        </Ticket>

        <dl className="flex flex-col gap-1.5 text-sm" data-testid="vehicle-estimate">
          <div className="flex justify-between gap-4">
            <dt>
              {units} × {formatPeso(rate.daily_price_cents)} × {days} {days === 1 ? "day" : "days"}
            </dt>
            <dd className="tabular-nums">{formatPeso(rent)}</dd>
          </div>
          {deposit > 0 && (
            <div className="flex justify-between gap-4">
              <dt className="text-muted">
                Deposit {units} × {formatPeso(rate.security_deposit_cents ?? 0)} · refundable
              </dt>
              <dd className="tabular-nums">{formatPeso(deposit)}</dd>
            </div>
          )}
          <div className="flex justify-between gap-4 border-t border-line pt-2 font-semibold">
            <dt>Total</dt>
            <dd className="tabular-nums" data-testid="vehicle-total">
              {formatPeso(rent + deposit)}
            </dd>
          </div>
        </dl>

        {guest && canAdd && flow && (
          <Button
            size="touch"
            glyph="plus"
            data-testid="add-to-trip"
            loading={busy}
            disabled={session === undefined || short}
            onClick={() =>
              flow.add({
                listingId: listing.id,
                title: listing.title,
                range: true,
                bookingType: listing.booking_type,
                startsOn: dates.from,
                endsOn: dates.to,
                quantity: people,
                units,
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
        <p className="text-sm text-muted">The price is an estimate: the partner confirms it when they accept your request.</p>
      </CardBody>
      {shopOpen && (
        <ShopPopup
          business={listing.business}
          category={listing.category}
          area={listing.area.name}
          dates={dates}
          people={people}
          onClose={() => setShopOpen(false)}
        />
      )}
    </Card>
  );
}
