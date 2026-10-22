"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { BookingStatusBadge } from "@/components/bookings/booking-status";
import { CANCELLATION_POLICY } from "@/components/bookings/cancellation";
import { checkoutLabel } from "@/components/bookings/checkout-sheet";
import { payable, payBy, payTotal } from "@/components/bookings/pay-sheet";
import { CategoryGlyph } from "@/components/discovery/tag-glyphs";
import { isApiPhoto } from "@/components/landing/sample-photos";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Menu } from "@/components/ui/menu";
import { Pill } from "@/components/ui/pill";
import { formatPeso } from "@/lib/money";
import { bookingProgress } from "./cart-trip-nav";
import { DeletionBanner } from "./deletion-banner";
import type { EditFocus } from "./edit-trip-sheet";
import { formatDateRange, guestCount, itemCount, todayIso } from "./format";
import { TripItinerary } from "./trip-itinerary";
import { pastOutcome, tripPhase, tripTiming } from "./trip-phase";
import { itemProblem, itemQuote, useTripQuote, type ItemQuote, type Trip, type TripItem, type TripQuote } from "./use-trips";

// What the cart does with a trip or one of its items; each opens a sheet, a dialog or the
// item's panel. The Trips page (RAA-140) only opens items and recreates trips.
export type TripActions = {
  edit: (trip: Trip, focus?: EditFocus) => void;
  merge: (trip: Trip) => void;
  remove: (trip: Trip) => void;
  open: (trip: Trip, item: TripItem) => void;
  moveItem: (trip: Trip, item: TripItem) => void;
  redateItem: (trip: Trip, item: TripItem) => void;
  removeItem: (trip: Trip, item: TripItem) => void;
  checkout: (trip: Trip, items: TripItem[]) => void;
  // Pays for items whose booking its partner accepted (RAA-143).
  pay: (trip: Trip, items: TripItem[]) => void;
  recreate: (trip: Trip) => void;
  // More for the trip from its destinations or a search (the cart's Find more).
  findMore: (trip: Trip) => void;
};

// The cart edits and books a trip; the Trips page shows what was booked.
export type TripMode = "cart" | "trips";

// An item can be booked once it has dates that haven't passed, and while it has no booking
// holding its days (RAA-133).
export function bookable(item: TripItem) {
  return !item.booking && item.starts_on !== null && item.starts_on >= todayIso();
}

// "₱12,300", with what is priced with the partner after it: "₱12,300 + 1 to agree".
export function quoteTotal(totalCents: number, toBeAgreed: number) {
  if (toBeAgreed === 0) return formatPeso(totalCents);
  const agree = `${toBeAgreed} to agree with the partner`;
  return totalCents > 0 ? `${formatPeso(totalCents)} + ${agree}` : `Price ${agree}`;
}

// What the picked items come to, from the trip's quote.
function pickedTotal(quote: TripQuote | undefined, items: TripItem[]) {
  const lines = items.flatMap((item) => {
    const line = itemQuote(quote, item);
    return line && !line.problem ? [line] : [];
  });
  if (!quote || lines.length < items.length) return null;
  return quoteTotal(
    lines.reduce((sum, line) => sum + (line.total_cents ?? 0), 0),
    lines.filter((line) => line.to_be_agreed).length,
  );
}

// The trip picked in the cart (RAA-135): a header with its name, dates, guests and where it
// goes, then its items in date order, undated last, each a card that opens its panel (the
// listing and its booking), or the same trip day by day (RAA-140). Checkout (RAA-133): every
// item that can be booked is ticked at first; the foot sends the ticked ones, and a booked
// item shows its booking's status instead of a tick. Prices and problems come from the
// trip's quote (RAA-140): an item that can't be booked as it is says why and can't be ticked.
// Paying (RAA-143): an item whose booking its partner accepted is ticked too, apart from those
// to send, and a second foot pays for the ticked ones. In the cart the items are grouped by
// where their booking stands (groupItems), each foot inside its group; an empty group is hidden.
// On the Trips page (`mode="trips"`) it shows only the booked items, day by day at first, when
// the trip is, and offers to plan it again.
export function TripDetails({ trip, actions, mode = "cart" }: { trip: Trip; actions: TripActions; mode?: TripMode }) {
  const [unpicked, setUnpicked] = useState<ReadonlySet<number>>(new Set());
  const [unpaid, setUnpaid] = useState<ReadonlySet<number>>(new Set());
  const [view, setView] = useState<"items" | "days">(mode === "cart" ? "items" : "days");
  const quote = useTripQuote(trip.id);
  const dates = formatDateRange(trip.starts_on, trip.ends_on) ?? "No dates yet";
  const progress = bookingProgress(trip);
  const cart = mode === "cart";
  const phase = tripPhase(trip);
  const shown = cart ? trip.items : trip.items.filter((item) => item.booking);
  const unbooked = trip.items.length - trip.items.filter((item) => item.booking).length;
  const problem = (item: TripItem) => itemProblem(item, itemQuote(quote.data, item));
  const canBook = cart ? trip.items.filter((item) => bookable(item) && !problem(item)) : [];
  const picked = canBook.filter((item) => !unpicked.has(item.id));
  const pickedPrice = pickedTotal(quote.data, picked);
  const canPay = cart ? trip.items.filter(payable) : [];
  const toPay = canPay.filter((item) => !unpaid.has(item.id));
  const toPayBy = payBy(toPay);
  const shownTrip = cart ? trip : { ...trip, items: shown };

  function toggle(item: TripItem) {
    (payable(item) ? setUnpaid : setUnpicked)((before) => {
      const next = new Set(before);
      if (next.has(item.id)) next.delete(item.id);
      else next.add(item.id);
      return next;
    });
  }

  function card(item: TripItem) {
    return (
      <ItemCard
        key={item.id}
        trip={trip}
        item={item}
        actions={actions}
        mode={mode}
        quote={itemQuote(quote.data, item)}
        quoting={quote.isPending}
        problem={problem(item)}
        picked={
          canBook.includes(item) ? !unpicked.has(item.id) : canPay.includes(item) ? !unpaid.has(item.id) : undefined
        }
        onPick={() => toggle(item)}
      />
    );
  }

  // The feet of the cart's groups: sending the ticked items, paying for the ticked accepted ones.
  const sendFoot = canBook.length > 0 && (
    <Card
      edge="line"
      className="flex flex-wrap items-center justify-between gap-3 px-card py-4"
    >
      <div className="text-sm">
        <p className="text-muted">
          {picked.length} of {itemCount(canBook.length)} ticked · each goes to its partner as a request
        </p>
        {picked.length > 0 && pickedPrice && (
          <p className="font-semibold" data-testid="cart-picked-total">
            {pickedPrice} · you pay once the partner accepts
          </p>
        )}
      </div>
      <Button
        type="button"
        size="pill"
        disabled={picked.length === 0}
        onClick={() => actions.checkout(trip, picked)}
        data-testid="cart-checkout"
      >
        {picked.length > 0 ? checkoutLabel(picked) : "Send requests"}
      </Button>
    </Card>
  );

  const payFoot = canPay.length > 0 && (
    <Card
      edge="line"
      className="flex flex-wrap items-center justify-between gap-3 px-card py-4"
      data-testid="cart-pay-bar"
    >
      <div className="text-sm">
        <p className="text-muted">
          {toPay.length} of {itemCount(canPay.length)} accepted ticked · pay to confirm
        </p>
        {toPay.length > 0 && (
          <p className="font-semibold" data-testid="cart-pay-total">
            {payTotal(toPay)}
            {toPayBy && ` · pay by ${toPayBy}`}
          </p>
        )}
      </div>
      <Button
        type="button"
        size="pill"
        disabled={toPay.length === 0}
        onClick={() => actions.pay(trip, toPay)}
        data-testid="cart-pay"
      >
        Pay
      </Button>
    </Card>
  );

  const menu = cart
    ? [
        {
          label: "Rename or change dates",
          onSelect: () => actions.edit(trip),
          "data-testid": "trip-action-edit",
        },
        {
          label: "Merge with another trip",
          detail: "Moves every item into it",
          onSelect: () => actions.merge(trip),
          "data-testid": "trip-action-merge",
        },
        {
          label: "Plan this trip again",
          detail: "A copy with new dates",
          onSelect: () => actions.recreate(trip),
          "data-testid": "trip-action-recreate",
        },
        {
          label: "Delete trip",
          danger: true,
          onSelect: () => actions.remove(trip),
          "data-testid": "trip-action-delete",
        },
      ]
    : [
        {
          label: "Plan this trip again",
          detail: "A copy with new dates",
          onSelect: () => actions.recreate(trip),
          "data-testid": "trip-action-recreate",
        },
      ];

  return (
    <section
      id={`trip-${trip.id}`}
      aria-labelledby={`trip-${trip.id}-name`}
      data-testid="cart-trip"
      className="flex min-w-0 flex-col gap-3"
    >
      <div className="card-edge rounded-card bg-forest text-white shadow-soft">
        {/* One grid, so a past trip's Plan this trip again sits beside the menu from sm and
            under the details, full width, on a phone, without a second copy of the button. */}
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
          <div className="col-start-1 row-start-1 min-w-0">
            {!cart && (
              <p className="mb-1.5 flex flex-wrap items-center gap-2">
                <Badge tone={phase === "past" ? "mist" : "emerald"} data-testid="trip-status">
                  {phase === "past" ? pastOutcome(trip) : phase === "now" ? "Happening now" : "Booked"}
                </Badge>
                <span className="text-sm font-semibold text-mint" data-testid="trip-timing">
                  {tripTiming(trip)}
                </span>
              </p>
            )}
            <h2
              id={`trip-${trip.id}-name`}
              className="line-clamp-2 font-display text-xl font-extrabold leading-tight tracking-tight sm:text-2xl"
            >
              {trip.name}
            </h2>
            <p className="mt-0.5 text-sm text-sky-mist">
              {[dates, guestCount(trip.guests), itemCount(shown.length), trip.destinations.join(", ")]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <p className="mt-1 flex flex-wrap gap-x-3 text-small font-semibold empty:hidden">
              {cart && progress && <span className="text-mint">{progress}</span>}
              {quote.data && quote.data.items.length > 0 && (
                <span className="text-white" data-testid="trip-total">
                  {cart ? "Comes to about " : "Booked for "}
                  {quoteTotal(
                    cart ? quote.data.total_cents : bookedTotal(quote.data, shown),
                    cart ? quote.data.to_be_agreed_count : bookedToAgree(quote.data, shown),
                  )}
                </span>
              )}
            </p>
          </div>
          {!cart && phase === "past" && (
            <Button
              type="button"
              variant="tint"
              size="sm"
              onClick={() => actions.recreate(trip)}
              data-testid="trip-recreate"
              className="col-span-2 row-start-2 w-full sm:col-span-1 sm:col-start-2 sm:row-start-1 sm:w-auto"
            >
              Plan this trip again
            </Button>
          )}
          {cart && (
            <Button
              type="button"
              variant="tint"
              size="sm"
              onClick={() => actions.findMore(trip)}
              data-testid="cart-find-more"
              className="col-span-2 row-start-2 w-full sm:col-span-1 sm:col-start-2 sm:row-start-1 sm:w-auto"
            >
              Find more
            </Button>
          )}
          <div className="col-start-2 row-start-1 sm:col-start-3">
            <Menu label={`Actions for ${trip.name}`} tone="dark" data-testid="cart-trip-menu" items={menu} />
          </div>
        </div>
        {cart && (
          <div className="px-5 pb-3 empty:hidden">
            <DeletionBanner trip={trip} onChangeDates={() => actions.edit(trip, "dates")} />
          </div>
        )}
      </div>

      {shown.length > 0 && (
        <div className="flex gap-2" role="group" aria-label="Show the trip as">
          <Pill on={view === "items"} onClick={() => setView("items")} data-testid="trip-view-items">
            Items
          </Pill>
          <Pill on={view === "days"} onClick={() => setView("days")} data-testid="trip-view-days">
            Day by day
          </Pill>
        </div>
      )}

      {shown.length === 0 ? (
        <Card edge="line">
          <div className="flex flex-col items-start gap-3 p-card">
            <p className="text-sm text-muted">Nothing in this trip yet. Add tours, rentals or stays from a destination.</p>
            {cart && (
              <Button type="button" size="sm" onClick={() => actions.findMore(trip)}>
                Find something to add
              </Button>
            )}
          </div>
        </Card>
      ) : view === "days" ? (
        <TripItinerary trip={shownTrip} onOpen={(item) => actions.open(trip, item)} />
      ) : cart ? (
        <div className="flex flex-col gap-section">
          {groupItems(shown).map(
            (group) =>
              group.items.length > 0 && (
                <section
                  key={group.key}
                  aria-labelledby={`trip-${trip.id}-${group.key}`}
                  data-testid={`cart-section-${group.key}`}
                  className="flex flex-col gap-3"
                >
                  <h3 id={`trip-${trip.id}-${group.key}`} className="text-sm font-semibold">
                    {group.title} <span className="font-normal text-muted">· {group.items.length}</span>
                  </h3>
                  <ul className="flex flex-col gap-3">{group.items.map(card)}</ul>
                  {group.key === "unbooked" && sendFoot}
                  {group.key === "payment" && payFoot}
                </section>
              ),
          )}
        </div>
      ) : (
        <ul className="flex flex-col gap-3">{shown.map(card)}</ul>
      )}

      {!cart && unbooked > 0 && phase !== "past" && (
        <p className="text-sm text-muted">
          {itemCount(unbooked)} in this trip {unbooked === 1 ? "isn't" : "aren't"} booked yet.{" "}
          <Link href={`/cart?trip=${trip.id}`} className="font-semibold text-link hover:underline" data-testid="trip-open-cart">
            Open it in the cart
          </Link>
        </p>
      )}

    </section>
  );
}

// A cart trip's items by where their booking stands, in the order the cart shows them.
function groupItems(items: TripItem[]) {
  const status = (item: TripItem) => item.booking?.status;
  return [
    { key: "unbooked", title: "Not booked yet", items: items.filter((item) => !item.booking) },
    { key: "payment", title: "Awaiting payment", items: items.filter(payable) },
    {
      key: "waiting",
      title: "Waiting for the partner",
      items: items.filter((item) => status(item) === "requested" || status(item) === "accepted"),
    },
    {
      key: "booked",
      title: "Booked",
      items: items.filter((item) => item.booking && !payable(item) && !["requested", "accepted"].includes(status(item)!)),
    },
  ];
}

function bookedLines(quote: TripQuote, items: TripItem[]) {
  return items.flatMap((item) => {
    const line = itemQuote(quote, item);
    return line ? [line] : [];
  });
}

function bookedTotal(quote: TripQuote, items: TripItem[]) {
  return bookedLines(quote, items).reduce((sum, line) => sum + (line.total_cents ?? 0), 0);
}

function bookedToAgree(quote: TripQuote, items: TripItem[]) {
  return bookedLines(quote, items).filter((line) => line.to_be_agreed).length;
}

// An item's price on its card: the quote's total, "Price to agree" for a rental or transfer,
// a short placeholder while the quote loads, nothing when it has a problem.
function ItemPrice({ quote, quoting }: { quote: ItemQuote | undefined; quoting: boolean }) {
  if (quoting) return <span aria-hidden className="block h-4 w-16 rounded bg-mist motion-safe:animate-pulse" />;
  if (!quote || quote.problem || quote.total_cents === null) return null;
  return (
    <span className="text-sm font-semibold tabular-nums" data-testid="cart-item-price">
      {quote.to_be_agreed ? "Price to agree" : formatPeso(quote.total_cents)}
    </span>
  );
}

// One item as a card: its photo, title, what it is and when, its price and cancellation terms,
// and what stands in the way of booking it. The title's button stretches over the card and
// opens its panel; the tick and the menu sit above it (`relative z-10`). `picked` is set for
// an item that can be booked: whether it is ticked.
function ItemCard({
  trip,
  item,
  actions,
  mode,
  quote,
  quoting,
  problem,
  picked,
  onPick,
}: {
  trip: Trip;
  item: TripItem;
  actions: TripActions;
  mode: TripMode;
  quote: ItemQuote | undefined;
  quoting: boolean;
  problem: string | null;
  picked?: boolean;
  onPick: () => void;
}) {
  const dates = formatDateRange(item.starts_on, item.ends_on);
  const booking = item.booking;
  const photo = item.listing.cover_photo_url;
  const policy = CANCELLATION_POLICY[item.cancellation_policy];

  return (
    <li data-testid="cart-item">
      <Card
        clip={false}
        edge="line"
        className="relative flex items-center gap-3 p-2.5 transition-[border-color,box-shadow] duration-300 ease-calm hover:border-line-2 hover:shadow-lift sm:px-3"
      >
        {picked !== undefined && (
          <input
            type="checkbox"
            checked={picked}
            onChange={onPick}
            aria-label={`${payable(item) ? "Pay for" : "Book"} ${item.listing.title}`}
            data-testid={payable(item) ? "cart-item-pay-pick" : "cart-item-pick"}
            className="relative z-10 size-5 shrink-0 rounded border-line-strong accent-primary"
          />
        )}
        <div className="size-16 shrink-0 overflow-hidden rounded-control bg-mist">
          {photo ? (
            <Image
              src={photo}
              alt=""
              width={128}
              height={128}
              unoptimized={isApiPhoto(photo)}
              className="size-full object-cover"
            />
          ) : (
            <span className="flex size-full items-center justify-center text-primary">
              <CategoryGlyph name={item.listing.category} className="size-7" />
            </span>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <button
              type="button"
              aria-haspopup="dialog"
              onClick={() => actions.open(trip, item)}
              data-testid="cart-item-open"
              className="truncate text-left font-semibold leading-snug outline-none after:absolute after:inset-0 after:rounded-card after:content-[''] hover:text-primary focus-visible:after:outline-2 focus-visible:after:-outline-offset-4 focus-visible:after:outline-(--focus)"
            >
              {item.listing.title}
            </button>
            <p className="flex flex-wrap items-center gap-x-1 text-sm text-muted">
              {/* What and where only from sm: a phone keeps the row to guests and dates. */}
              <span className="hidden sm:inline">
                {item.listing.category} · {item.area.name} ·
              </span>
              <span>{guestCount(item.quantity)} ·</span>
              {dates ? (
                <span className="text-foreground">{dates}</span>
              ) : mode === "cart" ? (
                <button
                  type="button"
                  onClick={() => actions.redateItem(trip, item)}
                  className="relative z-10 font-semibold text-warning hover:underline"
                >
                  Pick a date to book
                </button>
              ) : (
                <span>No date</span>
              )}
            </p>
            {!booking && policy && (
              <p
                className={`hidden text-small font-semibold sm:block ${item.cancellation_policy === "non_refundable" ? "text-muted" : "text-emerald"}`}
                data-testid="cart-item-policy"
              >
                {policy.name}
              </p>
            )}
            {problem && (dates || !item.listing_active) && (
              <p className="text-sm font-semibold text-warning" data-testid="cart-item-problem">
                {problem}
              </p>
            )}
          </div>
          <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 whitespace-nowrap sm:shrink-0 sm:flex-col sm:flex-nowrap sm:items-end sm:gap-0.5">
            {booking && <BookingStatusBadge status={booking.status} small />}
            {!problem && <ItemPrice quote={quote} quoting={quoting} />}
            {booking && <span className="text-xs text-muted">{booking.reference}</span>}
          </p>
        </div>
        <div className="relative z-10">
          <Menu
            label={`Actions for ${item.listing.title}`}
            data-testid="cart-item-menu"
            items={
              booking || mode === "trips"
                ? [
                    {
                      label: booking ? "View booking" : "View details",
                      onSelect: () => actions.open(trip, item),
                      "data-testid": "item-action-booking",
                    },
                  ]
                : [
                    {
                      label: "Move to another trip",
                      onSelect: () => actions.moveItem(trip, item),
                      "data-testid": "item-action-move",
                    },
                    {
                      label: "Change date",
                      onSelect: () => actions.redateItem(trip, item),
                      "data-testid": "item-action-date",
                    },
                    {
                      label: "Remove",
                      danger: true,
                      onSelect: () => actions.removeItem(trip, item),
                      "data-testid": "item-action-remove",
                    },
                  ]
            }
          />
        </div>
      </Card>
    </li>
  );
}
