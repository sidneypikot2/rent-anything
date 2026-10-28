"use client";

import { useState } from "react";
import { formatDateRange } from "@/components/trips/format";
import { Button } from "@/components/ui/button";
import { CalendarGlyph } from "@/components/discovery/tag-glyphs";
import { Dialog } from "@/components/ui/dialog";
import { Ticket, TicketNote, TicketRow } from "@/components/ui/ticket";
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
  // The reason is optional: a link opens its field, so the dialog stays a short question.
  const [giving, setGiving] = useState(false);
  const refund = booking.refund_if_cancelled_cents;
  // Only a confirmed booking has been paid for; a request or an unpaid hold costs nothing.
  const paid = booking.status === "confirmed";

  return (
    <Dialog
      open
      onClose={() => !cancel.isPending && onClose()}
      title="Cancel this booking?"
      meta="Its dates are freed for other travellers."
      tone="danger"
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
      <Ticket>
        <TicketRow
          icon={<CalendarGlyph />}
          value={booking.listing.title}
          label={[formatDateRange(booking.starts_on, booking.ends_on), booking.reference].filter(Boolean).join(" · ")}
        />
        {paid && (
          <TicketNote tone={refund ? "ok" : "warning"} data-testid="booking-cancel-refund">
            <span className="font-semibold">{refund ? `You get back ${formatPeso(refund)}.` : "You get nothing back."}</span>{" "}
            {booking.cancellation_policy && <span>{CANCELLATION_POLICY[booking.cancellation_policy]?.rule}</span>}
          </TicketNote>
        )}
      </Ticket>
      {giving ? (
        <TextareaField
          label="Reason (optional)"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={500}
          rows={2}
          autoFocus
        />
      ) : (
        <button
          type="button"
          onClick={() => setGiving(true)}
          className="tap-target self-start text-sm font-semibold text-link underline underline-offset-4 hover:text-primary"
        >
          Add a reason (optional)
        </button>
      )}
      {cancel.error && (
        <p role="alert" className="text-sm text-danger">
          {cancel.error.message}
        </p>
      )}
    </Dialog>
  );
}
