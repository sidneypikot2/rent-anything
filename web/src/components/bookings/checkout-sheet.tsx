"use client";

import { useState, type FormEvent } from "react";
import { CodeForm } from "@/components/auth/email-code-form";
import { InstantBookBadge } from "@/components/discovery/instant-book-badge";
import { formatDateRange, itemAmount } from "@/components/trips/format";
import {
  itemPriceLabel,
  itemQuote,
  pickedTotal,
  quoteTotal,
  useTripQuote,
  type Trip,
  type TripItem,
} from "@/components/trips/use-trips";
import { Button } from "@/components/ui/button";
import { ConsentField } from "@/components/legal/consent-field";
import { Dialog, DialogSummary } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { TripLinkCard } from "@/components/guest/trip-link-card";
import { Field } from "@/components/ui/field";
import { PhoneField } from "@/components/ui/phone-field";
import { refreshSessionUser } from "@/lib/auth/actions";
import { getSession, isAnonymous, useSession } from "@/lib/auth/session";
import { formatPeso } from "@/lib/money";
import { PHONE_ERROR, toE164 } from "@/lib/ph-phone";
import { BookingStatusBadge } from "./booking-status";
import { CodeRequiredError, newIdempotencyKey, useCheckout, type Checkout, type Contact } from "./use-bookings";

// What the cart's button says for the items picked (RAA-133): instant-book items are booked,
// request-to-book ones sent as requests.
export function checkoutLabel(items: TripItem[]) {
  const instant = items.filter((item) => item.listing.instant_book).length;
  if (instant === items.length) return "Book";
  if (instant === 0) return items.length === 1 ? "Send request" : "Send requests";
  return "Book and request";
}

// Booking a trip's picked items (RAA-133), in a sheet: what will be booked and how, then the
// bookings as they came back, each with its status and total. The API re-prices every item
// and checks the calendar again, all or nothing, so a refusal names the item and nothing is
// booked. One idempotency key per sheet, so pressing again after a failed connection can't
// book twice. A guest without an account gives their name, email and phone here first
// (RAA-177); an email another guest has asks for the code the API sent it, and once signed in
// with it (their trips move into that account) the checkout goes ahead. The first checkout
// comes back with the trip link and PIN, shown once.
export function CheckoutSheet({ trip, items, onClose }: { trip: Trip; items: TripItem[]; onClose: () => void }) {
  const checkout = useCheckout();
  const toast = useToast();
  const [key] = useState(newIdempotencyKey);
  const anonymous = isAnonymous(useSession());
  // The email waiting for its code (a 409), while the code step shows.
  const [codeFor, setCodeFor] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string>();
  // Whether the guest has typed their contact details: closing then asks first, until it's sent.
  const [typed, setTyped] = useState(false);
  const result = checkout.data;
  const error = checkout.error instanceof CodeRequiredError ? null : checkout.error;
  // What the picked items come to, from the trip's quote (cached from the cart), for the action bar.
  const quote = useTripQuote(trip.id);
  const total = pickedTotal(quote.data, items);

  function close() {
    if (!checkout.isPending) onClose();
  }

  function send(contact?: Contact) {
    checkout.mutate(
      { tripId: trip.id, itemIds: items.map((item) => item.id), idempotencyKey: key, contact },
      {
        onSuccess: (done) => {
          toast.show(checkoutNotice(done), { "data-testid": "checkout-toast" });
          // The guest has an email now: the header and the cart's account line follow.
          if (contact) void refreshSessionUser();
        },
        onError: (failed) => {
          if (failed instanceof CodeRequiredError && contact) setCodeFor(contact.email);
        },
      },
    );
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Read when sent, not from render: a code just verified has made the session another's.
    if (!isAnonymous(getSession())) return send();
    const form = new FormData(event.currentTarget);
    const e164 = toE164(phone);
    if (!e164) return setPhoneError(PHONE_ERROR);
    send({
      name: String(form.get("name") ?? "").trim(),
      email: String(form.get("email") ?? "").trim(),
      phone: e164,
      terms_accepted: form.get("terms") === "on",
    });
  }

  return (
    <Dialog
      open
      onClose={close}
      dirty={typed && !result}
      placement="sheet"
      // Named after the trip (the modal redesign); the button says what happens to its items.
      title={result ? bookedTitle(result) : codeFor ? "Check your email" : trip.name}
      meta={result || codeFor ? undefined : checkoutMeta(items)}
      data-testid="checkout-sheet"
      summary={
        result ? (
          <DialogSummary
            value={quoteTotal(result.total_cents, result.bookings.filter((booking) => booking.to_be_agreed).length)}
            detail="Total"
          />
        ) : codeFor ? undefined : (
          <DialogSummary
            value={<span data-testid="checkout-total">{total ?? (quote.isPending ? "Working out the total…" : "—")}</span>}
            detail="Total · nothing is charged yet"
          />
        )
      }
      actions={
        result ? (
          <Button type="button" onClick={onClose}>
            Done
          </Button>
        ) : codeFor ? undefined : (
          <Button type="submit" form="checkout-form" data-testid="checkout-confirm" loading={checkout.isPending}>
            {checkout.isPending ? "Sending…" : checkoutLabel(items)}
          </Button>
        )
      }
    >
      {result ? (
        <Booked result={result} />
      ) : codeFor ? (
        <CodeForm
          email={codeFor}
          intro={`${codeFor} already has trips with us. We've emailed it a 6-digit code: enter it to add this trip to them and send it.`}
          onSignedIn={() => {
            setCodeFor(null);
            send();
          }}
        />
      ) : (
        <form id="checkout-form" onSubmit={submit} onInput={() => setTyped(true)} className="flex flex-col gap-4">
          <Picked trip={trip} items={items} />
          {anonymous && (
            <fieldset disabled={checkout.isPending} data-testid="checkout-contact" className="flex flex-col gap-3">
              <legend className="mb-1 font-semibold">Your details</legend>
              <p className="text-sm text-muted">
                Partners see these on your booking. No account needed: we&apos;ll email you a link and PIN to come back
                to your trips.
              </p>
              <Field label="Full name" name="name" autoComplete="name" required />
              <Field label="Email" name="email" type="email" autoComplete="email" required />
              <PhoneField
                label="Phone"
                required
                number={phone}
                onNumberChange={(next) => {
                  setPhone(next);
                  setPhoneError(undefined);
                }}
                error={phoneError}
              />
              <ConsentField />
            </fieldset>
          )}
        </form>
      )}
      {error && (
        <p role="alert" data-testid="checkout-error" className="text-sm text-danger">
          {error.message}
        </p>
      )}
    </Dialog>
  );
}

// The toast once it's done: what was booked straight away and what went to partners as requests.
export function checkoutNotice(result: Checkout) {
  const booked = result.bookings.filter((booking) => booking.status === "confirmed").length;
  const sent = result.bookings.length - booked;
  const requests = sent === 1 ? "Request sent to the partner" : `${sent} requests sent to their partners`;
  if (sent === 0) return booked === 1 ? "Booked" : `${booked} booked`;
  return booked === 0 ? requests : `${booked} booked · ${requests.charAt(0).toLowerCase()}${requests.slice(1)}`;
}

// What the button will do, in a line under the trip's name: "1 item, sent as a request".
function checkoutMeta(items: TripItem[]) {
  const count = items.length === 1 ? "1 item" : `${items.length} items`;
  const instant = items.filter((item) => item.listing.instant_book).length;
  if (instant === items.length) return `${count}, booked straight away`;
  if (instant === 0) return `${count}, sent as ${items.length === 1 ? "a request" : "requests"} to the partner`;
  return `${count}: some booked straight away, the rest sent as requests`;
}

function bookedTitle(result: Checkout) {
  return result.bookings.every((booking) => booking.status === "confirmed") ? "You're booked" : "Sent";
}

// What will be sent, with each item's price from the trip's quote (cached from the cart) and
// what they come to, so the guest checks it before sending. One note for all of them.
function Picked({ trip, items }: { trip: Trip; items: TripItem[] }) {
  const quote = useTripQuote(trip.id);
  const requests = items.some((item) => !item.listing.instant_book);

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-[1.375rem] border border-line">
        {items.map((item) => {
          const dates = formatDateRange(item.starts_on, item.ends_on);
          const price = itemPriceLabel(itemQuote(quote.data, item));
          return (
            <li key={item.id} className="flex items-start justify-between gap-3 px-3.5 py-3">
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="flex flex-wrap items-center gap-2 font-semibold">
                  {item.listing.title}
                  {item.listing.instant_book && <InstantBookBadge small />}
                </span>
                <span className="text-sm text-muted">
                  {dates ? `${dates} · ` : ""}
                  {itemAmount(item)}
                </span>
              </span>
              {quote.isPending ? (
                <span aria-hidden className="mt-1 block h-4 w-16 shrink-0 rounded bg-mist motion-safe:animate-pulse" />
              ) : (
                price && (
                  <span className="shrink-0 text-sm font-semibold tabular-nums" data-testid="checkout-item-price">
                    {price}
                  </span>
                )
              )}
            </li>
          );
        })}
      </ul>
      <p className="text-sm text-muted">
        {requests && "Each partner has 24 hours to accept, and your dates are held meanwhile. "}
        You&apos;ll see each answer in your cart, and pay there once a partner accepts. Payments aren&apos;t live yet, so
        nothing is charged.
      </p>
    </div>
  );
}

function Booked({ result }: { result: Checkout }) {
  return (
    <div className="flex flex-col gap-4" data-testid="checkout-result">
      <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-[1.375rem] border border-line">
        {result.bookings.map((booking) => (
          <li key={booking.id} className="flex items-start justify-between gap-3 px-3.5 py-3">
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="font-semibold">{booking.listing.title}</span>
              <span className="text-sm text-muted">
                {formatDateRange(booking.starts_on, booking.ends_on)} · {booking.reference}
              </span>
              <span className="text-sm font-semibold tabular-nums">
                {booking.to_be_agreed ? "Price to be agreed with the partner" : formatPeso(booking.total_cents)}
              </span>
            </span>
            <BookingStatusBadge status={booking.status} small />
          </li>
        ))}
      </ul>
      {result.trip_link && <TripLinkCard link={result.trip_link} emailed />}
    </div>
  );
}
