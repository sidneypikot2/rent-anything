"use client";

import { BookingStatusBadge } from "@/components/bookings/booking-status";
import { Card } from "@/components/ui/card";
import { itinerary, ROLE_LABEL } from "./itinerary";
import type { Trip, TripItem } from "./use-trips";

function weekday(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

// A trip day by day (RAA-140): each day with what happens on it, so a guest sees a day left
// empty or two stays booked for one night before booking. An entry opens the item's panel.
export function TripItinerary({ trip, onOpen }: { trip: Trip; onOpen: (item: TripItem) => void }) {
  const days = itinerary(trip);
  const undated = trip.items.filter((item) => !item.starts_on);

  if (!days) {
    return (
      <Card edge="line">
        <p className="p-card text-sm text-muted">Give the trip dates to see it day by day.</p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3" data-testid="trip-itinerary">
      <ol className="flex flex-col gap-2">
        {days.map((day, index) => (
          <li key={day.date} data-testid="itinerary-day">
            <Card edge="line" className="flex flex-col gap-2 px-card py-3 sm:flex-row sm:gap-4">
              <p className="w-32 shrink-0 text-sm">
                <span className="font-semibold">Day {index + 1}</span>
                <span className="text-muted"> · {weekday(day.date)}</span>
              </p>
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                {day.entries.length === 0 ? (
                  <p className="text-sm text-muted" data-testid="itinerary-free-day">
                    Nothing planned yet: a free day, or room for a tour.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {day.entries.map(({ item, role }) => (
                      // The same columns on every row, so the pills line up whatever the title; on a
                      // phone the pill goes under the title, which keeps the width.
                      <li
                        key={item.id}
                        className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-1 text-sm sm:grid-cols-[6rem_minmax(0,1fr)_auto]"
                      >
                        <span className="text-muted">{ROLE_LABEL[role]}</span>
                        <button
                          type="button"
                          aria-haspopup="dialog"
                          onClick={() => onOpen(item)}
                          className="min-w-0 truncate text-left font-semibold hover:text-primary hover:underline"
                        >
                          {item.listing.title}
                        </button>
                        {item.booking && (
                          <span className="col-start-2 justify-self-start sm:col-start-3 sm:justify-self-end">
                            <BookingStatusBadge status={item.booking.status} small />
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {day.doubleStay && (
                  <p className="text-sm font-semibold text-warning" data-testid="itinerary-double-stay">
                    Two stays this night: check one isn&apos;t a mistake.
                  </p>
                )}
              </div>
            </Card>
          </li>
        ))}
      </ol>
      {undated.length > 0 && (
        <Card edge="line" className="px-card py-3">
          <p className="text-sm">
            <span className="font-semibold">No date yet: </span>
            {undated.map((item, index) => (
              <span key={item.id}>
                {index > 0 && ", "}
                <button type="button" onClick={() => onOpen(item)} className="text-link hover:underline">
                  {item.listing.title}
                </button>
              </span>
            ))}
          </p>
        </Card>
      )}
    </div>
  );
}
