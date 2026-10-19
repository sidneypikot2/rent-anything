"use client";

import Image from "next/image";
import { useState } from "react";
import { BookingStatusBadge } from "@/components/bookings/booking-status";
import { checkoutLabel } from "@/components/bookings/checkout-sheet";
import { CategoryGlyph } from "@/components/discovery/tag-glyphs";
import { isApiPhoto } from "@/components/landing/sample-photos";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Menu } from "@/components/ui/menu";
import { bookingProgress } from "./cart-trip-nav";
import { DeletionBanner } from "./deletion-banner";
import type { EditFocus } from "./edit-trip-sheet";
import { formatDateRange, guestCount, itemCount, todayIso } from "./format";
import type { Trip, TripItem } from "./use-trips";

// What the cart does with a trip or one of its items; each opens a sheet, a dialog or the
// item's panel.
export type TripActions = {
  edit: (trip: Trip, focus?: EditFocus) => void;
  merge: (trip: Trip) => void;
  remove: (trip: Trip) => void;
  open: (trip: Trip, item: TripItem) => void;
  moveItem: (trip: Trip, item: TripItem) => void;
  redateItem: (trip: Trip, item: TripItem) => void;
  removeItem: (trip: Trip, item: TripItem) => void;
  checkout: (trip: Trip, items: TripItem[]) => void;
};

// An item can be booked once it has dates that haven't passed, and while it has no booking
// holding its days (RAA-133).
export function bookable(item: TripItem) {
  return !item.booking && item.starts_on !== null && item.starts_on >= todayIso();
}

// The trip picked in the cart (RAA-135): a header with its name, dates, guests and where it
// goes, then its items in date order, undated last, each a card that opens its panel (the
// listing and its booking). Checkout (RAA-133): every item that can be booked is ticked at
// first; the foot sends the ticked ones, and a booked item shows its booking's status instead
// of a tick.
export function TripDetails({ trip, actions }: { trip: Trip; actions: TripActions }) {
  const [unpicked, setUnpicked] = useState<ReadonlySet<number>>(new Set());
  const dates = formatDateRange(trip.starts_on, trip.ends_on) ?? "No dates yet";
  const progress = bookingProgress(trip);
  const canBook = trip.items.filter(bookable);
  const picked = canBook.filter((item) => !unpicked.has(item.id));

  function toggle(item: TripItem) {
    setUnpicked((before) => {
      const next = new Set(before);
      if (next.has(item.id)) next.delete(item.id);
      else next.add(item.id);
      return next;
    });
  }

  return (
    <section id={`trip-${trip.id}`} aria-labelledby={`trip-${trip.id}-name`} data-testid="cart-trip" className="flex min-w-0 flex-col gap-4">
      <div className="card-edge rounded-card bg-forest text-white shadow-soft">
        <div className="flex items-start gap-3 p-card">
          <div className="min-w-0 flex-1">
            <h2 id={`trip-${trip.id}-name`} className="font-display text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">
              {trip.name}
            </h2>
            <p className="mt-1 text-sm text-sky-mist">
              {[dates, guestCount(trip.guests), itemCount(trip.items.length)].join(" · ")}
            </p>
            {trip.destinations.length > 0 && <p className="text-sm text-sky-mist">{trip.destinations.join(", ")}</p>}
            {progress && <p className="mt-2 text-small font-semibold text-mint">{progress}</p>}
          </div>
          <Menu
            label={`Actions for ${trip.name}`}
            tone="dark"
            data-testid="cart-trip-menu"
            items={[
              { label: "Rename or change dates", onSelect: () => actions.edit(trip), "data-testid": "trip-action-edit" },
              {
                label: "Merge with another trip",
                detail: "Moves every item into it",
                onSelect: () => actions.merge(trip),
                "data-testid": "trip-action-merge",
              },
              { label: "Delete trip", danger: true, onSelect: () => actions.remove(trip), "data-testid": "trip-action-delete" },
            ]}
          />
        </div>
        <div className="px-card pb-4 empty:hidden">
          <DeletionBanner trip={trip} onChangeDates={() => actions.edit(trip, "dates")} />
        </div>
      </div>

      {trip.items.length === 0 ? (
        <Card edge="line">
          <p className="p-card text-sm text-muted">Nothing in this trip yet. Add tours, rentals or stays from a destination.</p>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {trip.items.map((item) => (
            <ItemCard
              key={item.id}
              trip={trip}
              item={item}
              actions={actions}
              picked={bookable(item) ? !unpicked.has(item.id) : undefined}
              onPick={() => toggle(item)}
            />
          ))}
        </ul>
      )}

      {canBook.length > 0 && (
        <Card edge="line" className="flex flex-wrap items-center justify-between gap-3 px-card py-4 lg:sticky lg:bottom-3">
          <p className="text-sm text-muted">
            {picked.length} of {itemCount(canBook.length)} ticked · each goes to its partner as a request
          </p>
          <Button
            type="button"
            size="pill"
            disabled={picked.length === 0}
            onClick={() => actions.checkout(trip, picked)}
            data-testid="cart-checkout"
          >
            {picked.length > 0 ? checkoutLabel(picked) : "Send requests"}
          </Button>
        </Card>
      )}
    </section>
  );
}

// One item as a card: its photo, title, what it is and when. The title's button stretches over
// the card and opens its panel; the tick and the menu sit above it (`relative z-10`).
// `picked` is set for an item that can be booked: whether it is ticked.
function ItemCard({
  trip,
  item,
  actions,
  picked,
  onPick,
}: {
  trip: Trip;
  item: TripItem;
  actions: TripActions;
  picked?: boolean;
  onPick: () => void;
}) {
  const dates = formatDateRange(item.starts_on, item.ends_on);
  const booking = item.booking;
  const photo = item.listing.cover_photo_url;

  return (
    <li data-testid="cart-item">
      <Card
        clip={false}
        edge="line"
        className="relative flex items-start gap-4 p-3 transition-[border-color,box-shadow] duration-300 ease-calm hover:border-line-2 hover:shadow-lift sm:p-4"
      >
        {picked !== undefined && (
          <input
            type="checkbox"
            checked={picked}
            onChange={onPick}
            aria-label={`Book ${item.listing.title}`}
            data-testid="cart-item-pick"
            className="relative z-10 mt-1 size-5 shrink-0 rounded border-line-strong accent-primary"
          />
        )}
        <div className="size-20 shrink-0 overflow-hidden rounded-control bg-mist sm:size-24">
          {photo ? (
            <Image
              src={photo}
              alt=""
              width={192}
              height={192}
              unoptimized={isApiPhoto(photo)}
              className="size-full object-cover"
            />
          ) : (
            <span className="flex size-full items-center justify-center text-primary">
              <CategoryGlyph name={item.listing.category} className="size-8" />
            </span>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <button
            type="button"
            aria-haspopup="dialog"
            onClick={() => actions.open(trip, item)}
            data-testid="cart-item-open"
            className="text-left text-title-sm font-semibold leading-snug outline-none after:absolute after:inset-0 after:rounded-card after:content-[''] hover:text-primary focus-visible:after:outline-2 focus-visible:after:-outline-offset-4 focus-visible:after:outline-(--focus)"
          >
            {item.listing.title}
          </button>
          <p className="text-sm text-muted">{[item.listing.category, item.area.name, guestCount(item.quantity)].join(" · ")}</p>
          {dates ? (
            <p className="text-sm">{dates}</p>
          ) : (
            <button
              type="button"
              onClick={() => actions.redateItem(trip, item)}
              className="relative z-10 w-fit text-sm font-semibold text-warning hover:underline"
            >
              Pick a date to book
            </button>
          )}
          {booking && (
            <p className="mt-1 flex flex-wrap items-center gap-1.5">
              <BookingStatusBadge status={booking.status} small />
              <span className="text-xs text-muted">{booking.reference}</span>
            </p>
          )}
        </div>
        <div className="relative z-10">
          <Menu
            label={`Actions for ${item.listing.title}`}
            data-testid="cart-item-menu"
            items={
              booking
                ? [{ label: "View booking", onSelect: () => actions.open(trip, item), "data-testid": "item-action-booking" }]
                : [
                    { label: "Move to another trip", onSelect: () => actions.moveItem(trip, item), "data-testid": "item-action-move" },
                    { label: "Change date", onSelect: () => actions.redateItem(trip, item), "data-testid": "item-action-date" },
                    { label: "Remove", danger: true, onSelect: () => actions.removeItem(trip, item), "data-testid": "item-action-remove" },
                  ]
            }
          />
        </div>
      </Card>
    </li>
  );
}
