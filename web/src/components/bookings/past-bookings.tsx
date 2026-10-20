"use client";

import Link from "next/link";
import { formatDateRange } from "@/components/trips/format";
import { Card, CardBody } from "@/components/ui/card";
import { formatPeso } from "@/lib/money";
import { BookingStatusBadge } from "./booking-status";
import { useBookings, type GuestBooking } from "./use-bookings";

// Ended without taking place: such a booking lets its item go, so no trip shows it. A completed
// one keeps its item and shows with its past trip.
const LET_GO = new Set(["cancelled", "declined", "expired"]);

// The bookings no trip holds, under the Trips page's past trips (RAA-133 listed them on their
// own page before).
export function PastBookings() {
  const bookings = useBookings();
  const list = (bookings.data ?? []).filter((booking) => LET_GO.has(booking.status));

  if (bookings.isPending) return <p className="text-sm text-muted">Loading your bookings…</p>;
  if (bookings.isError) {
    return (
      <p role="alert" className="text-sm text-danger">
        {bookings.error.message}
      </p>
    );
  }

  return (
    <section aria-labelledby="past-bookings-title" data-testid="past-bookings" className="flex min-w-0 flex-col gap-3">
      <h2 id="past-bookings-title" className="font-display text-xl font-extrabold tracking-tight sm:text-2xl">
        Cancelled bookings
      </h2>
      <p className="-mt-1 text-sm text-muted">Cancelled, declined and expired bookings no longer belong to a trip.</p>
      {list.length === 0 ? (
        <Card edge="line" data-testid="past-bookings-empty">
          <p className="p-card text-sm text-muted">No cancelled bookings.</p>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {list.map((booking) => (
            <li key={booking.id}>
              <BookingCard booking={booking} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function BookingCard({ booking }: { booking: GuestBooking }) {
  return (
    <Card edge="line" data-testid="booking-row">
      <CardBody className="flex flex-col gap-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <Link
            href={`/listings/${booking.listing.id}`}
            className="min-w-0 text-lg font-semibold leading-snug hover:text-primary hover:underline"
          >
            {booking.listing.title}
          </Link>
          <BookingStatusBadge status={booking.status} />
        </div>
        <p className="text-sm text-muted">
          {[formatDateRange(booking.starts_on, booking.ends_on), booking.area.name, booking.reference].join(" · ")}
        </p>
        {booking.status === "cancelled" && booking.refund_cents !== null && (
          <p className="text-sm">
            {booking.cancelled_by === "partner" ? "Cancelled by the partner. " : ""}
            Refund: {formatPeso(booking.refund_cents)}
          </p>
        )}
        <p className="border-t border-line pt-3 font-semibold tabular-nums">
          {booking.to_be_agreed ? "Price to be agreed with the partner" : formatPeso(booking.total_cents)}
        </p>
      </CardBody>
    </Card>
  );
}
