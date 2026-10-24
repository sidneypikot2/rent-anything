"use client";

import { useState } from "react";
import { InstantBookBadge } from "@/components/discovery/instant-book-badge";
import { formatDateRange, guestCount } from "@/components/trips/format";
import {
  itemPriceLabel,
  itemQuote,
  pickedTotal,
  useTripQuote,
  type Trip,
  type TripItem,
} from "@/components/trips/use-trips";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
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
  const toast = useToast();
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
              onClick={() =>
                checkout.mutate(
                  { tripId: trip.id, itemIds: items.map((item) => item.id), idempotencyKey: key },
                  { onSuccess: (done) => toast.show(checkoutNotice(done), { "data-testid": "checkout-toast" }) },
                )
              }
            >
              {checkout.isPending ? "Booking…" : checkoutLabel(items)}
            </Button>
          </>
        )
      }
    >
      {result ? <Booked result={result} /> : <Picked trip={trip} items={items} />}
      {checkout.error && (
        <p role="alert" data-testid="checkout-error" className="text-sm text-danger">
          {checkout.error.message}
        </p>
      )}
    </Dialog>
  );
}

// The toast once it's done: what was booked straight away and what went to partners as requests.
export function checkoutNotice(result: Checkout) {
  const booked = result.bookings.filter((booking) => booking.status === "confirmed").length;
  const sent = result.bookings.length - booked;
  const requests = sent === 1 ? "Request sent to the partner" : `${sent} requests sent to their partners`;
  if (sent === 0) return booked === 1 ? "Booked" : `${booked} booked`;
  return booked === 0 ? requests : `${booked} booked · ${requests.charAt(0).toLowerCase()}${requests.slice(1)}`;
}

function bookedTitle(result: Checkout) {
  return result.bookings.every((booking) => booking.status === "confirmed") ? "You're booked" : "Sent";
}

// What will be sent, with each item's price from the trip's quote (cached from the cart) and
// what they come to, so the guest checks it before sending. One note for all of them.
function Picked({ trip, items }: { trip: Trip; items: TripItem[] }) {
  const quote = useTripQuote(trip.id);
  const total = pickedTotal(quote.data, items);
  const requests = items.some((item) => !item.listing.instant_book);

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col divide-y divide-line rounded-control border border-line">
        {items.map((item) => {
          const dates = formatDateRange(item.starts_on, item.ends_on);
          const price = itemPriceLabel(itemQuote(quote.data, item));
          return (
            <li key={item.id} className="flex items-start justify-between gap-3 px-3 py-2.5">
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="flex flex-wrap items-center gap-2 font-semibold">
                  {item.listing.title}
                  {item.listing.instant_book && <InstantBookBadge small />}
                </span>
                <span className="text-sm text-muted">
                  {dates ? `${dates} · ` : ""}
                  {guestCount(item.quantity)}
                </span>
              </span>
              {quote.isPending ? (
                <span aria-hidden className="mt-1 block h-4 w-16 shrink-0 rounded bg-mist motion-safe:animate-pulse" />
              ) : (
                price && (
                  <span className="shrink-0 text-sm font-semibold tabular-nums" data-testid="checkout-item-price">
                    {price}
                  </span>
                )
              )}
            </li>
          );
        })}
      </ul>
      <p className="flex justify-between gap-3 text-sm font-semibold">
        <span>Total</span>
        <span className="text-right tabular-nums" data-testid="checkout-total">
          {total ?? (quote.isPending ? "Working out the total…" : "—")}
        </span>
      </p>
      <p className="text-sm text-muted">
        {requests && "Each partner has 24 hours to accept, and your dates are held meanwhile. "}
        You&apos;ll see each answer in your cart, and pay there once a partner accepts. Payments aren&apos;t live yet, so
        nothing is charged.
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
