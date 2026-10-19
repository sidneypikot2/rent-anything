"use client";

import type { ReactNode } from "react";
import { BOOKING_STATUS, BookingStatusBadge } from "@/components/bookings/booking-status";
import { useBooking, type GuestBooking } from "@/components/bookings/use-bookings";
import { ListingPanel, PanelPhoto } from "@/components/discovery/detail-panel";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { formatPeso } from "@/lib/money";
import { formatDateRange, guestCount, todayIso } from "./format";
import { bookable, type TripActions } from "./trip-details";
import type { Trip, TripItem } from "./use-trips";

// A booking that holds its days and hasn't started can be changed (Bookings::Change, RAA-134).
const CHANGEABLE = new Set(["requested", "accepted", "awaiting_payment", "confirmed"]);

export function canChange(booking: GuestBooking) {
  return CHANGEABLE.has(booking.status) && booking.starts_on > todayIso();
}

function when(iso: string) {
  return new Date(iso).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" });
}

// One item of a trip, opened from the cart (RAA-135), in the side panel: its booking first when
// it has one (status, reference, dates, guests, total, the partner's answer-by time, history),
// then the listing (ListingPanel, as on the area page). The foot edits or cancels the booking,
// or, unbooked, re-dates, removes or sends the item; each opens its own sheet over the cart.
export function CartItemPanel({
  trip,
  item,
  actions,
  onEditBooking,
  onCancelBooking,
  onClose,
}: {
  trip: Trip;
  item: TripItem;
  actions: TripActions;
  onEditBooking: (booking: GuestBooking) => void;
  onCancelBooking: (booking: GuestBooking) => void;
  onClose: () => void;
}) {
  const booking = useBooking(item.booking?.id);
  const photo = item.listing.cover_photo_url;
  const details = booking.data;

  let foot: ReactNode;
  if (item.booking) {
    foot = details && (canChange(details) || details.cancellable) && (
      <>
        {details.cancellable ? (
          <Button type="button" variant="soft" onClick={() => onCancelBooking(details)} data-testid="item-panel-cancel">
            Cancel reservation
          </Button>
        ) : (
          <span />
        )}
        {canChange(details) && (
          <Button type="button" onClick={() => onEditBooking(details)} data-testid="item-panel-edit">
            Edit booking
          </Button>
        )}
      </>
    );
  } else {
    foot = (
      <>
        <Button type="button" variant="ghost" onClick={() => actions.removeItem(trip, item)} data-testid="item-panel-remove">
          Remove
        </Button>
        <span className="flex flex-wrap gap-2">
          <Button type="button" variant="soft" onClick={() => actions.redateItem(trip, item)} data-testid="item-panel-date">
            {item.starts_on ? "Change date" : "Pick a date"}
          </Button>
          {bookable(item) && (
            <Button type="button" onClick={() => actions.checkout(trip, [item])} data-testid="item-panel-book">
              Send request
            </Button>
          )}
        </span>
      </>
    );
  }

  return (
    <Dialog
      open
      placement="side"
      title={item.listing.title}
      media={photo ? <PanelPhoto photo={{ src: photo, alt: item.listing.title }} /> : undefined}
      onClose={onClose}
      actions={foot || undefined}
      data-testid="cart-item-panel"
    >
      {item.booking ? (
        <BookingSection booking={details} reference={item.booking.reference} status={item.booking.status} loading={booking.isPending} failed={booking.isError} />
      ) : (
        <PanelBlock title="In your trip">
          <p className="text-sm">
            {[formatDateRange(item.starts_on, item.ends_on) ?? "No date yet", guestCount(item.quantity)].join(" · ")}
          </p>
          <p className="text-sm text-muted">
            Not booked yet. Sending it asks the partner, who has 24 hours to accept; your dates are held meanwhile.
          </p>
        </PanelBlock>
      )}
      <ListingPanel
        listingId={item.listing.id}
        href={`/listings/${item.listing.id}`}
        category={item.listing.category}
        by=""
        features={[]}
      />
    </Dialog>
  );
}

function PanelBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 rounded-control bg-surface-2 p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function BookingSection({
  booking,
  reference,
  status,
  loading,
  failed,
}: {
  booking: GuestBooking | undefined;
  reference: string;
  status: GuestBooking["status"];
  loading: boolean;
  failed: boolean;
}) {
  return (
    <PanelBlock title="Your booking">
      <p className="flex flex-wrap items-center gap-2" data-testid="item-panel-booking">
        <BookingStatusBadge status={booking?.status ?? status} />
        <span className="text-sm text-muted">{reference}</span>
      </p>
      {loading && <div role="status" aria-busy className="h-16 rounded-control bg-mist motion-safe:animate-pulse" />}
      {failed && <p className="text-sm text-muted">Couldn&apos;t load the rest of this booking.</p>}
      {booking && (
        <>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted">Dates</dt>
            <dd>{formatDateRange(booking.starts_on, booking.ends_on)}</dd>
            <dt className="text-muted">Guests</dt>
            <dd>{booking.guests ?? booking.quantity}</dd>
            <dt className="text-muted">Total</dt>
            <dd className="font-semibold tabular-nums">
              {booking.to_be_agreed ? "To be agreed with the partner" : formatPeso(booking.total_cents)}
            </dd>
          </dl>
          {booking.status === "requested" && booking.expires_at && (
            <p className="text-sm">
              Waiting for the partner, who answers by {when(booking.expires_at)}. Your dates are held until then.
            </p>
          )}
          {booking.status === "cancelled" && booking.refund_cents !== null && (
            <p className="text-sm">Refund: {formatPeso(booking.refund_cents)}</p>
          )}
          {booking.events.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer font-semibold text-link">History</summary>
              <ol className="mt-2 flex flex-col gap-1.5 border-l border-line pl-3">
                {booking.events.map((event, index) => (
                  <li key={index}>
                    <span className="font-medium">
                      {event.from_status === event.to_status ? "Changed" : BOOKING_STATUS[event.to_status].label}
                    </span>
                    <span className="text-muted">
                      {" "}
                      · {when(event.created_at)}
                      {event.reason && ` · ${event.reason}`}
                    </span>
                  </li>
                ))}
              </ol>
            </details>
          )}
        </>
      )}
    </PanelBlock>
  );
}
