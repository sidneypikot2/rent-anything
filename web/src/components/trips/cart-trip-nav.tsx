"use client";

import { Fragment, useEffect, useRef } from "react";
import { cn } from "@/components/ui/cn";
import { formatDateRange, itemCount } from "./format";
import type { Trip } from "./use-trips";

// Not confirmed yet: waiting on the partner (a request, or one being changed) or on payment.
const WAITING = new Set(["requested", "accepted", "awaiting_payment"]);

// How far along a trip's bookings are: "1 booked · 1 waiting".
export function bookingProgress(trip: Trip) {
  const bookings = trip.items.flatMap((item) => (item.booking ? [item.booking] : []));
  const waiting = bookings.filter((booking) => WAITING.has(booking.status)).length;
  const booked = bookings.length - waiting;
  return [booked > 0 && `${booked} booked`, waiting > 0 && `${waiting} waiting`].filter(Boolean).join(" · ");
}

// One entry in the sidebar, forest while picked.
function tabClasses(current: boolean) {
  return cn(
    "flex min-h-11 w-52 flex-col items-start rounded-card px-3.5 py-2.5 text-left shadow-soft lg:w-full",
    "transition-[background-color,border-color,box-shadow,color] duration-300 ease-calm",
    current ? "border border-forest bg-forest text-white shadow-lift" : "card-edge-line bg-surface hover:border-line-2 hover:shadow-lift",
  );
}

export type TripGroup = { label: string; trips: Trip[] };

// The cart's trips (RAA-135), to pick the one shown beside them: from lg a sticky column under
// the header, below it a row of chips that scrolls sideways. The pick is the page's `?trip=`.
// The Trips page (RAA-140) splits them into groups, each under its label, and says on each
// trip how it went (`detail`) in place of its bookings' progress. On a phone the picked chip is
// scrolled into the row's view, so a trip opened from `?trip=` isn't off to the side.
export function CartTripNav({
  groups,
  selectedId,
  onSelect,
  detail = bookingProgress,
  label = "Your trips",
  grouped = false,
  count = (trip) => trip.items.length,
}: {
  groups: TripGroup[];
  selectedId: number | undefined;
  onSelect: (trip: Trip) => void;
  detail?: (trip: Trip) => string;
  label?: string;
  // Each group's label over its trips, even when there is one group.
  grouped?: boolean;
  // How many items the trip shows: the Trips page counts only the booked ones.
  count?: (trip: Trip) => number;
}) {
  const list = useRef<HTMLUListElement>(null);
  useEffect(() => {
    const row = list.current;
    const chip = row?.querySelector<HTMLElement>('[aria-current="page"]');
    // The row is the chips' offsetParent (relative), so offsetLeft is within it.
    // Only while the row scrolls sideways: from lg it's a column, and the page mustn't jump.
    if (!row || !chip || row.scrollWidth <= row.clientWidth) return;
    row.scrollTo({ left: chip.offsetLeft - 4, behavior: "smooth" });
  }, [selectedId]);

  return (
    <nav aria-label={label} className="min-w-0 lg:sticky lg:top-(--chrome) lg:self-start" data-testid="cart-trip-nav">
      {!grouped && <h2 className="mb-2 hidden text-sm font-semibold text-muted lg:block">{groups[0]?.label}</h2>}
      <ul ref={list} className="relative -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-col lg:gap-1.5 lg:overflow-visible lg:px-0 lg:pb-0">
        {groups.map((group) => (
          <Fragment key={group.label}>
            {grouped && (
              <li
                className="flex shrink-0 items-center pl-1 text-small font-semibold text-muted lg:mt-2 lg:pl-0 lg:text-sm lg:first:mt-0"
                data-testid="trip-group"
              >
                <h2>{group.label}</h2>
              </li>
            )}
            {group.trips.map((trip) => {
              const current = trip.id === selectedId;
              const line = detail(trip);
              return (
                <li key={trip.id} className="shrink-0 lg:shrink">
                  <button
                    type="button"
                    onClick={() => onSelect(trip)}
                    aria-current={current ? "page" : undefined}
                    data-testid="cart-trip-tab"
                    className={tabClasses(current)}
                  >
                    <span className="w-full truncate font-semibold">{trip.name}</span>
                    <span className={cn("text-sm", current ? "text-sky-mist" : "text-muted")}>
                      {[formatDateRange(trip.starts_on, trip.ends_on) ?? "No dates yet", itemCount(count(trip))].join(" · ")}
                    </span>
                    {line && <span className={cn("text-small font-semibold", current ? "text-mint" : "text-emerald")}>{line}</span>}
                  </button>
                </li>
              );
            })}
          </Fragment>
        ))}
      </ul>
    </nav>
  );
}
