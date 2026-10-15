"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Pill } from "@/components/ui/pill";
import { StepperField } from "@/components/ui/stepper-field";
import { TextareaField } from "@/components/ui/textarea-field";
import { formatDateRange } from "@/lib/dates";
import { formatPeso, toCents } from "@/lib/money";
import {
  useAddBooking,
  useCancelBooking,
  useRemoveBlock,
  useSaveBlock,
  useSetCalendarDays,
  type CalendarBlock,
  type CalendarBooking,
  type CalendarDaysBody,
  type CalendarListing,
} from "../use-partner-calendar";
import { addDays, bookingSpan, daysBetween, shortDate } from "./calendar-dates";
import type { Selection } from "./calendar-grid";

type Done = (message: string) => void;

const isStay = (listing: CalendarListing) => listing.category.booking_type === "stay";
const isJoiner = (listing: CalendarListing) => listing.capacity_unit === "seats";

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
    <Dialog open onClose={onClose} placement="sheet" title={listing.title} data-testid="day-actions-sheet">
      <p className="-mt-2 text-sm text-muted" data-testid="day-actions-dates">
        {summary}
      </p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="What to do">
        {modes.map(([value, label]) => (
          <Pill key={value} on={mode === value} onClick={() => setMode(value)} data-testid={`day-action-${value}`}>
            {label}
          </Pill>
        ))}
      </div>
      {mode === "book" && <BookingForm selection={selection} onClose={onClose} onDone={onDone} />}
      {mode === "block" && <BlockForm selection={selection} onClose={onClose} onDone={onDone} />}
      {(mode === "price" || mode === "units" || mode === "min") && (
        <DaysForm key={mode} mode={mode} selection={selection} onClose={onClose} onDone={onDone} />
      )}
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
  const [totalError, setTotalError] = useState<string>();
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
          ends_on: isStay(listing) ? addDays(to, 1) : to,
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

const PRICE_UNITS = { night: "night", group: "group", person: "joiner" } as const;

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
  const [confirming, setConfirming] = useState(false);
  const facts: [string, string][] = [
    ["Listing", listing.title],
    ["Dates", bookingDates(listing, booking) ?? ""],
    [capitalize(quantityNoun(listing)), String(booking.quantity)],
    ["Total", formatPeso(booking.total_cents)],
    ["Taken", booking.source === "offline" ? "Offline, by you" : "In the app"],
  ];

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
          {booking.ends_on >= today && (
            <Button variant="danger" onClick={() => setConfirming(true)} data-testid="booking-cancel">
              Cancel booking
            </Button>
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
      {confirming && (
        <Confirm
          title="Cancel this booking?"
          body={`${booking.guest_name}'s ${quantityNoun(listing, booking.quantity)} ${booking.quantity === 1 ? "goes" : "go"} back on sale. This can't be undone.`}
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
    <Dialog open onClose={onClose} placement="sheet" title="Blocked" data-testid="block-sheet">
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
