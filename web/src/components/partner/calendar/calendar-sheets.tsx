"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Pill } from "@/components/ui/pill";
import { SelectField } from "@/components/ui/select-field";
import { StepperField } from "@/components/ui/stepper-field";
import { TextareaField } from "@/components/ui/textarea-field";
import { formatDateRange } from "@/lib/dates";
import { formatPeso, toCents } from "@/lib/money";
import {
  useAddBooking,
  useAnswerRequest,
  useCancelBooking,
  useRemoveBlock,
  useSaveBlock,
  useSetCalendarDays,
  type CalendarBlock,
  type CalendarBooking,
  type CalendarDaysBody,
  type CalendarListing,
} from "../use-partner-calendar";
import { BOOKING_STATUS } from "@/components/bookings/booking-status";
import { roomSplit } from "@/components/bookings/room-split";
import { addDays, bookingSpan, daysBetween, rentalTime, shortDate } from "./calendar-dates";
import type { Selection } from "./calendar-grid";
import { deliveryText } from "@/components/trips/delivery-options";

type Done = (message: string) => void;

const isStay = (listing: CalendarListing) => listing.category.booking_type === "stay";
const isJoiner = (listing: CalendarListing) => listing.capacity_unit === "seats";
// A vehicle rental (RAA-195), the one kind with a turnaround: its selected days are rental days,
// each 24 hours from the pickup, so it comes back on the day after the last one.
const isRental = (listing: CalendarListing) => listing.turnaround_minutes !== null;

// Every half hour of the day, for an offline rental's pickup: "09:00" shown as "9:00 AM".
const PICKUP_TIMES = Array.from({ length: 48 }, (_, index) => {
  const hour = Math.floor(index / 2);
  const value = `${String(hour).padStart(2, "0")}:${index % 2 ? "30" : "00"}`;
  return { value, label: `${hour % 12 === 0 ? 12 : hour % 12}:${index % 2 ? "30" : "00"} ${hour < 12 ? "AM" : "PM"}` };
});

// What a booking's quantity counts, for labels: "joiners", "groups", "units".
function quantityNoun(listing: CalendarListing, count = 2) {
  const one = { seats: "joiner", groups: "group", units: "unit" }[listing.capacity_unit];
  return count === 1 ? one : `${one}s`;
}

type Mode = "book" | "block" | "price" | "units" | "min";

// What a partner can do with the days they selected (RAA-120): take a booking (a stay's
// last selected night is the night before check-out), block them, or set their price, units
// on sale or a stay's minimum nights. The server checks every rule and says what's wrong.
export function DayActionsSheet({ selection, onClose, onDone }: { selection: Selection; onClose: () => void; onDone: Done }) {
  const { listing, from, to } = selection;
  const [mode, setMode] = useState<Mode>("book");
  // Whether the partner has typed into the open form: closing then asks first. Another mode
  // starts a fresh form, so it starts clean.
  const [typed, setTyped] = useState(false);
  const days = listing.days.filter((day) => day.date >= from && day.date <= to);
  const count = days.length;
  const stay = isStay(listing);

  const modes: [Mode, string][] = [
    ["book", isJoiner(listing) ? "Add joiners" : "Offline booking"],
    ["block", "Block"],
    ["price", "Price"],
    ["units", isJoiner(listing) ? "Seats on sale" : "Units on sale"],
    ...(stay ? ([["min", "Minimum stay"]] as [Mode, string][]) : []),
  ];

  const summary =
    stay && mode === "book"
      ? `Check-in ${shortDate(from)} · Check-out ${shortDate(addDays(to, 1))} · ${count} ${count === 1 ? "night" : "nights"}`
      : `${formatDateRange(from, to)} · ${count} ${count === 1 ? "day" : "days"}`;

  return (
    <Dialog open onClose={onClose} dirty={typed} placement="sheet" title={listing.title} data-testid="day-actions-sheet">
      <p className="-mt-2 text-sm text-muted" data-testid="day-actions-dates">
        {summary}
      </p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="What to do">
        {modes.map(([value, label]) => (
          <Pill key={value} on={mode === value} onClick={() => {
              setMode(value);
              setTyped(false);
            }}
            data-testid={`day-action-${value}`}
          >
            {label}
          </Pill>
        ))}
      </div>
      <div className="contents" onInput={() => setTyped(true)}>
        {mode === "book" && <BookingForm selection={selection} onClose={onClose} onDone={onDone} />}
        {mode === "block" && <BlockForm selection={selection} onClose={onClose} onDone={onDone} />}
        {(mode === "price" || mode === "units" || mode === "min") && (
          <DaysForm key={mode} mode={mode} selection={selection} onClose={onClose} onDone={onDone} />
        )}
      </div>
    </Dialog>
  );
}

function SheetForm({
  onSubmit,
  pending,
  error,
  onClose,
  saveLabel = "Save",
  extra,
  children,
}: {
  onSubmit: () => void;
  pending: boolean;
  error: Error | null;
  onClose: () => void;
  saveLabel?: string;
  extra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <form
      onSubmit={(event: FormEvent) => {
        event.preventDefault();
        onSubmit();
      }}
      className="flex flex-col gap-4"
    >
      <fieldset disabled={pending} className="flex flex-col gap-3">
        {children}
      </fieldset>
      {error && (
        <p role="alert" data-testid="calendar-sheet-error" className="text-sm font-medium text-danger">
          {error.message}
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-3">
        {extra}
        <Button type="button" variant="soft" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending} data-testid="calendar-sheet-save">
          {pending ? "Saving…" : saveLabel}
        </Button>
      </div>
    </form>
  );
}

function BookingForm({ selection, onClose, onDone }: { selection: Selection; onClose: () => void; onDone: Done }) {
  const { listing, from, to } = selection;
  const add = useAddBooking();
  const [guest, setGuest] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [total, setTotal] = useState("");
  const [notes, setNotes] = useState("");
  const [pickupTime, setPickupTime] = useState("09:00");
  const [totalError, setTotalError] = useState<string>();
  const rental = isRental(listing);
  const most = Math.min(listing.capacity, 100);

  function submit() {
    const cents = toCents(total);
    if (cents === null) return setTotalError("Enter an amount in pesos, like 1500.");
    add.mutate(
      {
        listingId: listing.id,
        body: {
          guest_name: guest.trim(),
          starts_on: from,
          ends_on: isStay(listing) || rental ? addDays(to, 1) : to,
          ...(rental ? { pickup_time: pickupTime } : {}),
          quantity,
          total_cents: cents,
          notes: notes.trim(),
        },
      },
      {
        onSuccess: () => {
          if (!isJoiner(listing)) return onDone("Booking added.");
          const left = Math.min(...listing.days.filter((day) => day.date >= from && day.date <= to).map((day) => day.units_left));
          const added = `${quantity} ${quantityNoun(listing, quantity)} added.`;
          onDone(quantity >= left ? `${added} The tour is now full.` : `${added} The day stays open until it's full.`);
        },
      },
    );
  }

  return (
    <SheetForm onSubmit={submit} pending={add.isPending} error={add.error} onClose={onClose} saveLabel="Add booking">
      <Field
        label="Guest name"
        value={guest}
        maxLength={80}
        required
        autoComplete="off"
        onChange={(event) => setGuest(event.target.value)}
        data-testid="booking-guest"
      />
      {rental && (
        <SelectField
          label="Pickup time"
          options={PICKUP_TIMES}
          value={pickupTime}
          onChange={(event) => setPickupTime(event.target.value)}
          hint={`Due back ${shortDate(addDays(to, 1))} at the same time.`}
          data-testid="booking-pickup-time"
        />
      )}
      <StepperField
        label={`How many ${quantityNoun(listing)}`}
        value={quantity}
        min={1}
        max={most}
        onChange={setQuantity}
        data-testid="booking-quantity"
      />
      <Field
        label="Total the guest paid you (₱)"
        inputMode="decimal"
        value={total}
        required
        error={totalError}
        onChange={(event) => {
          setTotal(event.target.value);
          setTotalError(undefined);
        }}
        data-testid="booking-total"
      />
      <TextareaField label="Notes" rows={2} maxLength={500} value={notes} onChange={(event) => setNotes(event.target.value)} />
    </SheetForm>
  );
}

function BlockForm({ selection, onClose, onDone }: { selection: Selection; onClose: () => void; onDone: Done }) {
  const { listing, from, to } = selection;
  const save = useSaveBlock();
  const [reason, setReason] = useState("");

  function submit() {
    save.mutate(
      { listingId: listing.id, body: { starts_on: from, ends_on: to, reason: reason.trim() || null } },
      { onSuccess: () => onDone("Dates blocked.") },
    );
  }

  return (
    <SheetForm onSubmit={submit} pending={save.isPending} error={save.error} onClose={onClose} saveLabel="Block dates">
      <Field
        label="Reason (only you see it)"
        value={reason}
        maxLength={120}
        placeholder="Repainting"
        hint={
          isJoiner(listing)
            ? "Blocking closes these days to new joiners. Joiners already booked keep their seats."
            : "Bookings already on these days stay; only new ones are refused."
        }
        onChange={(event) => setReason(event.target.value)}
        data-testid="block-reason"
      />
    </SheetForm>
  );
}

const PRICE_UNITS = { night: "night", group: "group", person: "joiner", day: "day", trip: "trip" } as const;

function DaysForm({
  mode,
  selection,
  onClose,
  onDone,
}: {
  mode: "price" | "units" | "min";
  selection: Selection;
  onClose: () => void;
  onDone: Done;
}) {
  const { listing, from, to } = selection;
  const first = listing.days.find((day) => day.date === from);
  const set = useSetCalendarDays();
  const [price, setPrice] = useState("");
  const [priceError, setPriceError] = useState<string>();
  const [units, setUnits] = useState(first?.units_available ?? listing.capacity);
  const [nights, setNights] = useState(first?.min_nights ?? 1);
  const field = { price: "price_cents", units: "units_available", min: "min_nights" } as const;

  function send(value: number | null, message: string) {
    const body: CalendarDaysBody = { starts_on: from, ends_on: to, [field[mode]]: value };
    set.mutate({ listingId: listing.id, body }, { onSuccess: () => onDone(message) });
  }

  function submit() {
    if (mode === "price") {
      const cents = toCents(price);
      if (!cents) return setPriceError("Enter a price in pesos, like 1500.");
      return send(cents, "Price set.");
    }
    if (mode === "units") return send(units, isJoiner(listing) ? "Seats on sale set." : "Units on sale set.");
    send(nights, "Minimum stay set.");
  }

  const reset = (
    <Button type="button" variant="ghost" onClick={() => send(null, "Back to the listing's own.")} data-testid="calendar-days-reset">
      {mode === "price" ? "Use listing price" : "Reset"}
    </Button>
  );

  return (
    <SheetForm onSubmit={submit} pending={set.isPending} error={set.error} onClose={onClose} extra={reset}>
      {mode === "price" && (
        <Field
          label={`Price per ${listing.price_unit ? PRICE_UNITS[listing.price_unit] : "day"} (₱)`}
          inputMode="decimal"
          value={price}
          required
          error={priceError}
          onChange={(event) => {
            setPrice(event.target.value);
            setPriceError(undefined);
          }}
          data-testid="calendar-price"
        />
      )}
      {mode === "units" && (
        <StepperField
          label={isJoiner(listing) ? "Seats on sale each day" : "Units on sale each day"}
          hint={`Up to ${listing.capacity}, and never below what's already booked.`}
          value={units}
          min={0}
          max={listing.capacity}
          onChange={setUnits}
          data-testid="calendar-units"
        />
      )}
      {mode === "min" && (
        <StepperField
          label="Minimum nights"
          hint="For guests checking in on these days."
          value={nights}
          min={1}
          max={365}
          onChange={setNights}
          data-testid="calendar-min-nights"
        />
      )}
    </SheetForm>
  );
}

// A confirmation for something that can't be undone from here.
function Confirm({
  title,
  body,
  action,
  pending,
  error,
  onConfirm,
  onClose,
}: {
  title: string;
  body: string;
  action: string;
  pending: boolean;
  error: Error | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog
      open
      onClose={onClose}
      title={title}
      data-testid="calendar-confirm"
      actions={
        <>
          <Button variant="soft" onClick={onClose}>
            Keep it
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={pending} data-testid="calendar-confirm-yes">
            {pending ? "Working…" : action}
          </Button>
        </>
      }
    >
      <p className="text-sm text-muted">{body}</p>
      {error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {error.message}
        </p>
      )}
    </Dialog>
  );
}

function bookingDates(listing: CalendarListing, booking: CalendarBooking) {
  if (booking.starts_at && booking.ends_at) {
    return `Pickup ${shortDate(booking.starts_on)}, ${rentalTime(booking.starts_at)} · Back ${shortDate(addDays(booking.starts_on, Math.max(daysBetween(booking.starts_on, booking.ends_on), 1)))}, ${rentalTime(booking.ends_at)}`;
  }
  if (!isStay(listing)) return formatDateRange(booking.starts_on, booking.ends_on);
  const nights = bookingSpan(true, booking.starts_on, booking.ends_on).count;
  return `Check-in ${shortDate(booking.starts_on)} · Check-out ${shortDate(booking.ends_on)} · ${nights} ${nights === 1 ? "night" : "nights"}`;
}

export function BookingSheet({
  listing,
  booking,
  today,
  onClose,
  onDone,
}: {
  listing: CalendarListing;
  booking: CalendarBooking;
  today: string;
  onClose: () => void;
  onDone: Done;
}) {
  const cancel = useCancelBooking();
  const answer = useAnswerRequest();
  const [confirming, setConfirming] = useState(false);
  const request = booking.status === "requested";
  const cancellable = booking.ends_on >= today && ["requested", "accepted", "awaiting_payment", "confirmed"].includes(booking.status);
  const rooms = roomSplit(booking);
  const facts: [string, string][] = [
    ["Status", BOOKING_STATUS[booking.status].label],
    ["Reference", booking.reference],
    ["Listing", listing.title],
    ["Dates", bookingDates(listing, booking) ?? ""],
    [capitalize(quantityNoun(listing)), String(booking.quantity)],
    ...(booking.guests ? [["Guests", String(booking.guests)] as [string, string]] : []),
    ...(rooms ? [["Rooms and pets", rooms] as [string, string]] : []),
    ...(deliveryText(booking, Boolean(booking.starts_at)) ? [["Delivery", deliveryText(booking, Boolean(booking.starts_at)) ?? ""] as [string, string]] : []),
    ["Total", booking.to_be_agreed ? "To be agreed with the guest" : formatPeso(booking.total_cents)],
    ...(booking.source === "checkout" && !booking.to_be_agreed
      ? [["Commission", formatPeso(booking.commission_cents)] as [string, string]]
      : []),
    ["Taken", booking.source === "offline" ? "Offline, by you" : booking.booking_mode === "instant" ? "In the app, instant book" : "In the app, on request"],
    ...(request && booking.expires_at
      ? [["Answer by", new Date(booking.expires_at).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })] as [string, string]]
      : []),
  ];
  const refunds = booking.source === "checkout" && booking.status === "confirmed";

  return (
    <Dialog
      open
      onClose={onClose}
      placement="sheet"
      title={booking.guest_name}
      data-testid="booking-sheet"
      actions={
        <>
          <Button variant="soft" onClick={onClose}>
            Close
          </Button>
          {request ? (
            <>
              <Button
                variant="danger"
                disabled={answer.isPending}
                onClick={() =>
                  answer.mutate({ listingId: listing.id, id: booking.id, status: "declined" }, { onSuccess: () => onDone("Request declined.") })
                }
                data-testid="booking-decline"
              >
                Decline
              </Button>
              <Button
                disabled={answer.isPending}
                onClick={() =>
                  answer.mutate({ listingId: listing.id, id: booking.id, status: "accepted" }, { onSuccess: () => onDone("Request accepted.") })
                }
                data-testid="booking-accept"
              >
                {answer.isPending ? "Saving…" : "Accept"}
              </Button>
            </>
          ) : (
            cancellable && (
              <Button variant="danger" onClick={() => setConfirming(true)} data-testid="booking-cancel">
                Cancel booking
              </Button>
            )
          )}
        </>
      }
    >
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        {facts.map(([term, value]) => (
          <Fact key={term} term={term} value={value} />
        ))}
        {booking.notes && <Fact term="Notes" value={booking.notes} />}
      </dl>
      {answer.error && (
        <p role="alert" className="text-sm text-danger">
          {answer.error.message}
        </p>
      )}
      {confirming && (
        <Confirm
          title="Cancel this booking?"
          body={`${booking.guest_name}'s ${quantityNoun(listing, booking.quantity)} ${booking.quantity === 1 ? "goes" : "go"} back on sale.${refunds ? " They are refunded in full." : ""} This can't be undone.`}
          action="Cancel booking"
          pending={cancel.isPending}
          error={cancel.error}
          onClose={() => setConfirming(false)}
          onConfirm={() =>
            cancel.mutate({ listingId: listing.id, id: booking.id }, { onSuccess: () => onDone("Booking cancelled.") })
          }
        />
      )}
    </Dialog>
  );
}

function Fact({ term, value }: { term: string; value: string }) {
  return (
    <>
      <dt className="text-muted">{term}</dt>
      <dd className="font-medium">{value}</dd>
    </>
  );
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function BlockSheet({
  listing,
  block,
  onClose,
  onDone,
}: {
  listing: CalendarListing;
  block: CalendarBlock;
  onClose: () => void;
  onDone: Done;
}) {
  const save = useSaveBlock();
  const remove = useRemoveBlock();
  const [reason, setReason] = useState(block.reason ?? "");
  const [confirming, setConfirming] = useState(false);
  const days = daysBetween(block.starts_on, block.ends_on) + 1;

  function submit() {
    save.mutate(
      {
        listingId: listing.id,
        id: block.id,
        body: { starts_on: block.starts_on, ends_on: block.ends_on, reason: reason.trim() || null },
      },
      { onSuccess: () => onDone("Reason saved.") },
    );
  }

  const unblock = (
    <Button type="button" variant="ghost" onClick={() => setConfirming(true)} data-testid="block-remove">
      Unblock
    </Button>
  );

  return (
    <Dialog open onClose={onClose} dirty={reason !== (block.reason ?? "")} placement="sheet" title="Blocked" data-testid="block-sheet">
      <p className="-mt-2 text-sm text-muted">
        {listing.title} · {formatDateRange(block.starts_on, block.ends_on)} · {days} {days === 1 ? "day" : "days"}
      </p>
      <SheetForm onSubmit={submit} pending={save.isPending} error={save.error} onClose={onClose} extra={unblock}>
        <Field
          label="Reason (only you see it)"
          value={reason}
          maxLength={120}
          onChange={(event) => setReason(event.target.value)}
          data-testid="block-reason"
        />
      </SheetForm>
      {confirming && (
        <Confirm
          title="Unblock these days?"
          body="They go back on sale straight away."
          action="Unblock"
          pending={remove.isPending}
          error={remove.error}
          onClose={() => setConfirming(false)}
          onConfirm={() =>
            remove.mutate({ listingId: listing.id, id: block.id }, { onSuccess: () => onDone("Dates unblocked.") })
          }
        />
      )}
    </Dialog>
  );
}

// Who joined a joiner tour on one day, and how many seats are left: the day stays open for
// more joiners until it's full.
export function JoinerDaySheet({
  listing,
  date,
  today,
  onClose,
  onDone,
  onAdd,
}: {
  listing: CalendarListing;
  date: string;
  today: string;
  onClose: () => void;
  onDone: Done;
  onAdd: () => void;
}) {
  const day = listing.days.find((item) => item.date === date);
  const joiners = listing.bookings.filter((booking) => booking.starts_on <= date && date <= booking.ends_on);
  const cancel = useCancelBooking();
  const [cancelling, setCancelling] = useState<CalendarBooking | null>(null);
  const open = date >= today && day !== undefined && day.block_id === null && day.units_left > 0;

  return (
    <Dialog
      open
      onClose={onClose}
      placement="sheet"
      title={`${listing.title} · ${shortDate(date)}`}
      data-testid="joiner-day-sheet"
      actions={
        <>
          <Button variant="soft" onClick={onClose}>
            Close
          </Button>
          {open && (
            <Button onClick={onAdd} data-testid="joiner-day-add">
              Add joiners
            </Button>
          )}
        </>
      }
    >
      {day && (
        <p className="-mt-2 text-sm text-muted">
          {day.booked} of {day.units_available} seats taken ·{" "}
          {day.units_left === 0 ? "full" : `${day.units_left} left, still open to joiners`}
        </p>
      )}
      <ul className="flex flex-col divide-y divide-line">
        {joiners.map((booking) => (
          <li key={booking.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
            <span>
              <span className="font-semibold">{booking.guest_name}</span> · {booking.quantity}{" "}
              {quantityNoun(listing, booking.quantity)} · {formatPeso(booking.total_cents)}
              <span className="text-muted"> · {booking.source === "offline" ? "Offline" : "In the app"}</span>
            </span>
            {booking.ends_on >= today && (
              <Button size="sm" variant="ghost" onClick={() => setCancelling(booking)}>
                Cancel
              </Button>
            )}
          </li>
        ))}
      </ul>
      {cancelling && (
        <Confirm
          title={`Cancel ${cancelling.guest_name}'s booking?`}
          body={`Their ${cancelling.quantity} ${quantityNoun(listing, cancelling.quantity)} go back on sale. This can't be undone.`}
          action="Cancel booking"
          pending={cancel.isPending}
          error={cancel.error}
          onClose={() => setCancelling(null)}
          onConfirm={() =>
            cancel.mutate(
              { listingId: listing.id, id: cancelling.id },
              {
                onSuccess: () => {
                  setCancelling(null);
                  onDone("Booking cancelled.");
                },
              },
            )
          }
        />
      )}
    </Dialog>
  );
}
