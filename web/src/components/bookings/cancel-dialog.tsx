"use client";

import { useState } from "react";
import { formatDateRange } from "@/components/trips/format";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { TextareaField } from "@/components/ui/textarea-field";
import { formatPeso } from "@/lib/money";
import { CANCELLATION_POLICY } from "./cancellation";
import { useCancelBooking, type GuestBooking } from "./use-bookings";

// Cancelling a booking that hasn't started, from an item's panel in the cart or on the Trips
// page: a dialog saying what its cancellation policy gives back (RAA-133).
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
            onClick={() =>
              cancel.mutate({ id: booking.id, reason: reason.trim() || undefined }, { onSuccess: onCancelled })
            }
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
          {booking.cancellation_policy && (
            <span className="font-normal text-muted">{CANCELLATION_POLICY[booking.cancellation_policy]?.rule}</span>
          )}
        </p>
      )}
      <TextareaField
        label="Reason (optional)"
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        maxLength={500}
        rows={2}
      />
      {cancel.error && (
        <p role="alert" className="text-sm text-danger">
          {cancel.error.message}
        </p>
      )}
    </Dialog>
  );
}
