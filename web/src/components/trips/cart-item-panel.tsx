"use client";

import { Fragment, type ReactNode } from "react";
import { BOOKING_STATUS, BookingStatusBadge } from "@/components/bookings/booking-status";
import { CANCELLATION_POLICY } from "@/components/bookings/cancellation";
import { useBooking, type GuestBooking } from "@/components/bookings/use-bookings";
import { ListingPanel, PanelPhoto } from "@/components/discovery/detail-panel";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { formatPeso } from "@/lib/money";
import { formatDateRange, formatDay, guestCount, todayIso } from "./format";
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
        <Button
          type="button"
          variant="ghost"
          onClick={() => actions.removeItem(trip, item)}
          data-testid="item-panel-remove"
        >
          Remove
        </Button>
        <span className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="soft"
            onClick={() => actions.redateItem(trip, item)}
            data-testid="item-panel-date"
          >
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
        <BookingSection
          booking={details}
          reference={item.booking.reference}
          status={item.booking.status}
          loading={booking.isPending}
          failed={booking.isError}
        />
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

// Paid for already: what a cancellation can refund. A request or an unpaid hold costs nothing.
const PAID = new Set(["confirmed", "in_progress", "completed"]);

const CANCELLED_BY: Record<string, string> = { guest: "you", partner: "the partner", system: "automatically" };

// "Nov 28"; a date it can't read stays as it came.
function day(iso: string) {
  return formatDay(iso) ?? iso;
}

// A booking's days as its type reads them: a stay's check-in and check-out, a rental's first
// and last day, anything else its day.
function dateRows(booking: GuestBooking): [string, string][] {
  if (booking.booking_type === "stay") {
    return [
      ["Check-in", day(booking.starts_on)],
      ["Check-out", day(booking.ends_on)],
    ];
  }
  if (booking.booking_type === "rental") {
    return [
      ["From", day(booking.starts_on)],
      ["Until", day(booking.ends_on)],
    ];
  }
  return [["Date", formatDateRange(booking.starts_on, booking.ends_on) ?? day(booking.starts_on)]];
}

function Rows({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[minmax(6.5rem,auto)_1fr] gap-x-4 gap-y-1 text-sm">
      {rows.map(([label, value]) => (
        <Fragment key={label}>
          <dt className="text-muted">{label}</dt>
          <dd>{value}</dd>
        </Fragment>
      ))}
    </dl>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 border-t border-line pt-3">
      <h4 className="text-small font-semibold text-muted">{title}</h4>
      {children}
    </div>
  );
}

// What the guest booked and on what terms (RAA-135): when, for how many and what it costs; the
// cancellation policy it was booked under, the last day to cancel for free (the API's
// free_cancellation_until) and what cancelling now gives back (refund_if_cancelled_cents); and
// when it was booked and confirmed. Nothing about a refund is worked out here.
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
      {booking && <BookingDetails booking={booking} />}
    </PanelBlock>
  );
}

function BookingDetails({ booking }: { booking: GuestBooking }) {
  const policy = booking.cancellation_policy ? CANCELLATION_POLICY[booking.cancellation_policy] : undefined;
  const freeUntil = booking.free_cancellation_until;
  const paid = PAID.has(booking.status);

  return (
    <>
      {booking.status === "requested" && booking.expires_at && (
        <p className="text-sm">
          Waiting for the partner, who answers by {when(booking.expires_at)}. Your dates are held until then.
        </p>
      )}

      <Group title="Dates and price">
        <Rows
          rows={[
            ...dateRows(booking),
            ["Guests", String(booking.guests ?? booking.quantity)],
            [
              "Total",
              <span key="total" className="font-semibold tabular-nums">
                {booking.to_be_agreed ? "To be agreed with the partner" : formatPeso(booking.total_cents)}
              </span>,
            ],
          ]}
        />
      </Group>

      {booking.status === "cancelled" ? (
        <Group title="Cancelled">
          <Rows
            rows={[
              ...(booking.cancelled_at
                ? [
                    [
                      "Cancelled",
                      `${when(booking.cancelled_at)}${booking.cancelled_by ? `, by ${CANCELLED_BY[booking.cancelled_by]}` : ""}`,
                    ] as [string, string],
                  ]
                : []),
              ...(booking.refund_cents !== null
                ? [["Refund", formatPeso(booking.refund_cents)] as [string, string]]
                : []),
            ]}
          />
        </Group>
      ) : (
        policy && (
          <Group title="Cancellation">
            <Rows
              rows={[
                ["Policy", policy.name],
                [
                  "Free until",
                  freeUntil ? (
                    freeUntil >= todayIso() ? (
                      <span key="free" className="font-semibold text-emerald" data-testid="item-panel-free-until">
                        {day(freeUntil)}
                      </span>
                    ) : (
                      `Ended ${day(freeUntil)}`
                    )
                  ) : (
                    "No refund if you cancel"
                  ),
                ],
                ...(booking.cancellable
                  ? [
                      [
                        "If you cancel now",
                        paid
                          ? booking.refund_if_cancelled_cents
                            ? `You get back ${formatPeso(booking.refund_if_cancelled_cents)}`
                            : "You get nothing back"
                          : "Nothing is charged yet",
                      ] as [string, string],
                    ]
                  : []),
              ]}
            />
            <p className="text-xs text-muted">{policy.rule}</p>
          </Group>
        )
      )}

      <Group title="Booking">
        <Rows
          rows={[
            ["Reference", booking.reference],
            ["Booked", when(booking.created_at)],
            ...(booking.confirmed_at ? [["Confirmed", when(booking.confirmed_at)] as [string, string]] : []),
            ["How", booking.booking_mode === "instant" ? "Instant book" : "Request to book"],
          ]}
        />
      </Group>

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
  );
}
