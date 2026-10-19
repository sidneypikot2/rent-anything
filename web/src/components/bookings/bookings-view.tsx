"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { formatDateRange } from "@/components/trips/format";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Pill } from "@/components/ui/pill";
import { TextareaField } from "@/components/ui/textarea-field";
import { Toast } from "@/components/ui/toast";
import { formatPeso } from "@/lib/money";
import { BookingStatusBadge } from "./booking-status";
import { useBookings, useCancelBooking, type GuestBooking } from "./use-bookings";

type Tab = "upcoming" | "past";

// The policy a booking was made under, as the cancel dialog explains a refund.
const POLICY: Record<string, string> = {
  free_cancellation: "Free cancellation until the day before it starts.",
  seven_days: "Free cancellation until 7 days before it starts.",
  fourteen_days: "Free cancellation until 14 days before it starts.",
  non_refundable: "Non-refundable.",
};

// Upcoming: still holding its days and not over. The API lists those first.
function isUpcoming(booking: GuestBooking) {
  return booking.cancellable || booking.status === "in_progress";
}

// The guest's bookings (RAA-133): upcoming ones (requests waiting for their partner too)
// and the rest, each with its status, reference, dates and total. One that hasn't started
// can be cancelled, after a dialog saying what its cancellation policy gives back.
export function BookingsView() {
  const bookings = useBookings();
  const [tab, setTab] = useState<Tab>("upcoming");
  const [cancelling, setCancelling] = useState<GuestBooking | null>(null);
  const [notice, setNotice] = useState<{ id: number; text: string } | null>(null);
  const dismissNotice = useCallback(() => setNotice(null), []);

  const list = (bookings.data ?? []).filter((booking) => isUpcoming(booking) === (tab === "upcoming"));

  return (
    <>
      <div className="flex gap-2" role="group" aria-label="Which bookings">
        <Pill on={tab === "upcoming"} onClick={() => setTab("upcoming")}>
          Upcoming
        </Pill>
        <Pill on={tab === "past"} onClick={() => setTab("past")}>
          Past and cancelled
        </Pill>
      </div>

      {bookings.isPending ? (
        <p className="text-sm text-muted">Loading your bookings…</p>
      ) : bookings.isError ? (
        <p role="alert" className="text-sm text-danger">
          {bookings.error.message}
        </p>
      ) : list.length === 0 ? (
        <Card data-testid="bookings-empty">
          <CardBody pad="lg" className="flex flex-col items-start gap-3">
            <p className="font-semibold">{tab === "upcoming" ? "Nothing booked yet" : "No past bookings"}</p>
            {tab === "upcoming" && (
              <>
                <p className="text-sm text-muted">Book the items in a trip from your cart.</p>
                <ButtonLink href="/cart" size="sm">
                  Go to your cart
                </ButtonLink>
              </>
            )}
          </CardBody>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {list.map((booking) => (
            <li key={booking.id}>
              <BookingCard booking={booking} onCancel={() => setCancelling(booking)} />
            </li>
          ))}
        </ul>
      )}

      {cancelling && (
        <CancelDialog
          booking={cancelling}
          onClose={() => setCancelling(null)}
          onCancelled={(booking) => {
            setCancelling(null);
            setNotice({ id: Date.now(), text: `Cancelled ${booking.listing.title}` });
          }}
        />
      )}

      <Toast data-testid="bookings-toast" message={notice?.text ?? null} id={notice?.id} onDismiss={dismissNotice} />
    </>
  );
}

function total(booking: GuestBooking) {
  return booking.to_be_agreed ? "Price to be agreed with the partner" : formatPeso(booking.total_cents);
}

function BookingCard({ booking, onCancel }: { booking: GuestBooking; onCancel: () => void }) {
  const waiting = booking.status === "requested" && booking.expires_at;
  return (
    <Card data-testid="booking-row">
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
        {waiting && (
          <p className="text-sm">
            The partner answers by {new Date(booking.expires_at!).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })}.
            Your dates are held until then.
          </p>
        )}
        {booking.status === "cancelled" && booking.refund_cents !== null && (
          <p className="text-sm">
            {booking.cancelled_by === "partner" ? "Cancelled by the partner. " : ""}
            Refund: {formatPeso(booking.refund_cents)}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
          <span className="font-semibold tabular-nums">{total(booking)}</span>
          {booking.cancellable && (
            <Button type="button" variant="soft" size="sm" onClick={onCancel} data-testid="booking-cancel">
              Cancel booking
            </Button>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

// Also opened from the cart's item panel (RAA-135).
export function CancelDialog({
  booking,
  onClose,
  onCancelled,
}: {
  booking: GuestBooking;
  onClose: () => void;
  onCancelled: (booking: GuestBooking) => void;
}) {
  const cancel = useCancelBooking();
  const [reason, setReason] = useState("");
  const refund = booking.refund_if_cancelled_cents;
  // Only a confirmed booking has been paid for; a request or an unpaid hold costs nothing.
  const paid = booking.status === "confirmed";

  return (
    <Dialog
      open
      onClose={() => !cancel.isPending && onClose()}
      title="Cancel this booking?"
      data-testid="booking-cancel-dialog"
      actions={
        <>
          <Button type="button" variant="soft" onClick={onClose} disabled={cancel.isPending}>
            Keep it
          </Button>
          <Button
            type="button"
            variant="danger"
            data-testid="booking-cancel-confirm"
            disabled={cancel.isPending}
            onClick={() => cancel.mutate({ id: booking.id, reason: reason.trim() || undefined }, { onSuccess: onCancelled })}
          >
            {cancel.isPending ? "Cancelling…" : "Cancel booking"}
          </Button>
        </>
      }
    >
      <p className="text-sm">
        {booking.listing.title}, {formatDateRange(booking.starts_on, booking.ends_on)}. Its dates are freed for others.
      </p>
      {paid && (
        <p className="text-sm font-semibold" data-testid="booking-cancel-refund">
          {refund ? `You get back ${formatPeso(refund)}.` : "You get nothing back."}{" "}
          {booking.cancellation_policy && <span className="font-normal text-muted">{POLICY[booking.cancellation_policy]}</span>}
        </p>
      )}
      <TextareaField label="Reason (optional)" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} rows={2} />
      {cancel.error && (
        <p role="alert" className="text-sm text-danger">
          {cancel.error.message}
        </p>
      )}
    </Dialog>
  );
}
