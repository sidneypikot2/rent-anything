"use client";

import { useState } from "react";
import { BookingStatusBadge } from "@/components/bookings/booking-status";
import { CANCELLATION_POLICY } from "@/components/bookings/cancellation";
import { daysBetween, formatDateRange, guestCount } from "@/components/trips/format";
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
  return new Date(iso).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

// Every partner's booking requests (RAA-142): for launch the team answers them on partners'
// behalf. Requests come soonest to expire first; chips switch to other statuses. Each row says
// what is booked, for which partner, by whom and how to reach both, with Accept and Decline on
// a request. Partners can still answer their own, so an answer can come back already given.
// Dense on purpose: it is a work screen for the team, not a page for travellers.
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

  function rowProps(booking: AdminBooking): RowProps {
    return {
      booking,
      busy: answer.isPending && answer.variables?.id === booking.id,
      onAccept: () => answer.mutate({ id: booking.id, status: "accepted" }, { onSuccess: answered }),
      onDecline: () => {
        answer.reset();
        setDeclining(booking);
      },
    };
  }

  return (
    <main className="flex w-full flex-1 flex-col gap-4 py-5 sm:py-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <DisplayTitle size="compact">Booking requests</DisplayTitle>
        <p className="text-sm text-muted">Answered on the partner&apos;s behalf; unanswered requests expire.</p>
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
        <p role="alert" className="text-sm font-semibold text-danger" data-testid="admin-booking-error">
          {answer.error.message}
        </p>
      )}

      {bookings.isPending ? (
        <p className="text-sm text-muted">Loading bookings…</p>
      ) : bookings.error ? (
        <div className="flex flex-col items-start gap-3">
          <p role="alert" className="text-sm text-danger">
            {bookings.error.message}
          </p>
          <Button size="sm" variant="soft" onClick={() => void bookings.refetch()}>
            Try again
          </Button>
        </div>
      ) : bookings.data.length === 0 ? (
        <Card edge="line" data-testid="admin-bookings-empty">
          <CardBody>
            <p className="text-sm text-muted">
              {filter === "requested" ? "No requests waiting for an answer." : "No bookings here."}
            </p>
          </CardBody>
        </Card>
      ) : (
        <BookingTable bookings={bookings.data} rowProps={rowProps} />
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

// How long a stay or rental runs: a stay's ends_on is its check-out, so it counts nights; a
// rental counts its days, both ends in. Anything else takes one day.
function runLength(booking: AdminBooking) {
  const days = daysBetween(booking.starts_on, booking.ends_on);
  if (booking.booking_type === "stay") return `${days} ${days === 1 ? "night" : "nights"}`;
  if (booking.booking_type === "rental") return `${days + 1} ${days === 0 ? "day" : "days"}`;
  return null;
}

// What a row shows beyond its listing and people: the days by type, the party, the money and
// the time that matters now (when a request must be answered, else when it was).
function details(booking: AdminBooking) {
  const dates = formatDateRange(booking.starts_on, booking.ends_on) ?? booking.starts_on;
  const units = `${booking.quantity} ${booking.quantity === 1 ? "unit" : "units"}`;
  const party = [runLength(booking), booking.guests ? guestCount(booking.guests) : null, units].filter(Boolean).join(" · ");
  const total = booking.to_be_agreed ? "To be agreed" : formatPeso(booking.total_cents);
  const policy = booking.cancellation_policy ? CANCELLATION_POLICY[booking.cancellation_policy]?.name : undefined;
  const timing =
    booking.status === "requested" && booking.expires_at
      ? { label: "Answer by", at: booking.expires_at }
      : booking.responded_at
        ? { label: "Answered", at: booking.responded_at }
        : { label: "Booked", at: booking.created_at };
  return { dates, party, total, policy, timing };
}

type RowProps = { booking: AdminBooking; busy: boolean; onAccept: () => void; onDecline: () => void };

function Actions({ booking, busy, onAccept, onDecline }: RowProps) {
  if (booking.status !== "requested") return null;
  return (
    <div className="flex gap-1.5">
      <Button size="sm" onClick={onAccept} disabled={busy} data-testid="admin-booking-accept">
        {busy ? "Accepting…" : "Accept"}
      </Button>
      <Button size="sm" variant="soft" onClick={onDecline} disabled={busy} data-testid="admin-booking-decline">
        Decline
      </Button>
    </div>
  );
}

function partnerContact(booking: AdminBooking) {
  const { partner } = booking;
  return <Contact name={partner.business} lines={[partner.name, partner.phone, partner.email]} testId="admin-booking-partner" />;
}

function travellerContact(booking: AdminBooking) {
  const { traveller } = booking;
  return (
    <Contact
      name={traveller?.name ?? booking.guest_name}
      lines={traveller ? [traveller.phone, traveller.email] : ["Taken offline"]}
      testId="admin-booking-traveller"
    />
  );
}

function Contact({ name, lines, testId }: { name: string | null; lines: (string | null)[]; testId: string }) {
  return (
    <div className="flex min-w-0 flex-col" data-testid={testId}>
      <span className="truncate font-medium">{name ?? "—"}</span>
      {lines
        .filter((line): line is string => Boolean(line))
        .map((line) => (
          <span key={line} className="truncate text-xs text-muted" title={line}>
            {line}
          </span>
        ))}
    </div>
  );
}

const CELL = "px-3 py-2 align-top";

// One row per booking from xl, with every column the answer needs, and a compact list below it
// (the partner listings table's pattern).
function BookingTable({ bookings, rowProps }: { bookings: AdminBooking[]; rowProps: (booking: AdminBooking) => RowProps }) {
  return (
    <Card edge="line" data-testid="admin-bookings">
      <ul className="divide-y divide-line xl:hidden">
        {bookings.map((booking) => {
          const { dates, party, total, timing } = details(booking);
          return (
            <li key={booking.id} data-testid="admin-booking" className="flex flex-col gap-2 px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center gap-1.5">
                <BookingStatusBadge status={booking.status} small />
                {booking.booking_type && (
                  <span className="text-xs font-semibold text-muted">{BOOKING_TYPES[booking.booking_type]}</span>
                )}
                <span className="ml-auto text-xs text-muted tabular-nums">{booking.reference}</span>
              </div>
              <p className="font-semibold">
                {booking.listing.title} <span className="font-normal text-muted">· {booking.listing.area}</span>
              </p>
              <p className="text-muted">
                {dates} · {party} · <span className="font-medium text-foreground">{total}</span>
              </p>
              <div className="grid grid-cols-2 gap-3">
                {partnerContact(booking)}
                {travellerContact(booking)}
              </div>
              {booking.notes && <p className="text-xs text-muted italic">“{booking.notes}”</p>}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-muted">
                  {timing.label} {when(timing.at)}
                </span>
                <Actions {...rowProps(booking)} />
              </div>
            </li>
          );
        })}
      </ul>
      <table className="hidden w-full table-fixed text-left text-sm xl:table">
        <colgroup>
          <col className="w-32" />
          <col />
          <col className="w-48" />
          <col className="w-44" />
          <col className="w-36" />
          <col className="w-28" />
          <col className="w-32" />
          <col className="w-52" />
        </colgroup>
        <thead className="border-b border-line bg-surface-2 text-xs text-muted">
          <tr>
            <th scope="col" className="px-3 py-2 font-semibold">Booking</th>
            <th scope="col" className="px-3 py-2 font-semibold">Listing</th>
            <th scope="col" className="px-3 py-2 font-semibold">Partner</th>
            <th scope="col" className="px-3 py-2 font-semibold">Traveller</th>
            <th scope="col" className="px-3 py-2 font-semibold">Dates</th>
            <th scope="col" className="px-3 py-2 font-semibold">Total</th>
            <th scope="col" className="px-3 py-2 font-semibold">When</th>
            <th scope="col" className="px-3 py-2 font-semibold">
              <span className="sr-only">Answer</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {bookings.map((booking) => {
            const { dates, party, total, policy, timing } = details(booking);
            return (
              <tr
                key={booking.id}
                data-testid="admin-booking"
                className="border-b border-line transition-colors duration-300 ease-calm last:border-0 hover:bg-surface-2"
              >
                <td className={CELL}>
                  <div className="flex flex-col items-start gap-1 whitespace-nowrap">
                    <BookingStatusBadge status={booking.status} small />
                    <span className="text-xs text-muted tabular-nums">{booking.reference}</span>
                  </div>
                </td>
                <td className={CELL}>
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-medium" title={booking.listing.title}>
                      {booking.listing.title}
                    </span>
                    <span className="truncate text-xs text-muted">
                      {[booking.booking_type && BOOKING_TYPES[booking.booking_type], booking.listing.area]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                    {booking.notes && (
                      <span className="truncate text-xs text-muted italic" title={booking.notes}>
                        “{booking.notes}”
                      </span>
                    )}
                  </div>
                </td>
                <td className={CELL}>{partnerContact(booking)}</td>
                <td className={CELL}>{travellerContact(booking)}</td>
                <td className={CELL}>
                  <div className="flex flex-col">
                    <span>{dates}</span>
                    <span className="text-xs text-muted">{party}</span>
                  </div>
                </td>
                <td className={CELL}>
                  <div className="flex min-w-0 flex-col tabular-nums">
                    <span className="font-medium">{total}</span>
                    <span className="text-xs text-muted">{formatPeso(booking.commission_cents)} fee</span>
                    {policy && <span className="truncate text-xs text-muted">{policy}</span>}
                  </div>
                </td>
                <td className={CELL}>
                  <div className="flex flex-col text-xs">
                    <span className="text-muted">{timing.label}</span>
                    <span>{when(timing.at)}</span>
                  </div>
                </td>
                <td className={CELL}>
                  <Actions {...rowProps(booking)} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
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
