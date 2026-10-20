"use client";

import { useState } from "react";
import { BoltGlyph } from "@/components/discovery/tag-glyphs";
import { formatDateRange } from "@/components/trips/format";
import type { Trip, TripItem } from "@/components/trips/use-trips";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { formatPeso } from "@/lib/money";
import { BookingStatusBadge } from "./booking-status";
import { newIdempotencyKey, useCheckout, type Checkout } from "./use-bookings";

// What the cart's button says for the items picked (RAA-133): instant-book items are booked,
// request-to-book ones sent as requests.
export function checkoutLabel(items: TripItem[]) {
  const instant = items.filter((item) => item.listing.instant_book).length;
  if (instant === items.length) return "Book";
  if (instant === 0) return items.length === 1 ? "Send request" : "Send requests";
  return "Book and request";
}

// Booking a trip's picked items (RAA-133), in a sheet: what will be booked and how, then the
// bookings as they came back, each with its status and total. The API re-prices every item
// and checks the calendar again, all or nothing, so a refusal names the item and nothing is
// booked. One idempotency key per sheet, so pressing again after a failed connection can't
// book twice.
export function CheckoutSheet({ trip, items, onClose }: { trip: Trip; items: TripItem[]; onClose: () => void }) {
  const checkout = useCheckout();
  const [key] = useState(newIdempotencyKey);
  const result = checkout.data;

  function close() {
    if (!checkout.isPending) onClose();
  }

  return (
    <Dialog
      open
      onClose={close}
      placement="sheet"
      title={result ? bookedTitle(result) : `${checkoutLabel(items)} · ${trip.name}`}
      data-testid="checkout-sheet"
      actions={
        result ? (
          <Button type="button" onClick={onClose}>
            Done
          </Button>
        ) : (
          <>
            <Button type="button" variant="soft" onClick={close} disabled={checkout.isPending}>
              Cancel
            </Button>
            <Button
              type="button"
              data-testid="checkout-confirm"
              disabled={checkout.isPending}
              onClick={() => checkout.mutate({ tripId: trip.id, itemIds: items.map((item) => item.id), idempotencyKey: key })}
            >
              {checkout.isPending ? "Booking…" : checkoutLabel(items)}
            </Button>
          </>
        )
      }
    >
      {result ? <Booked result={result} /> : <Picked items={items} />}
      {checkout.error && (
        <p role="alert" data-testid="checkout-error" className="text-sm text-danger">
          {checkout.error.message}
        </p>
      )}
    </Dialog>
  );
}

function bookedTitle(result: Checkout) {
  return result.bookings.every((booking) => booking.status === "confirmed") ? "You're booked" : "Sent";
}

function Picked({ items }: { items: TripItem[] }) {
  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col divide-y divide-line rounded-control border border-line">
        {items.map((item) => (
          <li key={item.id} className="flex flex-col gap-0.5 px-3 py-2.5">
            <span className="font-semibold">{item.listing.title}</span>
            <span className="text-sm text-muted">{formatDateRange(item.starts_on, item.ends_on)}</span>
            <span className="flex items-center gap-1.5 text-sm">
              {item.listing.instant_book ? (
                <>
                  <BoltGlyph className="size-4 text-primary" />
                  Instant book: booked straight away
                </>
              ) : (
                "Request to book: the partner has 24 hours to accept, your dates held meanwhile"
              )}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted">
        Each price is worked out from the listing&apos;s calendar when you send it. You&apos;ll see each answer in your cart.
        Payments aren&apos;t live yet, so nothing is charged.
      </p>
    </div>
  );
}

function Booked({ result }: { result: Checkout }) {
  return (
    <div className="flex flex-col gap-4" data-testid="checkout-result">
      <ul className="flex flex-col divide-y divide-line rounded-control border border-line">
        {result.bookings.map((booking) => (
          <li key={booking.id} className="flex items-start justify-between gap-3 px-3 py-2.5">
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="font-semibold">{booking.listing.title}</span>
              <span className="text-sm text-muted">
                {formatDateRange(booking.starts_on, booking.ends_on)} · {booking.reference}
              </span>
              <span className="text-sm font-semibold tabular-nums">
                {booking.to_be_agreed ? "Price to be agreed with the partner" : formatPeso(booking.total_cents)}
              </span>
            </span>
            <BookingStatusBadge status={booking.status} small />
          </li>
        ))}
      </ul>
      <p className="flex justify-between text-sm font-semibold">
        <span>Total</span>
        <span className="tabular-nums">{formatPeso(result.total_cents)}</span>
      </p>
    </div>
  );
}
