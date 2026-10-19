"use client";

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

// The cart's trips (RAA-135), to pick the one shown beside them: from lg a sticky column under
// the header, below it a row of chips that scrolls sideways. The pick is the page's `?trip=`.
export function CartTripNav({
  trips,
  selectedId,
  onSelect,
}: {
  trips: Trip[];
  selectedId: number | undefined;
  onSelect: (trip: Trip) => void;
}) {
  return (
    <nav aria-label="Your trips" className="min-w-0 lg:sticky lg:top-(--chrome) lg:self-start" data-testid="cart-trip-nav">
      <h2 className="mb-3 hidden text-sm font-semibold text-muted lg:block">Your trips</h2>
      <ul className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0">
        {trips.map((trip) => {
          const current = trip.id === selectedId;
          const progress = bookingProgress(trip);
          return (
            <li key={trip.id} className="shrink-0 lg:shrink">
              <button
                type="button"
                onClick={() => onSelect(trip)}
                aria-current={current ? "page" : undefined}
                data-testid="cart-trip-tab"
                className={cn(
                  "card-edge flex w-56 flex-col items-start gap-0.5 rounded-card px-4 py-3 text-left shadow-soft lg:w-full",
                  "transition-[background-color,box-shadow,color] duration-300 ease-calm",
                  current ? "bg-forest text-white shadow-lift" : "bg-surface hover:shadow-lift",
                )}
              >
                <span className="w-full truncate font-semibold">{trip.name}</span>
                <span className={cn("text-sm", current ? "text-sky-mist" : "text-muted")}>
                  {[formatDateRange(trip.starts_on, trip.ends_on) ?? "No dates yet", itemCount(trip.items.length)].join(" · ")}
                </span>
                {progress && <span className={cn("text-small font-semibold", current ? "text-mint" : "text-emerald")}>{progress}</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
