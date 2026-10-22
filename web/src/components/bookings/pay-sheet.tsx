"use client";

import { formatDateRange } from "@/components/trips/format";
import type { Trip, TripItem } from "@/components/trips/use-trips";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { formatPeso } from "@/lib/money";
import { BookingStatusBadge } from "./booking-status";
import { usePayBookings, type GuestBooking } from "./use-bookings";

// A trip item whose booking is held for payment: accepted by its partner (RAA-143).
export function payable(item: TripItem) {
  return item.booking?.status === "awaiting_payment";
}

// The earliest pay-by time of the items, as "Oct 22, 2026, 8:00 AM".
export function payBy(items: TripItem[]) {
  const times = items.flatMap((item) => (item.booking?.expires_at ? [item.booking.expires_at] : []));
  if (times.length === 0) return null;
  const first = times.reduce((a, b) => (a < b ? a : b));
  return new Date(first).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" });
}

// What the picked items come to: their bookings' totals, with those priced with the partner
// counted apart.
export function payTotal(items: TripItem[]) {
  const total = items.reduce((sum, item) => sum + (item.booking?.total_cents ?? 0), 0);
  const agree = items.filter((item) => item.booking?.to_be_agreed).length;
  return agree === 0 ? formatPeso(total) : `${formatPeso(total)} + ${agree} to agree with the partner`;
}

// Paying for a trip's accepted bookings (RAA-143), in a sheet: what will be paid and by when,
// then the bookings as they came back, confirmed. All or nothing: one booking past its pay-by
// time refuses the lot, and nothing is paid. Payments aren't live yet, so nothing is charged.
export function PaySheet({ trip, items, onClose }: { trip: Trip; items: TripItem[]; onClose: () => void }) {
  const pay = usePayBookings();
  const result = pay.data;

  function close() {
    if (!pay.isPending) onClose();
  }

  return (
    <Dialog
      open
      onClose={close}
      placement="sheet"
      title={result ? "You're booked" : `Pay · ${trip.name}`}
      data-testid="pay-sheet"
      actions={
        result ? (
          <Button type="button" onClick={onClose}>
            Done
          </Button>
        ) : (
          <>
            <Button type="button" variant="soft" onClick={close} disabled={pay.isPending}>
              Cancel
            </Button>
            <Button
              type="button"
              data-testid="pay-confirm"
              disabled={pay.isPending}
              onClick={() => pay.mutate(items.flatMap((item) => (item.booking ? [item.booking.id] : [])))}
            >
              {pay.isPending ? "Paying…" : `Pay ${payTotal(items)}`}
            </Button>
          </>
        )
      }
    >
      {result ? <Paid bookings={result} /> : <ToPay items={items} />}
      {pay.error && (
        <p role="alert" data-testid="pay-error" className="text-sm text-danger">
          {pay.error.message}
        </p>
      )}
    </Dialog>
  );
}

function ToPay({ items }: { items: TripItem[] }) {
  const by = payBy(items);
  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col divide-y divide-line rounded-control border border-line">
        {items.map((item) => (
          <li key={item.id} className="flex items-start justify-between gap-3 px-3 py-2.5">
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="font-semibold">{item.listing.title}</span>
              <span className="text-sm text-muted">
                {formatDateRange(item.starts_on, item.ends_on)} · {item.booking?.reference}
              </span>
            </span>
            <span className="shrink-0 text-sm font-semibold tabular-nums">
              {item.booking?.to_be_agreed ? "Price to agree" : formatPeso(item.booking?.total_cents ?? 0)}
            </span>
          </li>
        ))}
      </ul>
      <p className="flex justify-between text-sm font-semibold">
        <span>Total</span>
        <span className="tabular-nums" data-testid="pay-total">
          {payTotal(items)}
        </span>
      </p>
      <p className="text-sm text-muted">
        {by && <>Accepted by the partner: pay by {by} to keep your dates. </>}
        Payments aren&apos;t live yet, so nothing is charged.
      </p>
    </div>
  );
}

function Paid({ bookings }: { bookings: GuestBooking[] }) {
  return (
    <ul className="flex flex-col divide-y divide-line rounded-control border border-line" data-testid="pay-result">
      {bookings.map((booking) => (
        <li key={booking.id} className="flex items-start justify-between gap-3 px-3 py-2.5">
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="font-semibold">{booking.listing.title}</span>
            <span className="text-sm text-muted">
              {formatDateRange(booking.starts_on, booking.ends_on)} · {booking.reference}
            </span>
          </span>
          <BookingStatusBadge status={booking.status} small />
        </li>
      ))}
    </ul>
  );
}
