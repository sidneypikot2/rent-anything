"use client";

import { Fragment } from "react";
import { TickGlyph } from "@/components/discovery/tag-glyphs";
import { cn } from "@/components/ui/cn";
import { Dialog } from "@/components/ui/dialog";
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

// One entry in the sidebar, in the trip band's colour (navy on guest pages) while picked.
function tabClasses(current: boolean) {
  return cn(
    "flex min-h-11 w-full flex-col items-start rounded-card px-3.5 py-2.5 text-left shadow-soft",
    "transition-[background-color,border-color,box-shadow,color] duration-300 ease-calm",
    current ? "border border-trip-band bg-trip-band text-white shadow-lift" : "card-edge-line bg-surface hover:border-line-2 hover:shadow-lift",
  );
}

export type TripGroup = { label: string; trips: Trip[] };

type ListProps = {
  groups: TripGroup[];
  selectedId: number | undefined;
  onSelect: (trip: Trip) => void;
  detail?: (trip: Trip) => string;
  label?: string;
  // Each group's label over its trips, even when there is one group.
  grouped?: boolean;
  // How many items the trip shows: the Trips page counts only the booked ones.
  count?: (trip: Trip) => number;
};

// What a trip says wherever it is picked: its name, dates and items, and how its bookings
// stand. `even` keeps the last line's room when there is nothing to say, so rows match.
function TripRow({
  trip,
  current,
  line,
  count,
  even = false,
}: {
  trip: Trip;
  current: boolean;
  line: string;
  count: number;
  even?: boolean;
}) {
  return (
    <>
      <span className="w-full truncate font-semibold">{trip.name}</span>
      <span className={cn("text-sm", current ? "text-sky-mist" : "text-muted")}>
        {[formatDateRange(trip.starts_on, trip.ends_on) ?? "No dates yet", itemCount(count)].join(" · ")}
      </span>
      {(line || even) && (
        <span className={cn("min-h-lh text-small font-semibold", current ? "text-mint" : "text-emerald")}>{line}</span>
      )}
    </>
  );
}

// The cart's trips (RAA-135), to pick the one shown beside them: from lg a sticky column under
// the header. The pick is the page's `?trip=`. The Trips page (RAA-140) splits them into groups,
// each under its label, and says on each trip how it went (`detail`) in place of its bookings'
// progress. Below lg the trip's header has Switch trip instead, opening TripSwitchSheet.
export function CartTripNav({
  groups,
  selectedId,
  onSelect,
  detail = bookingProgress,
  label = "Your trips",
  grouped = false,
  count = (trip) => trip.items.length,
}: ListProps) {
  return (
    <nav aria-label={label} className="hidden min-w-0 lg:sticky lg:top-(--chrome) lg:block lg:self-start" data-testid="cart-trip-nav">
      {!grouped && <h2 className="mb-2 text-sm font-semibold text-muted">{groups[0]?.label}</h2>}
      <ul className="flex flex-col gap-1.5">
        {groups.map((group) => (
          <Fragment key={group.label}>
            {grouped && (
              <li className="mt-2 text-sm font-semibold text-muted first:mt-0" data-testid="trip-group">
                <h2>{group.label}</h2>
              </li>
            )}
            {group.trips.map((trip) => {
              const current = trip.id === selectedId;
              return (
                <li key={trip.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(trip)}
                    aria-current={current ? "page" : undefined}
                    data-testid="cart-trip-tab"
                    className={tabClasses(current)}
                  >
                    <TripRow trip={trip} current={current} line={detail(trip)} count={count(trip)} />
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

// The same trips on a phone (RAA-161), in a sheet from the trip header's Switch trip: one even
// row each, the shown one ticked. Picking one shows it and closes the sheet.
export function TripSwitchSheet({
  open,
  onClose,
  groups,
  selectedId,
  onSelect,
  detail = bookingProgress,
  label = "Your trips",
  grouped = false,
  count = (trip) => trip.items.length,
}: ListProps & { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} placement="sheet" title={label} meta="Pick one to see it" data-testid="trip-switch-sheet">
      <div className="flex flex-col gap-4">
        {groups.map((group) => (
          <section key={group.label} className="flex flex-col gap-2">
            {grouped && (
              <h3 className="text-xs font-semibold text-muted" data-testid="trip-switch-group">
                {group.label}
              </h3>
            )}
            <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-[1.375rem] border border-line">
              {group.trips.map((trip) => {
                const current = trip.id === selectedId;
                return (
                  <li key={trip.id} className="group/opt">
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(trip);
                        onClose();
                      }}
                      aria-current={current ? "page" : undefined}
                      data-testid="trip-switch-option"
                      className={cn(
                        "flex min-h-16 w-full items-center gap-3 px-3.5 py-3 text-left transition-colors duration-300 ease-calm",
                        "group-first/opt:rounded-t-[1.3125rem] group-last/opt:rounded-b-[1.3125rem]",
                        current ? "bg-action-tint inset-ring-2 inset-ring-action-ink" : "hover:bg-surface-2",
                      )}
                    >
                      <span className="flex min-w-0 flex-1 flex-col">
                        <TripRow trip={trip} current={false} line={detail(trip)} count={count(trip)} even />
                      </span>
                      {current && <TickGlyph className="size-5 shrink-0 text-action-ink" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </Dialog>
  );
}
