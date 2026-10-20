"use client";

import { useState, type ReactNode } from "react";
import { BookingStatusBadge } from "@/components/bookings/booking-status";
import { CANCELLATION_POLICY } from "@/components/bookings/cancellation";
import { daysBetween, formatDateRange, guestCount } from "@/components/trips/format";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
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
// behalf. Requests come soonest to expire first; chips switch to other statuses. A row says
// what is booked, for which partner, by whom and when, with Accept and Decline on a request;
// clicking it opens the complete details (contacts, money, notes) in a side panel. Partners can
// still answer their own, so an answer can come back already given.
// Dense on purpose: it is a work screen for the team, not a page for travellers.
export function BookingRequests() {
  const [filter, setFilter] = useState<AdminBookingFilter>("requested");
  const [viewing, setViewing] = useState<AdminBooking | null>(null);
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
    setViewing(null);
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

  function open(booking: AdminBooking) {
    answer.reset();
    setViewing(booking);
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

      {answer.error && !declining && !viewing && (
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
        <BookingTable bookings={bookings.data} rowProps={rowProps} onOpen={open} />
      )}

      {viewing && (
        <BookingPanel
          {...rowProps(viewing)}
          error={declining ? undefined : answer.error?.message}
          onClose={() => setViewing(null)}
        />
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

// What a booking shows beyond its listing and people: the days by type, the party, the money
// and the time that matters now (when a request must be answered, else when it was).
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

function kindAndArea(booking: AdminBooking) {
  return [booking.booking_type && BOOKING_TYPES[booking.booking_type], booking.listing.area].filter(Boolean).join(" · ");
}

function travellerName(booking: AdminBooking) {
  return booking.traveller?.name ?? booking.guest_name;
}

type RowProps = { booking: AdminBooking; busy: boolean; onAccept: () => void; onDecline: () => void };

// The answer buttons: a click on them answers, and doesn't also open the row's panel.
function Actions({ booking, busy, onAccept, onDecline }: RowProps) {
  if (booking.status !== "requested") return null;
  return (
    <div className="flex gap-1.5" onClick={(event) => event.stopPropagation()}>
      <Button size="sm" onClick={onAccept} disabled={busy} data-testid="admin-booking-accept">
        {busy ? "Accepting…" : "Accept"}
      </Button>
      <Button size="sm" variant="soft" onClick={onDecline} disabled={busy} data-testid="admin-booking-decline">
        Decline
      </Button>
    </div>
  );
}

// A row's title, a button so the keyboard can open its panel too; a click anywhere on the row
// does the same.
function OpenButton({ booking, onOpen }: { booking: AdminBooking; onOpen: (booking: AdminBooking) => void }) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onOpen(booking);
      }}
      title={booking.listing.title}
      className="max-w-full min-w-0 truncate text-left font-medium hover:underline focus-visible:underline focus-visible:outline-none"
      data-testid="admin-booking-open"
    >
      {booking.listing.title}
    </button>
  );
}

const CELL = "px-3 py-2 align-middle";
const ROW = "cursor-pointer transition-colors duration-300 ease-calm hover:bg-surface-2";

// One line per booking from xl, a short list below it (the partner listings table's pattern):
// only what picks a request out; the rest is in its panel.
function BookingTable({
  bookings,
  rowProps,
  onOpen,
}: {
  bookings: AdminBooking[];
  rowProps: (booking: AdminBooking) => RowProps;
  onOpen: (booking: AdminBooking) => void;
}) {
  return (
    <Card edge="line" data-testid="admin-bookings">
      <ul className="divide-y divide-line xl:hidden">
        {bookings.map((booking) => {
          const { dates, total, timing } = details(booking);
          return (
            <li
              key={booking.id}
              data-testid="admin-booking"
              onClick={() => onOpen(booking)}
              className={cn(ROW, "flex flex-col gap-1 px-4 py-2.5 text-sm")}
            >
              <div className="flex items-center gap-2">
                <BookingStatusBadge status={booking.status} small />
                <span className="flex min-w-0 flex-1">
                  <OpenButton booking={booking} onOpen={onOpen} />
                </span>
                <span className="shrink-0 font-medium tabular-nums">{total}</span>
              </div>
              <p className="truncate text-xs text-muted">
                {booking.partner.business} · {travellerName(booking)} · {dates}
              </p>
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
          <col className="w-44" />
          <col className="w-36" />
          <col className="w-32" />
          <col className="w-24" />
          <col className="w-36" />
          <col className="w-48" />
        </colgroup>
        <thead className="border-b border-line bg-surface-2 text-xs text-muted">
          <tr>
            <th scope="col" className="px-3 py-2 font-semibold">Status</th>
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
            const { dates, total, timing } = details(booking);
            return (
              <tr
                key={booking.id}
                data-testid="admin-booking"
                onClick={() => onOpen(booking)}
                className={cn(ROW, "border-b border-line last:border-0")}
              >
                <td className={CELL}>
                  <span className="whitespace-nowrap"><BookingStatusBadge status={booking.status} small /></span>
                </td>
                <td className={CELL}>
                  <div className="flex min-w-0 items-baseline gap-2">
                    <OpenButton booking={booking} onOpen={onOpen} />
                    <span className="min-w-0 flex-1 basis-0 truncate text-xs text-muted">{kindAndArea(booking)}</span>
                  </div>
                </td>
                <td className={cn(CELL, "truncate")} title={booking.partner.business}>
                  {booking.partner.business}
                </td>
                <td className={cn(CELL, "truncate")}>{travellerName(booking) ?? "—"}</td>
                <td className={cn(CELL, "truncate")}>{dates}</td>
                <td className={cn(CELL, "font-medium tabular-nums")}>{total}</td>
                <td className={cn(CELL, "truncate text-xs")}>
                  <span title={timing.label}>{booking.status === "requested" ? `By ${when(timing.at)}` : when(timing.at)}</span>
                </td>
                <td className={cn(CELL, "py-1.5")}>
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

function Phone({ number }: { number: string | null }) {
  return number ? (
    <a href={`tel:${number}`} className="text-link hover:underline">
      {number}
    </a>
  ) : null;
}

function Email({ address }: { address: string }) {
  return (
    <a href={`mailto:${address}`} className="text-link hover:underline">
      {address}
    </a>
  );
}

// A booking's complete details in a centred overlay: what is booked, the money, both people
// with how to reach them, the notes and its times, with Accept and Decline pinned at the foot
// while it is a request. Booking and Money, then Partner and Traveller, side by side from sm.
function BookingPanel({ error, onClose, ...row }: RowProps & { error: string | undefined; onClose: () => void }) {
  const { booking } = row;
  const { dates, party, total, policy, timing } = details(booking);
  const { partner, traveller } = booking;
  return (
    <Dialog
      open
      placement="overlay"
      onClose={onClose}
      title={booking.listing.title}
      data-testid="admin-booking-panel"
      actions={
        booking.status === "requested" ? (
          <>
            <span className="text-xs text-muted">
              {timing.label} {when(timing.at)}
            </span>
            <Actions {...row} />
          </>
        ) : undefined
      }
    >
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <BookingStatusBadge status={booking.status} small />
        <span className="text-muted">{kindAndArea(booking)}</span>
        <span className="ml-auto text-xs text-muted tabular-nums">{booking.reference}</span>
      </div>

      <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
        <PanelSection title="Booking">
          <Row label="Dates">{dates}</Row>
          <Row label="Party">{party}</Row>
          <Row label="How">
            {booking.source === "offline"
              ? "Taken offline"
              : booking.booking_mode === "instant"
                ? "Instant book"
                : "Request to book"}
          </Row>
          {policy && <Row label="Cancellation">{policy}</Row>}
        </PanelSection>

        <PanelSection title="Money">
          <Row label="Total">{total}</Row>
          <Row label="Platform fee">{formatPeso(booking.commission_cents)}</Row>
          {booking.refund_cents != null && <Row label="Refund">{formatPeso(booking.refund_cents)}</Row>}
        </PanelSection>

        <PanelSection title="Partner" testId="admin-booking-partner">
          <Row label="Business">{partner.business}</Row>
          <Row label="Name">{partner.name}</Row>
          <Row label="Phone">
            <Phone number={partner.phone} />
          </Row>
          <Row label="Email">
            <Email address={partner.email} />
          </Row>
        </PanelSection>

        <PanelSection title="Traveller" testId="admin-booking-traveller">
          <Row label="Name">{travellerName(booking)}</Row>
          {traveller ? (
            <>
              <Row label="Phone">
                <Phone number={traveller.phone} />
              </Row>
              <Row label="Email">
                <Email address={traveller.email} />
              </Row>
            </>
          ) : (
            <Row label="Contact">Taken offline</Row>
          )}
        </PanelSection>
      </div>

      {booking.notes && (
        <PanelSection title="Notes">
          <p className="text-sm whitespace-pre-line">{booking.notes}</p>
        </PanelSection>
      )}

      <PanelSection title="Times">
        <Row label="Booked">{when(booking.created_at)}</Row>
        {booking.status === "requested" && booking.expires_at && <Row label="Answer by">{when(booking.expires_at)}</Row>}
        {booking.responded_at && <Row label="Answered">{when(booking.responded_at)}</Row>}
      </PanelSection>

      {error && (
        <p role="alert" className="text-sm font-semibold text-danger" data-testid="admin-booking-error">
          {error}
        </p>
      )}
    </Dialog>
  );
}

function PanelSection({ title, testId, children }: { title: string; testId?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5 border-t border-line pt-3" data-testid={testId}>
      <h3 className="text-xs font-semibold text-muted">{title}</h3>
      <dl className="flex flex-col gap-1 text-sm">{children}</dl>
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 break-words">{children || "—"}</dd>
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
        <p role="alert" className="text-sm font-semibold text-danger">
          {error}
        </p>
      )}
    </Dialog>
  );
}
