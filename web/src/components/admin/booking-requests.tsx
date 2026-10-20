"use client";

import { Fragment, useState, type ReactNode } from "react";
import { BookingStatusBadge } from "@/components/bookings/booking-status";
import { CANCELLATION_POLICY } from "@/components/bookings/cancellation";
import { dateRows } from "@/components/trips/cart-item-panel";
import { guestCount } from "@/components/trips/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Pill } from "@/components/ui/pill";
import { TextareaField } from "@/components/ui/textarea-field";
import { Toast } from "@/components/ui/toast";
import { DisplayTitle } from "@/components/ui/typography";
import { formatPeso } from "@/lib/money";
import { useAdminBookings, useAnswerBooking, type AdminBooking, type AdminBookingFilter } from "./use-admin-bookings";

const FILTERS: { key: AdminBookingFilter; label: string }[] = [
  { key: "requested", label: "Requests" },
  { key: "confirmed", label: "Confirmed" },
  { key: "declined", label: "Declined" },
  { key: "expired", label: "Expired" },
  { key: "all", label: "All" },
];

const BOOKING_TYPES: Record<string, string> = {
  stay: "Stay",
  activity: "Tour or activity",
  rental: "Rental",
  transfer: "Transfer",
};

function when(iso: string) {
  return new Date(iso).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" });
}

// Every partner's booking requests (RAA-142): for launch the team answers them on partners'
// behalf. Requests come soonest to expire first; chips switch to other statuses. Each card says
// what is booked, for which partner, by whom and how to reach both, with Accept and Decline on
// a request. Partners can still answer their own, so an answer can come back already given.
export function BookingRequests() {
  const [filter, setFilter] = useState<AdminBookingFilter>("requested");
  const [declining, setDeclining] = useState<AdminBooking | null>(null);
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);
  const requests = useAdminBookings("requested");
  const bookings = useAdminBookings(filter);
  const answer = useAnswerBooking();

  function answered(booking: AdminBooking) {
    const message =
      booking.status === "declined"
        ? `Declined ${booking.reference} for ${booking.partner.business}.`
        : `Accepted ${booking.reference} for ${booking.partner.business}: it's confirmed.`;
    setToast((last) => ({ id: (last?.id ?? 0) + 1, message }));
    setDeclining(null);
  }

  return (
    <main className="mx-auto flex w-full max-w-page flex-1 flex-col gap-block px-gutter py-page-pad">
      <div className="flex flex-col gap-2">
        <DisplayTitle>Booking requests</DisplayTitle>
        <p className="max-w-lede text-on-dark">
          Accept or decline travellers&apos; requests on the partner&apos;s behalf. A request expires unanswered at its
          answer-by time.
        </p>
      </div>

      <div role="group" aria-label="Show" className="flex flex-wrap gap-2" data-testid="admin-booking-filters">
        {FILTERS.map(({ key, label }) => (
          <Pill key={key} on={filter === key} onClick={() => setFilter(key)} data-testid={`admin-booking-filter-${key}`}>
            {label}
            {key === "requested" && requests.data && (
              <span className="ml-1 tabular-nums opacity-80">{requests.data.length}</span>
            )}
          </Pill>
        ))}
      </div>

      {answer.error && !declining && (
        <p role="alert" className="text-sm font-semibold text-white" data-testid="admin-booking-error">
          {answer.error.message}
        </p>
      )}

      {bookings.isPending ? (
        <p className="text-sm text-on-dark">Loading bookings…</p>
      ) : bookings.error ? (
        <div className="flex flex-col items-start gap-3">
          <p role="alert" className="text-sm text-white">
            {bookings.error.message}
          </p>
          <Button size="sm" variant="soft" onClick={() => void bookings.refetch()}>
            Try again
          </Button>
        </div>
      ) : bookings.data.length === 0 ? (
        <Card data-testid="admin-bookings-empty">
          <CardBody>
            <p className="text-sm text-muted">
              {filter === "requested" ? "No requests waiting for an answer." : "No bookings here."}
            </p>
          </CardBody>
        </Card>
      ) : (
        <ul className="grid gap-gutter lg:grid-cols-2">
          {bookings.data.map((booking) => (
            <li key={booking.id}>
              <BookingCard
                booking={booking}
                busy={answer.isPending && answer.variables?.id === booking.id}
                onAccept={() => answer.mutate({ id: booking.id, status: "accepted" }, { onSuccess: answered })}
                onDecline={() => {
                  answer.reset();
                  setDeclining(booking);
                }}
              />
            </li>
          ))}
        </ul>
      )}

      {declining && (
        <DeclineDialog
          booking={declining}
          pending={answer.isPending}
          error={answer.error?.message}
          onClose={() => setDeclining(null)}
          onDecline={(reason) => answer.mutate({ id: declining.id, status: "declined", reason }, { onSuccess: answered })}
        />
      )}

      <Toast
        message={toast?.message ?? null}
        id={toast?.id}
        onDismiss={() => setToast(null)}
        data-testid="admin-booking-toast"
      />
    </main>
  );
}

function BookingCard({
  booking,
  busy,
  onAccept,
  onDecline,
}: {
  booking: AdminBooking;
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const { partner, traveller } = booking;
  const rows: [string, ReactNode][] = [
    ...dateRows(booking),
    ["Guests", booking.guests ? guestCount(booking.guests) : "—"],
    ["Units", booking.quantity],
    ["Total", booking.to_be_agreed ? "To be agreed with the partner" : formatPeso(booking.total_cents)],
    ["Commission", formatPeso(booking.commission_cents)],
  ];
  if (booking.cancellation_policy) {
    rows.push(["Cancellation", CANCELLATION_POLICY[booking.cancellation_policy]?.name ?? booking.cancellation_policy]);
  }
  rows.push(["Booked", when(booking.created_at)]);
  if (booking.status === "requested" && booking.expires_at) rows.push(["Answer by", when(booking.expires_at)]);
  if (booking.responded_at) rows.push(["Answered", when(booking.responded_at)]);

  return (
    <Card className="h-full" data-testid="admin-booking">
      <CardBody className="flex h-full flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {booking.booking_type && <Badge tone="mist">{BOOKING_TYPES[booking.booking_type]}</Badge>}
          <BookingStatusBadge status={booking.status} small />
          <span className="ml-auto text-sm text-muted tabular-nums">{booking.reference}</span>
        </div>
        <div>
          <h2 className="text-lg font-semibold">{booking.listing.title}</h2>
          <p className="text-sm text-muted">{booking.listing.area}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Contact
            title="Partner"
            name={partner.business}
            lines={[partner.name, partner.email, partner.phone]}
            testId="admin-booking-partner"
          />
          <Contact
            title={traveller ? "Traveller" : "Guest (offline)"}
            name={traveller?.name ?? booking.guest_name}
            lines={traveller ? [traveller.email, traveller.phone] : []}
            testId="admin-booking-traveller"
          />
        </div>

        <dl className="grid grid-cols-[minmax(6.5rem,auto)_1fr] gap-x-4 gap-y-1 text-sm">
          {rows.map(([label, value]) => (
            <Fragment key={label}>
              <dt className="text-muted">{label}</dt>
              <dd>{value}</dd>
            </Fragment>
          ))}
        </dl>
        {booking.notes && <p className="text-sm whitespace-pre-line">“{booking.notes}”</p>}

        {booking.status === "requested" && (
          <div className="mt-auto flex flex-wrap gap-2 pt-2">
            <Button size="sm" variant="soft" onClick={onDecline} disabled={busy} data-testid="admin-booking-decline">
              Decline
            </Button>
            <Button size="sm" onClick={onAccept} disabled={busy} data-testid="admin-booking-accept">
              {busy ? "Accepting…" : "Accept"}
            </Button>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function Contact({
  title,
  name,
  lines,
  testId,
}: {
  title: string;
  name: string | null;
  lines: (string | null)[];
  testId: string;
}) {
  return (
    <div className="flex flex-col gap-0.5 text-sm" data-testid={testId}>
      <p className="text-small font-semibold text-muted">{title}</p>
      <p className="font-semibold">{name ?? "—"}</p>
      {lines.filter(Boolean).map((line) => (
        <p key={line} className="break-words">
          {line}
        </p>
      ))}
    </div>
  );
}

function DeclineDialog({
  booking,
  pending,
  error,
  onClose,
  onDecline,
}: {
  booking: AdminBooking;
  pending: boolean;
  error: string | undefined;
  onClose: () => void;
  onDecline: (reason: string | undefined) => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <Dialog
      open
      onClose={() => !pending && onClose()}
      title="Decline this request?"
      data-testid="admin-booking-decline-dialog"
      actions={
        <>
          <Button type="button" variant="soft" onClick={onClose} disabled={pending}>
            Keep it
          </Button>
          <Button
            type="button"
            variant="danger"
            disabled={pending}
            data-testid="admin-booking-decline-confirm"
            onClick={() => onDecline(reason.trim() || undefined)}
          >
            {pending ? "Declining…" : "Decline request"}
          </Button>
        </>
      }
    >
      <p className="text-sm">
        {booking.listing.title} for {booking.traveller?.name ?? booking.guest_name}, on behalf of{" "}
        {booking.partner.business}. Its dates are freed and the traveller isn&apos;t charged.
      </p>
      <TextareaField
        label="Reason (optional)"
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        maxLength={500}
        rows={2}
      />
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </Dialog>
  );
}
