"use client";

import { formatDateRange } from "@/components/trips/format";
import type { Trip, TripItem } from "@/components/trips/use-trips";
import { Button } from "@/components/ui/button";
import { Dialog, DialogSummary } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
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

// What the guest is told until payments go live: PayMongo runs in test mode.
export const TEST_MODE_NOTE =
  "Test payment — no real money is charged. On PayMongo's page, use a test card or the test e-wallet page.";

// Paying for a trip's accepted bookings (RAA-143), in a sheet: what will be paid and by when.
// With PayMongo the guest is sent to its checkout page and comes back to the cart
// (PaymentReturn); without it, or when nothing is charged, the bookings come back confirmed and
// are shown here. All or nothing: one booking past its pay-by time refuses the lot.
export function PaySheet({ trip, items, onClose }: { trip: Trip; items: TripItem[]; onClose: () => void }) {
  const pay = usePayBookings();
  const toast = useToast();
  const checkoutUrl = pay.data?.payment?.checkout_url;
  const result = pay.data && !checkoutUrl ? pay.data.bookings : undefined;
  const leaving = checkoutUrl !== undefined && checkoutUrl !== null;

  function close() {
    if (!pay.isPending && !leaving) onClose();
  }

  return (
    <Dialog
      open
      onClose={close}
      placement="sheet"
      // Named after the trip (the modal redesign); the button says what it pays.
      title={result ? "You're booked" : leaving ? "Taking you to PayMongo…" : trip.name}
      meta={result || leaving ? undefined : `${items.length === 1 ? "1 booking" : `${items.length} bookings`} to pay`}
      data-testid="pay-sheet"
      summary={
        result ? undefined : (
          <DialogSummary value={<span data-testid="pay-total">{payTotal(items)}</span>} detail="Total" />
        )
      }
      actions={
        result ? (
          <Button type="button" onClick={onClose}>
            Done
          </Button>
        ) : (
          <>
            <Button
              type="button"
              data-testid="pay-confirm"
              loading={pay.isPending || leaving}
              onClick={() =>
                pay.mutate(
                  items.flatMap((item) => (item.booking ? [item.booking.id] : [])),
                  {
                    onSuccess: ({ bookings, payment }) => {
                      if (payment?.checkout_url) {
                        window.location.assign(payment.checkout_url);
                        return;
                      }
                      toast.show(
                        bookings.length === 1 ? "Paid · you're booked" : `Paid for ${bookings.length} · you're booked`,
                        { "data-testid": "pay-toast" },
                      );
                    },
                  },
                )
              }
            >
              {pay.isPending || leaving ? "Paying…" : `Pay ${payTotal(items)}`}
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
      <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-[1.375rem] border border-line">
        {items.map((item) => (
          <li key={item.id} className="flex items-start justify-between gap-3 px-3.5 py-3">
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
      <p className="text-sm text-muted">
        {by && <>Accepted by the partner: pay by {by} to keep your dates. </>}
        {TEST_MODE_NOTE}
      </p>
    </div>
  );
}

export function Paid({ bookings }: { bookings: GuestBooking[] }) {
  return (
    <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-[1.375rem] border border-line" data-testid="pay-result">
      {bookings.map((booking) => (
        <li key={booking.id} className="flex items-start justify-between gap-3 px-3.5 py-3">
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
