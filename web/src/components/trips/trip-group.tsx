"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { BookingStatusBadge } from "@/components/bookings/booking-status";
import { checkoutLabel } from "@/components/bookings/checkout-sheet";
import { InstantBookBadge } from "@/components/discovery/instant-book-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { Menu } from "@/components/ui/menu";
import { DeletionBanner } from "./deletion-banner";
import type { EditFocus } from "./edit-trip-sheet";
import { formatDateRange, guestCount, itemCount, todayIso } from "./format";
import type { Trip, TripItem } from "./use-trips";

// What the cart does with a trip or one of its items; each opens a sheet or a dialog.
export type TripActions = {
  edit: (trip: Trip, focus?: EditFocus) => void;
  merge: (trip: Trip) => void;
  remove: (trip: Trip) => void;
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

type Props = {
  trip: Trip;
  open: boolean;
  onToggle: () => void;
  actions: TripActions;
};

// One trip in the cart (screen 6): a header that opens and closes it, and its items in
// date order, undated last. Checkout (RAA-133): every item that can be booked is ticked at
// first; the foot books the ticked ones (Book, Send requests, or both), and a booked item
// shows its booking's status instead of a tick, and can't be moved, re-dated or removed.
export function TripGroup({ trip, open, onToggle, actions }: Props) {
  const panelId = useId();
  const [unpicked, setUnpicked] = useState<ReadonlySet<number>>(new Set());
  const dates = formatDateRange(trip.starts_on, trip.ends_on) ?? "No dates yet";
  const booked = trip.items.filter((item) => item.booking).length;
  const details = [dates, guestCount(trip.guests), itemCount(trip.items.length), booked > 0 && `${booked} booked`]
    .filter(Boolean)
    .join(" · ");
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
    <Card clip={false} id={`trip-${trip.id}`} data-testid="cart-trip" className="scroll-mt-4">
      <div className="flex items-start gap-2 p-4">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
          data-testid="cart-trip-toggle"
          className="flex min-w-0 flex-1 items-start gap-3 text-left"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            className={cn("mt-1.5 size-4 shrink-0 text-muted transition-transform", !open && "-rotate-90")}
          >
            <path d="M5.5 7.5 10 12l4.5-4.5" fill="none" stroke="currentColor" strokeWidth="1.75" />
          </svg>
          <span className="min-w-0">
            <span className="block font-display text-2xl font-extrabold tracking-tight leading-tight">{trip.name}</span>
            <span className="block text-sm text-muted">{details}</span>
            {trip.destinations.length > 0 && (
              <span className="block text-sm text-muted">{trip.destinations.join(", ")}</span>
            )}
          </span>
        </button>
        <Menu
          label={`Actions for ${trip.name}`}
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

      <div className="px-4 pb-3 empty:hidden">
        <DeletionBanner trip={trip} onChangeDates={() => actions.edit(trip, "dates")} />
      </div>

      {open && (
        <div id={panelId} className="border-t border-line">
          {trip.items.length === 0 ? (
            <p className="p-4 text-sm text-muted">Nothing in this trip yet. Add tours, rentals or stays from a destination.</p>
          ) : (
            <ul className="divide-y divide-line">
              {trip.items.map((item) => (
                <ItemRow
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
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3">
              <p className="text-sm text-muted">
                {picked.length} of {itemCount(canBook.length)} to book
              </p>
              <Button
                type="button"
                size="pill"
                disabled={picked.length === 0}
                onClick={() => actions.checkout(trip, picked)}
                data-testid="cart-checkout"
              >
                {picked.length > 0 ? checkoutLabel(picked) : "Book"}
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// `picked` is set for an item that can be booked: whether it is ticked.
function ItemRow({
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
  const listingHref = `/${item.listing.area_slug}`;
  const booking = item.booking;

  return (
    <li data-testid="cart-item" className="flex items-start gap-3 px-4 py-3">
      {picked !== undefined && (
        <input
          type="checkbox"
          checked={picked}
          onChange={onPick}
          aria-label={`Book ${item.listing.title}`}
          data-testid="cart-item-pick"
          className="mt-1 size-5 shrink-0 rounded border-line-strong accent-primary"
        />
      )}
      <div className="min-w-0 flex-1">
        <Link href={listingHref} className="font-semibold hover:text-primary hover:underline">
          {item.listing.title}
        </Link>
        <p className="text-sm text-muted">
          {[item.listing.category, item.area.name, guestCount(item.quantity)].join(" · ")}
        </p>
        {(booking || item.listing.instant_book) && (
          <p className="mt-1 flex flex-wrap items-center gap-1.5">
            {booking ? <BookingStatusBadge status={booking.status} small /> : <InstantBookBadge small />}
            {booking && <span className="text-xs text-muted">{booking.reference}</span>}
          </p>
        )}
        {dates ? (
          <p className="text-sm">{dates}</p>
        ) : (
          <button
            type="button"
            onClick={() => actions.redateItem(trip, item)}
            className="text-sm font-semibold text-warning hover:underline"
          >
            Pick a date to book
          </button>
        )}
      </div>
      <Menu
        label={`Actions for ${item.listing.title}`}
        data-testid="cart-item-menu"
        items={
          booking
            ? [
                // A booked item is the booking's: cancelling it is on the bookings page.
                { label: "View booking", href: "/trips/bookings", "data-testid": "item-action-booking" },
                { label: `View ${item.area.name}`, href: listingHref },
              ]
            : [
                { label: "Move to another trip", onSelect: () => actions.moveItem(trip, item), "data-testid": "item-action-move" },
                { label: "Change date", onSelect: () => actions.redateItem(trip, item), "data-testid": "item-action-date" },
                // No listing page yet (M3): its destination page lists it.
                { label: `View ${item.area.name}`, href: listingHref },
                { label: "Remove", danger: true, onSelect: () => actions.removeItem(trip, item), "data-testid": "item-action-remove" },
              ]
        }
      />
    </li>
  );
}
