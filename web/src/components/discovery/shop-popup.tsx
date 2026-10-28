"use client";

import Image from "next/image";
import { useState } from "react";
import { CategoryGlyph } from "@/components/discovery/tag-glyphs";
import { isApiPhoto } from "@/components/landing/sample-photos";
import { transmissionLabel } from "@/components/listings/vehicle-labels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Pill } from "@/components/ui/pill";
import { Stepper } from "@/components/ui/stepper-field";
import { Ticket, TicketRow } from "@/components/ui/ticket";
import { useSession } from "@/lib/auth/session";
import { formatPeso } from "@/lib/money";
import { formatDateRange } from "@/components/trips/format";
import { useOptionalTripAdd } from "@/components/trips/trip-add-provider";
import type { TripDates } from "@/components/trips/trip-dates";
import { peopleText, rentalDays, seatsLabel, vehicleNoun, type ShopListing } from "@/components/trips/vehicle-party";
import { useShopListings } from "@/components/trips/use-shop-listings";

type Props = {
  business: { id: number; name: string };
  category: { slug: string; name: string };
  area: string;
  dates: TripDates;
  // The trip's people, to compare the seats picked with.
  people: number;
  onClose: () => void;
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

// A shop's models in one place (RAA-191, the plan's mock 2): opened from a vehicle's "More from
// this shop". The trip's dates and people, the shop's models in the vehicle's category with a
// counter each up to what is free ("Sold out" when none), filtered by transmission; the foot
// compares the seats picked with the people and totals the rent and refundable deposits. "Add N
// to trip" adds one item per model through the add sheet, as a mix of room types is.
export function ShopPopup({ business, category, area, dates, people, onClose }: Props) {
  const session = useSession();
  const flow = useOptionalTripAdd();
  const shop = useShopListings(business.id, category.slug, dates.from, dates.to);
  const models = shop.data?.listings ?? [];
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [transmission, setTransmission] = useState<string | null>(null);
  const transmissions = [...new Set(models.map((model) => model.details.transmission).filter((value): value is string => typeof value === "string"))];
  const shown = transmission ? models.filter((model) => model.details.transmission === transmission) : models;

  const days = rentalDays(dates.from, dates.to);
  const picked = models.filter((model) => (counts[model.id] ?? 0) > 0).map((model) => ({ model, units: counts[model.id], seats: seatsOf(model) }));
  const units = picked.reduce((sum, each) => sum + each.units, 0);
  const seats = picked.reduce((sum, each) => sum + each.units * each.seats, 0);
  const rent = picked.reduce((sum, each) => sum + each.units * (each.model.vehicle_rate?.daily_price_cents ?? 0) * days, 0);
  const deposit = picked.reduce((sum, each) => sum + each.units * (each.model.vehicle_rate?.security_deposit_cents ?? 0), 0);
  const short = people - seats;
  const nouns = (count: number) => vehicleNoun(category.name, count);
  const initials = business.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");
  const freeDelivery = models.length > 0 && models.every((model) => model.vehicle_rate?.delivery_fee_cents === 0);
  const helmets = models.length > 0 && models.every((model) => Array.isArray(model.details.amenities) && model.details.amenities.includes("rider_helmet"));
  const guest = !session || session.user.role === "guest";

  function addPicked() {
    const split = splitPeople(picked, people);
    const [first] = picked;
    if (!first || !flow) return;
    flow.add({
      listingId: first.model.id,
      title: business.name,
      range: true,
      bookingType: "rental",
      startsOn: dates.from,
      endsOn: dates.to,
      quantity: split.reduce((sum, count) => sum + count, 0),
      guests: people,
      preview: { category: category.name, by: `by ${business.name}`, photo: null, price: `${formatPeso(rent + deposit)} estimate` },
      mix: picked.map((each, index) => ({
        listingId: each.model.id,
        title: each.model.title,
        quantity: split[index],
        units: each.units,
        roomGuests: null,
        pets: 0,
        shared: false,
      })),
    });
    onClose();
  }

  return (
    <Dialog
      open
      onClose={onClose}
      placement="sheet"
      title={business.name}
      meta={`${category.name} rental · ${area}`}
      thumb={
        <span aria-hidden className="absolute inset-0 flex items-center justify-center bg-action-tint text-lg font-bold text-action-ink">
          {initials}
        </span>
      }
      summary={
        <div className="flex min-w-0 flex-col gap-1" data-testid="shop-summary">
          <span className="font-display text-lg leading-tight font-extrabold tracking-tight tabular-nums">{formatPeso(rent + deposit)}</span>
          <span className="text-xs text-muted">
            {formatPeso(rent)} rent + {formatPeso(deposit)} refundable deposit
          </span>
        </div>
      }
      actions={
        guest && (
          <Button glyph="plus" disabled={units === 0 || session === undefined} onClick={addPicked} data-testid="shop-add">
            {units ? `Add ${units} to trip` : `Pick a ${nouns(1)}`}
          </Button>
        )
      }
      data-testid="shop-popup"
    >
      <div className="flex flex-col gap-4">
        {(freeDelivery || helmets) && (
          <div className="flex flex-wrap gap-2">
            {freeDelivery && <Badge tone="emerald">Free delivery to your stay</Badge>}
            {helmets && <Badge tone="kind">Helmets included</Badge>}
          </div>
        )}
        <div className="flex flex-wrap justify-between gap-2 text-sm">
          <span>{dates.from && dates.to ? `${formatDateRange(dates.from, dates.to)} · ${days} ${days === 1 ? "day" : "days"}` : "No dates yet"}</span>
          <span className="text-muted">
            Your trip: <span className="font-semibold text-foreground">{peopleText(people)}</span>
          </span>
        </div>

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
              return (
                <TicketRow
                  key={model.id}
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
                  value={model.title}
                  detail={
                    <>
                      <span className="font-bold text-action-ink">{formatPeso(model.vehicle_rate?.daily_price_cents ?? 0)}</span> a day ·{" "}
                      {free ? `${free} free` : "none free on your dates"}
                    </>
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
                      <span className="shrink-0 text-sm text-muted">Sold out</span>
                    )
                  }
                  data-testid="shop-model"
                />
              );
            })}
          </Ticket>
        )}

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
    </Dialog>
  );
}
