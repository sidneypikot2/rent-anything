"use client";

import Image from "next/image";
import Link from "next/link";
import { Fragment, useState } from "react";
import { CategoryGlyph, ChevronGlyph, FeatureGlyph } from "@/components/discovery/tag-glyphs";
import { listingFeatures } from "@/components/discovery/listing-features";
import { isApiPhoto } from "@/components/landing/sample-photos";
import { transmissionLabel } from "@/components/listings/vehicle-labels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { Stepper } from "@/components/ui/stepper-field";
import { Ticket, TicketRow } from "@/components/ui/ticket";
import { useSession } from "@/lib/auth/session";
import { formatPeso } from "@/lib/money";
import { DateRangeField } from "@/components/ui/date-range-field";
import { addDays, formatDateRange, todayIso } from "@/components/trips/format";
import { DeliveryOptions, handoverLabel, NO_DELIVERY, sharedFees, wantsDelivery, type Delivery } from "@/components/trips/delivery-options";
import { formatRentalSpan, PickupTimeRow, rentalClock } from "@/components/trips/pickup-time";
import { useOptionalTripAdd } from "@/components/trips/trip-add-provider";
import { tripDatesQuery, type TripDates } from "@/components/trips/trip-dates";
import { usePriceBreakdown } from "@/components/trips/price-breakdown";
import { useShopListings } from "@/components/trips/use-shop-listings";
import { peopleText, rentalDays, seatsLabel, vehicleNoun, type ShopListing } from "@/components/trips/vehicle-party";

type Options = {
  business: { id: number; name: string };
  // The vehicles' category: its slug narrows the shop's listings, its name gives their words.
  category: { slug?: string; name: string };
  dates: TripDates;
  // The trip's people, to compare the seats picked with.
  people: number;
  // Only these of the shop's listings (What to book's filters); left out, all in the category.
  listingIds?: number[];
  // After the add has started (the add sheet takes over): a pop-up closes.
  onAdding?: () => void;
};

const seatsOf = (model: ShopListing) => (typeof model.details.seats === "number" ? model.details.seats : 1);
// What can be picked of a model: its units free on the dates, or all it has without dates.
const freeOf = (model: ShopListing) => model.units_free ?? model.units_count;

// The people each model's vehicles carry once added: one a vehicle at least, then the rest of the
// trip's people in order, up to each model's seats (the API wants at least one rider a vehicle and
// no more than they seat).
export function splitPeople(picked: { units: number; seats: number }[], people: number) {
  let left = Math.max(people - picked.reduce((sum, model) => sum + model.units, 0), 0);
  return picked.map(({ units, seats }) => {
    const more = Math.min(left, units * seats - units);
    left -= more;
    return units + more;
  });
}

// A shop's models to pick from together (RAA-191, the plan's mock 2): the trip's dates and people,
// each model with a counter up to what is free ("Sold out" when none), filtered by transmission,
// and how the seats picked compare with the people. `summary` (the API's total, the deposits apart)
// and `action` ("Add N to trip": one item per model through the add sheet, as a mix of room types
// is) go in the dialog's action bar. The shop pop-up and a vehicle business's side panel show it.
// The rental's dates start as the trip's and can be changed (a bike for 1 day of a week-long
// trip), and everything picked goes at one pickup time (RAA-195), asked right under the dates
// (RAA-205): each model says how many are free from that pickup to the return. A model's row
// opens its details in place (RAA-205), so the guest compares models without leaving the list.
export function useShopModels({ business, category, dates, people, listingIds, onAdding }: Options) {
  const session = useSession();
  const flow = useOptionalTripAdd();
  // The rental's own dates, the trip's at first; one date is one day, back the next.
  const [rental, setRental] = useState({ from: dates.from ?? "", to: dates.to ?? "" });
  const from = rental.from || undefined;
  const to = rental.from ? rental.to || addDays(rental.from, 1) : undefined;
  const [pickupTime, setPickupTime] = useState<string | null>(null);
  const shop = useShopListings(business.id, category.slug ?? "", from, to, pickupTime);
  const models = (shop.data?.listings ?? []).filter((model) => !listingIds || listingIds.includes(model.id));
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [transmission, setTransmission] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const transmissions = [...new Set(models.map((model) => model.details.transmission).filter((value): value is string => typeof value === "string"))];
  const shown = transmission ? models.filter((model) => model.details.transmission === transmission) : models;

  const days = rentalDays(from, to);
  const picked = models.filter((model) => (counts[model.id] ?? 0) > 0).map((model) => ({ model, units: counts[model.id], seats: seatsOf(model) }));
  const units = picked.reduce((sum, each) => sum + each.units, 0);
  const seats = picked.reduce((sum, each) => sum + each.units * each.seats, 0);
  const split = splitPeople(picked, people);
  // Delivery and pick-up (RAA-195): offered while every model picked (or, before any is, every
  // model here) offers it; a choice no longer offered isn't sent.
  const [delivery, setDelivery] = useState<Delivery>(NO_DELIVERY);
  const fees = sharedFees((picked.length > 0 ? picked.map((each) => each.model) : models).map((model) => model.vehicle_rate));
  const chosen = {
    ...delivery,
    delivery: delivery.delivery && fees.delivery !== null,
    returnPickup: delivery.returnPickup && fees.returnPickup !== null,
  };
  const chosenDelivery = wantsDelivery(chosen) ? chosen : null;
  // Priced by the API, each model as the add will send it: its vehicles and the people on them.
  const breakdown = usePriceBreakdown(
    picked.map((each, index) => ({ listingId: each.model.id, startsOn: from, endsOn: to, quantity: split[index], units: each.units, pickupTime, delivery: chosenDelivery })),
  );
  // The pickup times free for every model picked; before one is, the shop's (any model free then).
  const pickupTimes = (picked.length > 0 ? breakdown.price?.pickupTimes : null) ?? shop.data?.pickup_times ?? null;
  const returnsAt = (picked.length > 0 ? breakdown.price?.returnsAt : null) ?? models.find((model) => model.ends_at)?.ends_at ?? null;
  const total = breakdown.price?.total ?? null;
  const deposit = breakdown.price?.deposit ?? 0;
  const short = people - seats;
  const nouns = (count: number) => vehicleNoun(category.name, count);
  const freeDelivery = models.length > 0 && models.every((model) => model.vehicle_rate?.delivery_fee_cents === 0);
  const helmets = models.length > 0 && models.every((model) => Array.isArray(model.details.amenities) && model.details.amenities.includes("rider_helmet"));
  const guest = !session || session.user.role === "guest";

  function addPicked() {
    const [first] = picked;
    if (!first || !flow) return;
    flow.add({
      listingId: first.model.id,
      title: business.name,
      range: true,
      bookingType: "rental",
      startsOn: from,
      endsOn: to,
      quantity: split.reduce((sum, count) => sum + count, 0),
      guests: people,
      preview: { category: category.name, by: `by ${business.name}`, photo: null, price: total !== null ? formatPeso(total) : undefined },
      mix: picked.map((each, index) => ({
        listingId: each.model.id,
        title: each.model.title,
        quantity: split[index],
        units: each.units,
        roomGuests: null,
        pets: 0,
        shared: false,
        pickupTime: pickupTime ?? (returnsAt ? rentalClock(returnsAt) : null),
        delivery: chosenDelivery,
      })),
    });
    onAdding?.();
  }

  // The total checkout will charge; a rental's deposit is held at pick-up, never part of it.
  const summary = (
    <div className="flex min-w-0 flex-col gap-1" data-testid="shop-summary">
      <span className="font-display text-lg leading-tight font-extrabold tracking-tight tabular-nums">
        {!breakdown.dated ? "Pick dates" : breakdown.loading || total === null ? "…" : formatPeso(total)}
      </span>
      {deposit > 0 && <span className="text-xs text-muted">plus {formatPeso(deposit)} refundable deposit, held at pick-up</span>}
    </div>
  );

  const action =
    guest && flow ? (
      <Button glyph="plus" disabled={units === 0 || session === undefined} onClick={addPicked} data-testid="shop-add">
        {units ? `Add ${units} to trip` : `Pick a ${nouns(1)}`}
      </Button>
    ) : null;

  const body = (
    <div className="flex flex-col gap-4" data-testid="shop-models-body">
      {(freeDelivery || helmets) && (
        <div className="flex flex-wrap gap-2">
          {freeDelivery && <Badge tone="emerald">Free delivery to your stay</Badge>}
          {helmets && <Badge tone="kind">Helmets included</Badge>}
        </div>
      )}
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
          data-testid="shop-dates"
        />
        {from && to && pickupTimes && (
          <PickupTimeRow
            times={pickupTimes}
            value={pickupTime ?? (returnsAt ? rentalClock(returnsAt) : null)}
            onChange={setPickupTime}
            returnsAt={returnsAt}
          />
        )}
      </Ticket>
      <p className="text-sm text-muted">
        Your trip: <span className="font-semibold text-foreground">{peopleText(people)}</span>
        {dates.from && dates.to && from && (from !== dates.from || to !== dates.to) ? ` · its dates stay ${formatDateRange(dates.from, dates.to)}` : ""}
      </p>

      {transmissions.length > 1 && (
        <div role="group" aria-label="Transmission" className="flex flex-wrap gap-2">
          <Pill on={transmission === null} onClick={() => setTransmission(null)}>
            All {models.length} models
          </Pill>
          {transmissions.map((value) => (
            <Pill key={value} on={transmission === value} onClick={() => setTransmission(value)}>
              {transmissionLabel(value) ?? value}
            </Pill>
          ))}
        </div>
      )}

      {shop.isPending ? (
        <p className="text-sm text-muted">Loading the shop&apos;s {nouns(2)}…</p>
      ) : shop.error ? (
        <p role="alert" className="text-sm text-danger">
          {shop.error.message}
        </p>
      ) : (
        <Ticket data-testid="shop-models">
          {shown.map((model) => {
            const free = freeOf(model);
            const count = counts[model.id] ?? 0;
            const facts = [
              transmissionLabel(model.details.transmission),
              typeof model.details.engine_cc === "number" ? `${model.details.engine_cc} cc` : null,
              seatsLabel(seatsOf(model), category.name).toLowerCase(),
            ].filter(Boolean);
            const open = expanded === model.id;
            const detailsId = `shop-model-details-${model.id}`;
            const rate = model.vehicle_rate;
            const terms = [
              rate?.security_deposit_cents ? `${formatPeso(rate.security_deposit_cents)} refundable deposit` : null,
              rate?.km_limit_per_day ? `${rate.km_limit_per_day} km a day` : null,
              rate && rate.min_rental_days > 1 ? `at least ${rate.min_rental_days} days` : null,
            ].filter(Boolean);
            const features = open ? listingFeatures({ details: model.details, cancellation_policy: "" }) : [];
            return (
              <Fragment key={model.id}>
              <TicketRow
                media={
                  <span className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-action-tint text-action-ink">
                    {model.cover_photo_url ? (
                      <Image src={model.cover_photo_url} alt="" fill unoptimized={isApiPhoto(model.cover_photo_url)} sizes="3.5rem" className="object-cover" />
                    ) : (
                      <CategoryGlyph name={category.name} className="size-6" />
                    )}
                  </span>
                }
                label={facts.join(" · ")}
                value={
                  <span className="flex flex-col">
                    <button
                      type="button"
                      aria-expanded={open}
                      aria-controls={detailsId}
                      onClick={() => setExpanded(open ? null : model.id)}
                      className="flex w-fit items-center gap-1 text-left underline-offset-4 hover:underline"
                      data-testid="shop-model-toggle"
                    >
                      {model.title}
                      <ChevronGlyph direction={open ? "up" : "down"} className="size-4 shrink-0 text-muted" />
                    </button>
                    <span className="text-sm font-medium text-muted">
                      <span className="font-bold text-action-ink">{formatPeso(model.vehicle_rate?.daily_price_cents ?? 0)}</span> a day
                    </span>
                    <span className="text-sm font-medium text-muted" data-testid="shop-model-free">
                      {free ? (
                        <>
                          <span className="font-semibold text-foreground">{free} available</span>
                          {model.starts_at && model.ends_at && ` · ${formatRentalSpan(model.starts_at, model.ends_at)}`}
                        </>
                      ) : model.starts_at ? (
                        "None free for these times"
                      ) : (
                        "None available on your dates"
                      )}
                    </span>
                  </span>
                }
                control={
                  free ? (
                    <Stepper
                      label={model.title}
                      value={count}
                      min={0}
                      max={free}
                      onChange={(value) => setCounts({ ...counts, [model.id]: value })}
                      testId={`shop-model-${model.id}`}
                    />
                  ) : (
                    <span className="shrink-0 text-sm text-muted">{model.starts_at ? "Taken" : "Sold out"}</span>
                  )
                }
                data-testid="shop-model"
              />
              {open && (
                <div id={detailsId} className="flex flex-col gap-2.5 border-t-0! px-3.5 pt-1 pb-4 text-sm text-muted" data-testid="shop-model-details">
                  {features.length > 0 && (
                    <ul className="flex flex-wrap gap-1.5">
                      {features.map((feature) => (
                        <li key={feature.label}>
                          <Badge tone="fact" className="min-h-6 px-2.5 text-xs">
                            <FeatureGlyph name={feature.icon} className="size-3.5" />
                            {feature.label}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                  {terms.length > 0 && <p>{terms.join(" · ")}</p>}
                  {rate && (
                    <p className="font-semibold text-foreground">
                      {handoverLabel({ delivery: rate.delivery_fee_cents, returnPickup: rate.return_pickup_fee_cents })}
                    </p>
                  )}
                  <Link href={`/listings/${model.id}${tripDatesQuery({ ...dates, from, to })}`} className="w-fit font-semibold text-link underline underline-offset-4" data-testid="listing-link">
                    See full details
                  </Link>
                </div>
              )}
              </Fragment>
            );
          })}
        </Ticket>
      )}

      {(fees.delivery !== null || fees.returnPickup !== null) && (
        <Ticket>
          <DeliveryOptions fees={fees} value={chosen} onChange={setDelivery} address={false} />
        </Ticket>
      )}
      {breakdown.price?.unavailable && <p className="text-sm font-semibold text-warning">{breakdown.price.unavailable}</p>}

      <div className="flex flex-col gap-2" data-testid="shop-seats">
        <div className="flex flex-wrap justify-between gap-2 text-sm">
          <span>
            {units} {nouns(units)} · seats {seats}
          </span>
          <span className={short > 0 ? "text-warning" : "text-emerald"}>
            {short > 0 ? `${short} of your ${people} still need a ride` : "Everyone has a seat"}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-line" aria-hidden>
          <div
            className="h-full rounded-full bg-action transition-[width] duration-300 ease-calm"
            style={{ width: `${Math.min((seats / Math.max(people, 1)) * 100, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );

  return { body, summary, action };
}
