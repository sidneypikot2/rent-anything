"use client";

import Link from "next/link";
import { useId } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { Menu } from "@/components/ui/menu";
import { DeletionBanner } from "./deletion-banner";
import type { EditFocus } from "./edit-trip-sheet";
import { formatDateRange, guestCount, itemCount } from "./format";
import type { Trip, TripItem } from "./use-trips";

// What the cart does with a trip or one of its items; each opens a sheet or a dialog.
export type TripActions = {
  edit: (trip: Trip, focus?: EditFocus) => void;
  merge: (trip: Trip) => void;
  remove: (trip: Trip) => void;
  moveItem: (trip: Trip, item: TripItem) => void;
  redateItem: (trip: Trip, item: TripItem) => void;
  removeItem: (trip: Trip, item: TripItem) => void;
};

type Props = {
  trip: Trip;
  open: boolean;
  onToggle: () => void;
  actions: TripActions;
};

// One trip in the cart (screen 6): a header that opens and closes it, and its items in
// date order, undated last. Prices and checkout come with checkout.
export function TripGroup({ trip, open, onToggle, actions }: Props) {
  const panelId = useId();
  const dates = formatDateRange(trip.starts_on, trip.ends_on) ?? "No dates yet";
  const details = [dates, guestCount(trip.guests), itemCount(trip.items.length)].join(" · ");

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
            <span className="block font-display text-2xl font-bold italic leading-tight">{trip.name}</span>
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
                <ItemRow key={item.id} trip={trip} item={item} actions={actions} />
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}

function ItemRow({ trip, item, actions }: { trip: Trip; item: TripItem; actions: TripActions }) {
  const dates = formatDateRange(item.starts_on, item.ends_on);
  const listingHref = `/${item.listing.area_slug}`;

  return (
    <li data-testid="cart-item" className="flex items-start gap-2 px-4 py-3">
      <div className="min-w-0 flex-1">
        <Link href={listingHref} className="font-semibold hover:text-primary hover:underline">
          {item.listing.title}
        </Link>
        <p className="text-sm text-muted">
          {[item.listing.category, item.area.name, guestCount(item.quantity)].join(" · ")}
        </p>
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
        items={[
          { label: "Move to another trip", onSelect: () => actions.moveItem(trip, item), "data-testid": "item-action-move" },
          { label: "Change date", onSelect: () => actions.redateItem(trip, item), "data-testid": "item-action-date" },
          // No listing page yet (M3): its destination page lists it.
          { label: `View ${item.area.name}`, href: listingHref },
          { label: "Remove", danger: true, onSelect: () => actions.removeItem(trip, item), "data-testid": "item-action-remove" },
        ]}
      />
    </li>
  );
}
