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
import { Ticket } from "@/components/ui/ticket";
import { useSession } from "@/lib/auth/session";
import { formatPeso } from "@/lib/money";
import { TO_BE_AGREED } from "@/lib/pricing";
import { DateRangeField } from "@/components/ui/date-range-field";
import { addDays, formatDateRange, todayIso } from "@/components/trips/format";
import {
  AtTheShopRow,
  childHelmetFeeText,
  ChildHelmetsRow,
  DeliveryOptions,
  handoverLabel,
  needsAddress,
  NO_DELIVERY,
  sharedFees,
  wantsDelivery,
  type Delivery,
} from "@/components/trips/delivery-options";
import { PickupTimeRow, rentalClock } from "@/components/trips/pickup-time";
import { useOptionalTripAdd } from "@/components/trips/trip-add-provider";
import { tripDatesQuery, type TripDates } from "@/components/trips/trip-dates";
import { usePriceBreakdown } from "@/components/trips/price-breakdown";
import { useShopListings, type ShopGroup } from "@/components/trips/use-shop-listings";
import { CoverBar } from "@/components/trips/cover-bar";
import { peopleText, rentalDays, ridesHeld, seatsLabel, shopNoun, vehicleNoun, withArticle, type ShopListing } from "@/components/trips/vehicle-party";
import { useTripHere } from "@/components/trips/use-trip-here";
import { useTripHref } from "@/components/trips/trip-link";

type Options = {
  business: { id: number; name: string };
  // The vehicles' category: its slug narrows the shop's listings, its name gives their words.
  category: { slug?: string; name: string };
  // Which of the shop's rentals: gear is `counted`, by how many rather than for the trip's people
  // (RAA-255), and its sheet holds all the shop's gear. Left out, the category's vehicles.
  group?: ShopGroup;
  dates: TripDates;
  // The trip's people, to compare the seats picked with.
  people: number;
  // Only these of the shop's listings (What to book's filters); left out, all in the category.
  listingIds?: number[];
  // These lead the list (the model a title card was opened on, `?item=`), the rest in the shop's order.
  first?: number[];
  // The shop's place ("Santa Fe"), where its vehicles are collected when it doesn't bring them.
  place?: string;
  // After the add has started (the add sheet takes over): a pop-up closes.
  onAdding?: () => void;
};

// Where a rental starts: the longest run of the trip's days with a ride for fewer than its people,
// while it has a ride on some of them; otherwise the trip's own dates.
function openDays(items: Parameters<typeof ridesHeld>[0], dates: TripDates, people: number) {
  const whole = { from: dates.from ?? "", to: dates.to ?? "" };
  if (!dates.from) return whole;
  const to = dates.to || addDays(dates.from, 1);
  const { gaps } = ridesHeld(items, dates.from, to, people);
  if (gaps.length === 0 || (gaps.length === 1 && gaps[0].from === dates.from && gaps[0].to === to)) return whole;
  const longest = gaps.reduce((best, gap) => (gap.days > best.days ? gap : best));
  return { from: longest.from, to: longest.to };
}

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
// Gear (RAA-255) is the same sheet by the count: no seats, no CoverBar, and each model's quantity
// is how many of it, with the API's words for them.
export function useShopModels({ business, category, group, dates, people, listingIds, first = [], place, onAdding }: Options) {
  const counted = group === "gear";
  const session = useSession();
  const flow = useOptionalTripAdd();
  // The trip the add goes to (the place's banner's, or the chosen one): its vehicle rentals
  // already give some of its people a ride.
  const tripItems = useTripHere(flow?.places ?? []).trip?.items ?? [];
  const tripHref = useTripHref();
  // The rental's own dates: until the guest picks some, the trip's days still without a ride for
  // everyone (the longest run of them), or the trip's dates when it has no ride on any day or one
  // on every day. One date is one day, back the next.
  const [chosenDates, setRental] = useState<{ from: string; to: string } | null>(null);
  const rental = chosenDates ?? (counted ? { from: dates.from ?? "", to: dates.to ?? "" } : openDays(tripItems, dates, people));
  const from = rental.from || undefined;
  const to = rental.from ? rental.to || addDays(rental.from, 1) : undefined;
  const [pickupTime, setPickupTime] = useState<string | null>(null);
  const shop = useShopListings(business.id, { category: category.slug, group }, from, to, pickupTime);
  const models = (shop.data?.listings ?? [])
    .filter((model) => !listingIds || listingIds.includes(model.id))
    .sort((a, b) => Number(first.includes(b.id)) - Number(first.includes(a.id)));
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [transmission, setTransmission] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const transmissions = [...new Set(models.map((model) => model.details.transmission).filter((value): value is string => typeof value === "string"))];
  const shown = transmission ? models.filter((model) => model.details.transmission === transmission) : models;

  const days = rentalDays(from, to);
  const picked = models.filter((model) => (counts[model.id] ?? 0) > 0).map((model) => ({ model, units: counts[model.id], seats: seatsOf(model) }));
  const units = picked.reduce((sum, each) => sum + each.units, 0);
  const seats = picked.reduce((sum, each) => sum + each.units * each.seats, 0);
  const split = counted ? picked.map((each) => each.units) : splitPeople(picked, people);
  // The rides the trip already has on these days, counted with what is picked here.
  const held = ridesHeld(tripItems, from, to, people);
  const someDays = held.gaps.length > 0 && !(held.gaps.length === 1 && held.gaps[0].from === from && held.gaps[0].to === to);
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
  // The rings (RAA-205) are the first picked model's (or, before any is, the first model's): one
  // shop's models share its pin; the API prices each from its own.
  const ringModel = picked[0]?.model ?? models[0];
  // Child helmets (RAA-205), where every model picked has them: one a motorbike at most, given to
  // the models in order, as many as each has bikes.
  const [childHelmets, setChildHelmets] = useState(0);
  const childHelmetCount = fees.childHelmet !== null && fees.childHelmet !== undefined ? Math.min(childHelmets, units) : 0;
  const helmetsOf = picked.map((each, index) => {
    const before = picked.slice(0, index).reduce((sum, other) => sum + other.units, 0);
    return Math.min(Math.max(childHelmetCount - before, 0), each.units);
  });
  // Priced by the API, each model as the add will send it: its vehicles and the people on them.
  const breakdown = usePriceBreakdown(
    picked.map((each, index) => ({
      listingId: each.model.id,
      startsOn: from,
      endsOn: to,
      quantity: split[index],
      units: counted ? undefined : each.units,
      pickupTime,
      delivery: chosenDelivery,
      childHelmets: helmetsOf[index],
    })),
  );
  // The pickup times free for every model picked; before one is, the shop's (any model free then).
  const pickupTimes = (picked.length > 0 ? breakdown.price?.pickupTimes : null) ?? shop.data?.pickup_times ?? null;
  const returnsAt = (picked.length > 0 ? breakdown.price?.returnsAt : null) ?? models.find((model) => model.ends_at)?.ends_at ?? null;
  const total = breakdown.price?.total ?? null;
  const deposit = breakdown.price?.deposit ?? 0;
  const nouns = (count: number) => (counted ? shopNoun(models, count) : vehicleNoun(category.name, count));
  // Free nearby with every model (its nearest zone, RAA-205): as far as the shortest of them reaches.
  const freeReach =
    models.length > 0 && models.every((model) => model.vehicle_rate?.delivery_fee_cents === 0)
      ? Math.min(...models.map((model) => model.vehicle_rate?.delivery_zones[0]?.max_distance_m ?? 0))
      : null;
  const freeDelivery = freeReach !== null && freeReach > 0;
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
      preview: { category: category.name, by: `by ${business.name}`, place, photo: null, price: total !== null ? formatPeso(total) : undefined },
      // The models, dates, pickup and handover are all picked here: on a place's page it goes in at once.
      confirmed: true,
      mix: picked.map((each, index) => ({
        listingId: each.model.id,
        title: each.model.title,
        quantity: split[index],
        units: each.units,
        counted,
        roomGuests: null,
        pets: 0,
        shared: false,
        pickupTime: pickupTime ?? (returnsAt ? rentalClock(returnsAt) : null),
        delivery: chosenDelivery,
        childHelmets: helmetsOf[index],
      })),
    });
    // Fresh for another add; the "Added to trip" badge confirms this one.
    setCounts({});
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
      <Button
        glyph="plus"
        disabled={units === 0 || session === undefined || needsAddress(chosen) || Boolean(chosenDelivery && breakdown.price?.unavailable)}
        loading={Boolean(flow.busyListingId && models.some((model) => model.id === flow.busyListingId))}
        onClick={addPicked}
        data-testid="shop-add"
      >
        {units ? `Add ${units} to trip` : `Pick ${withArticle(nouns(1))}`}
      </Button>
    ) : null;

  const body = (
    <div className="flex flex-col gap-4" data-testid="shop-models-body">
      <Ticket>
        <DateRangeField
          row
          label="Rental dates"
          min={todayIso()}
          from={rental.from}
          to={rental.to}
          onChange={setRental}
          placeholder="Pick dates"
          hint={
            from && to
              ? `${days} ${days === 1 ? "day" : "days"}${dates.from && dates.to && (from !== dates.from || to !== dates.to) ? ` · trip ${formatDateRange(dates.from, dates.to)}` : ""}`
              : undefined
          }
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
      {(freeDelivery || helmets) && (
        <div className="flex flex-wrap gap-2">
          {freeDelivery && <Badge tone="emerald">Free delivery up to {Math.round(freeReach / 100) / 10} km</Badge>}
          {helmets && <Badge tone="kind">Helmets included</Badge>}
        </div>
      )}

      {transmissions.length > 1 && models.length > 4 && (
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
              counted ? null : seatsLabel(seatsOf(model), category.name).toLowerCase(),
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
              <div className="flex items-center gap-3 px-3.5 py-3" data-testid="shop-model">
                <span className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-action-tint text-action-ink">
                  {model.cover_photo_url ? (
                    <Image src={model.cover_photo_url} alt="" fill unoptimized={isApiPhoto(model.cover_photo_url)} sizes="3.5rem" className="object-cover" />
                  ) : (
                    <CategoryGlyph name={category.name} className="size-6" />
                  )}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-control font-bold" data-testid="shop-model-title">
                    {model.title}
                  </span>
                  <span className="truncate text-sm font-medium text-muted" data-testid="shop-model-free">
                    {rate?.daily_price_cents ? (
                      <>
                        <span className="font-bold text-action-ink">{formatPeso(rate.daily_price_cents)}</span> a day
                      </>
                    ) : (
                      TO_BE_AGREED
                    )}
                    {model.units_free ? ` · ${model.units_free} left` : ""}
                  </span>
                  <span className="flex min-w-0 items-center gap-2 text-xs text-muted">
                    <span className="truncate">{facts.join(" · ")}</span>
                    <button
                      type="button"
                      aria-expanded={open}
                      aria-controls={detailsId}
                      aria-label={`Details of ${model.title}`}
                      onClick={() => setExpanded(open ? null : model.id)}
                      className="tap-target flex shrink-0 items-center gap-0.5 font-semibold text-primary"
                      data-testid="shop-model-toggle"
                    >
                      Details
                      <ChevronGlyph direction={open ? "up" : "down"} className="size-3.5" />
                    </button>
                  </span>
                </span>
                {free ? (
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
                )}
              </div>
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
                      {rate.child_helmet_fee_cents !== null && ` · Child helmets: ${childHelmetFeeText(rate.child_helmet_fee_cents).toLowerCase()}`}
                    </p>
                  )}
                  <Link href={tripHref(`/listings/${model.id}${tripDatesQuery({ ...dates, from, to })}`)} className="w-fit font-semibold text-link underline underline-offset-4" data-testid="listing-link">
                    See full details
                  </Link>
                </div>
              )}
              </Fragment>
            );
          })}
        </Ticket>
      )}

      <Ticket>
        <DeliveryOptions
          fees={fees}
          value={chosen}
          onChange={setDelivery}
          zones={ringModel?.vehicle_rate?.delivery_zones}
          center={ringModel?.approx_location}
          counted={counted}
        />
        {!chosenDelivery && <AtTheShopRow place={place} />}
        <ChildHelmetsRow fee={fees.childHelmet} from={fees.from} value={childHelmetCount} max={units} onChange={setChildHelmets} />
      </Ticket>
      {breakdown.price?.unavailable && <p className="text-sm font-semibold text-warning">{breakdown.price.unavailable}</p>}

      {!counted && (
        <CoverBar
          people={people}
          covered={Math.min(held.least + seats, people)}
          summary={
            held.units > 0
              ? `${peopleText(people)} · ${held.units} ${nouns(held.units)} in your trip${units ? `, ${units} more picked` : ""}`
              : `${peopleText(people)} · ${units} ${nouns(units)}, ${seats} ${seats === 1 ? "seat" : "seats"}`
          }
          need="a ride"
          when={someDays ? held.gaps.map((gap) => formatDateRange(gap.from, gap.to)).join(", ") : undefined}
          done="Everyone has a seat"
          data-testid="shop-seats"
        />
      )}
    </div>
  );

  return { body, summary, action };
}
