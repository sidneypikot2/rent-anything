"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { BAND_PHOTO } from "@/components/landing/sample-photos";
import { CalendarGlyph, CopyGlyph, InfoGlyph, MergeGlyph, MoveGlyph, PencilGlyph, TrashGlyph } from "@/components/discovery/tag-glyphs";
import { BookingStatusBadge } from "@/components/bookings/booking-status";
import { CANCELLATION_POLICY } from "@/components/bookings/cancellation";
import { checkoutLabel } from "@/components/bookings/checkout-sheet";
import { payable, payBy, payTotal } from "@/components/bookings/pay-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Menu } from "@/components/ui/menu";
import { Pill } from "@/components/ui/pill";
import { bookingProgress } from "./cart-trip-nav";
import { DeletionBanner } from "./deletion-banner";
import type { EditFocus } from "./edit-trip-sheet";
import { ItemThumb } from "./item-thumb";
import { formatDateRange, guestCount, itemAmount, itemCount, todayIso } from "./format";
import { TripItinerary } from "./trip-itinerary";
import { tripDatesQuery } from "./trip-dates";
import { missingStays, missingText, type Missing } from "./trip-missing";
import { byShop, ShopGroup } from "./shop-group";
import { pastOutcome, tripPhase, tripTiming } from "./trip-phase";
import {
  itemPriceLabel,
  itemProblem,
  itemQuote,
  pickedTotal,
  quoteTotal,
  useTripQuote,
  type ItemQuote,
  type Trip,
  type TripItem,
  type TripQuote,
} from "./use-trips";

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
  // A view-only link for friends (RAA-178); the cart's only.
  share?: (trip: Trip) => void;
};

// The cart edits and books a trip; the Trips page shows what was booked.
export type TripMode = "cart" | "trips";

// An item can be booked once it has dates that haven't passed, while it has no booking
// holding its days (RAA-133) and while its listing can have it then (`unavailable`).
export function bookable(item: TripItem) {
  return !item.booking && !item.unavailable && item.starts_on !== null && item.starts_on >= todayIso();
}

// The trip picked in the cart (RAA-135): a header with its name, dates, guests and where it
// goes, then its items in date order, undated last, each a card that opens its panel (the
// listing and its booking), or the same trip day by day (RAA-140). Checkout (RAA-133): every
// item that can be booked is ticked at first; the foot sends the ticked ones, and a booked
// item shows its booking's status instead of a tick. Prices and problems come from the
// trip's quote (RAA-140): an item that can't be booked as it is says why and can't be ticked.
// Paying (RAA-143): an item whose booking its partner accepted is ticked too, apart from those
// to send, and a second foot pays for the ticked ones; both feet sit under the items. A trip
// in more than one place lists its items under each place (byPlace), each card saying where its
// booking stands.
// On the Trips page (`mode="trips"`) it shows only the booked items, day by day at first, when
// the trip is, and offers to plan it again.
export function TripDetails({
  trip,
  actions,
  mode = "cart",
  onSwitch,
  tripCount = 1,
}: {
  trip: Trip;
  actions: TripActions;
  mode?: TripMode;
  // Below lg, where the trips' sidebar isn't shown: opens TripSwitchSheet (RAA-161).
  onSwitch?: () => void;
  tripCount?: number;
}) {
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
  const totalCents = !quote.data ? 0 : cart ? quote.data.total_cents : bookedTotal(quote.data, shown);
  const shownTrip = cart ? trip : { ...trip, items: shown };

  const places = byPlace(shown);
  // Nights with nowhere to sleep, said under the trip's header: a hint, never a step to finish.
  const missing = cart && phase !== "past" && trip.items.length > 0 ? missingStays(trip) : [];
  function toggle(item: TripItem) {
    (payable(item) ? setUnpaid : setUnpicked)((before) => {
      const next = new Set(before);
      if (next.has(item.id)) next.delete(item.id);
      else next.add(item.id);
      return next;
    });
  }

  // The items with a shop's vehicles together under its name (RAA-191).
  function list(items: TripItem[]) {
    return byShop(items).map((entry) =>
      entry.kind === "item" ? (
        card(entry.item)
      ) : (
        <ShopGroup key={`shop-${entry.business.id}`} business={entry.business} items={entry.items} people={trip.guests} card={card} />
      ),
    );
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

  // The cart's feet: sending the ticked items, paying for the ticked accepted ones.
  const sendFoot = canBook.length > 0 && (
    <Card edge="line" className="flex flex-wrap items-center justify-end gap-x-4 gap-y-3 px-card py-4">
      <div className="min-w-0 flex-1 text-sm">
        <p className="text-muted">
          {picked.length} of {itemCount(canBook.length)} ticked
        </p>
        {picked.length > 0 && pickedPrice && (
          <p className="font-semibold" data-testid="cart-picked-total">
            {pickedPrice}
          </p>
        )}
      </div>
      <Button
        type="button"
        size="pill"
        className="shrink-0"
        disabled={picked.length === 0}
        onClick={() => actions.checkout(trip, picked)}
        data-testid="cart-checkout"
      >
        {picked.length > 0 ? checkoutLabel(picked) : "Send requests"}
      </Button>
    </Card>
  );

  const payFoot = canPay.length > 0 && (
    <Card edge="line" className="flex flex-wrap items-center justify-end gap-x-4 gap-y-3 px-card py-4" data-testid="cart-pay-bar">
      <div className="min-w-0 flex-1 text-sm">
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
        className="shrink-0"
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
          icon: <PencilGlyph />,
          onSelect: () => actions.edit(trip),
          "data-testid": "trip-action-edit",
        },
        {
          label: "Merge with another trip",
          icon: <MergeGlyph />,
          detail: "Moves every item into it",
          onSelect: () => actions.merge(trip),
          "data-testid": "trip-action-merge",
        },
        {
          label: "Plan this trip again",
          icon: <CopyGlyph />,
          detail: "A copy with new dates",
          onSelect: () => actions.recreate(trip),
          "data-testid": "trip-action-recreate",
        },
        {
          label: "Delete trip",
          icon: <TrashGlyph />,
          danger: true,
          onSelect: () => actions.remove(trip),
          "data-testid": "trip-action-delete",
        },
      ]
    : [
        {
          label: "Plan this trip again",
          icon: <CopyGlyph />,
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
      {/* A trip band, as the home page's closing band: the island photo under the trip band's
          colour (navy on guest pages). The photo is clipped in its own layer, so the header's
          menu can still open past its foot, and z-10 keeps that menu over the items below. */}
      <div className="band card-edge relative isolate z-10 rounded-card text-white shadow-soft">
        <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden rounded-[inherit] bg-trip-band">
          <Image src={BAND_PHOTO} alt="" fill sizes="(min-width: 1024px) 50rem, 100vw" className="object-cover" />
          <div className="absolute inset-0 band-fill" />
        </div>
        {/* One grid, so a past trip's Plan this trip again sits beside the menu from sm and
            under the details, full width, on a phone, without a second copy of the button. */}
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:px-5 sm:py-4">
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
              {/* Not what the name already says: an auto-named trip is "<place> · <dates>". */}
              {[
                dates && !trip.name.includes(dates) && dates,
                guestCount(trip.guests),
                itemCount(shown.length),
                trip.destinations.filter((place) => !trip.name.includes(place)).join(", "),
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <p className="mt-1 flex flex-wrap gap-x-3 text-small font-semibold empty:hidden">
              {cart && progress && <span className="text-mint">{progress}</span>}
              {quote.data && quote.data.items.length > 0 && (
                <span className="text-white" data-testid="trip-total">
                  {/* "Comes to about" or "Booked for" only before an amount, never "Price to agree…". */}
                  {totalCents > 0 && (cart ? "Comes to about " : "Booked for ")}
                  {quoteTotal(totalCents, cart ? quote.data.to_be_agreed_count : bookedToAgree(quote.data, shown))}
                </span>
              )}
            </p>
          </div>
          {/* A phone's second row, full width; from sm beside the menu. Switch trip only below lg,
              where the trips' sidebar isn't shown. */}
          <div className="col-span-2 row-start-2 flex gap-2 empty:hidden sm:col-span-1 sm:col-start-2 sm:row-start-1">
            {onSwitch && tripCount > 1 && (
              <Button
                type="button"
                variant="paper"
                size="sm"
                onClick={onSwitch}
                data-testid="trip-switch"
                className="flex-1 whitespace-nowrap sm:flex-none lg:hidden"
              >
                Switch trip · {tripCount}
              </Button>
            )}
            {!cart && phase === "past" && (
              <Button
                type="button"
                variant="paper"
                size="sm"
                onClick={() => actions.recreate(trip)}
                data-testid="trip-recreate"
                className="flex-1 whitespace-nowrap sm:flex-none"
              >
                Plan this trip again
              </Button>
            )}
            {cart && (
              <Button
                type="button"
                variant="paper"
                size="sm"
                onClick={() => actions.findMore(trip)}
                data-testid="cart-find-more"
                className="flex-1 whitespace-nowrap sm:flex-none"
              >
                Find more
              </Button>
            )}
            {cart && actions.share && (
              <Button
                type="button"
                variant="paper"
                size="sm"
                onClick={() => actions.share?.(trip)}
                data-testid="cart-share"
                className="flex-1 whitespace-nowrap sm:flex-none"
              >
                Share
              </Button>
            )}
          </div>
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

      {missing.length > 0 && (
        <div
          data-testid="cart-missing"
          className="flex flex-col gap-1 rounded-control border border-warning bg-surface-2 px-3 py-2 text-sm"
        >
          <p className="font-semibold">Still needed</p>
          <ul className="flex flex-col gap-1">
            {missing.map((gap, index) => (
              <li key={index} className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span>
                  {capitalize(missingText(gap))}
                  {gap.kind === "stay" && gap.nights > 1 && <span className="text-muted"> · {gap.nights} nights</span>}
                </span>
                <Link href={findStayHref(trip, gap)} className="tap-target font-semibold text-link hover:underline">
                  Find a stay
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

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
          <div className="flex flex-col items-start gap-3 px-4 py-3.5 sm:p-card">
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
      ) : places.length > 1 ? (
        // A trip to more than one place: its items under each place, in the order the trip
        // reaches them, each heading with that place's days.
        <div className="flex flex-col gap-5">
          {places.map((place) => (
            <section key={place.slug} aria-labelledby={`trip-${trip.id}-${place.slug}`} data-testid="trip-place" className="flex flex-col gap-3">
              <h3
                id={`trip-${trip.id}-${place.slug}`}
                className="flex flex-wrap items-baseline justify-between gap-x-3 border-b border-line pb-2 font-semibold"
              >
                {place.name}
                <span className="text-sm font-normal text-muted">
                  {formatDateRange(place.from, place.to) ?? "No dates yet"}
                </span>
              </h3>
              <ul className="flex flex-col gap-3">{list(place.items)}</ul>
            </section>
          ))}
        </div>
      ) : (
        <ul className="flex flex-col gap-3">{list(shown)}</ul>
      )}

      {!cart && unbooked > 0 && phase !== "past" && (
        <p className="text-sm text-muted">
          {itemCount(unbooked)} in this trip {unbooked === 1 ? "isn't" : "aren't"} booked yet.{" "}
          <Link href={`/cart?trip=${trip.id}`} className="font-semibold text-link hover:underline" data-testid="trip-open-cart">
            Open it in the cart
          </Link>
        </p>
      )}

      {cart && view === "items" && (canBook.length > 0 || canPay.length > 0) && (
        // Sticky at every width: on a phone a long trip put Send requests thousands of pixels down.
        <div className="sticky bottom-3 z-20 flex flex-col gap-3">
          {sendFoot}
          {payFoot}
        </div>
      )}
    </section>
  );
}

// A trip's items by the place each is in (its destination: the island, or else the town or city),
// the places in the order the items reach them (the API sends items in date order, undated last),
// each with the days its dated items span.
function byPlace(items: TripItem[]) {
  const places = new Map<string, { slug: string; name: string; from: string | null; to: string | null; items: TripItem[] }>();
  for (const item of items) {
    const where = item.destination ?? item.area;
    const place = places.get(where.slug) ?? { slug: where.slug, name: where.name, from: null, to: null, items: [] };
    place.items.push(item);
    if (item.starts_on) {
      const end = item.ends_on ?? item.starts_on;
      if (!place.from || item.starts_on < place.from) place.from = item.starts_on;
      if (!place.to || end > place.to) place.to = end;
    }
    places.set(where.slug, place);
  }
  return [...places.values()];
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

// Where to find a stay for a gap: the place the trip is in just before it (the latest item that
// starts by then), else its first place, on its Stays with the trip's dates and guests.
function findStayHref(trip: Trip, gap: Missing) {
  const from = gap.kind === "stay" ? gap.from : null;
  const before = from ? trip.items.filter((item) => item.starts_on && item.starts_on <= from).at(-1) : undefined;
  const item = before ?? trip.items[0];
  const place = item.destination ?? item.area;
  const dates = tripDatesQuery({ from: trip.starts_on ?? undefined, to: trip.ends_on ?? undefined, guests: trip.guests });
  return `/${place.slug}${dates}#need-stay`;
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
  const label = itemPriceLabel(quote);
  if (!label) return null;
  return (
    <span className="text-sm font-semibold tabular-nums" data-testid="cart-item-price">
      {label}
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
        <ItemThumb item={item} />
        <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <button
              type="button"
              aria-haspopup="dialog"
              onClick={() => actions.open(trip, item)}
              data-testid="cart-item-open"
              // Two lines before it cuts: on a phone one line made "Hagnaya port to San…" twins.
              className="line-clamp-2 text-left font-semibold leading-snug break-words outline-none after:absolute after:inset-0 after:rounded-card after:content-[''] hover:text-primary focus-visible:after:outline-2 focus-visible:after:-outline-offset-4 focus-visible:after:outline-(--focus)"
            >
              {item.listing.title}
            </button>
            <p className="flex flex-wrap items-center gap-x-1 text-sm text-muted">
              {/* What and where only from sm: a phone keeps the row to guests and dates. */}
              <span className="hidden sm:inline">
                {item.listing.category} · {item.area.name} ·
              </span>
              <span>{itemAmount(item)} ·</span>
              {dates ? (
                <span className="text-foreground">{dates}</span>
              ) : mode === "cart" ? (
                <button
                  type="button"
                  onClick={() => actions.redateItem(trip, item)}
                  className="tap-target z-10 font-semibold text-warning hover:underline"
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
                      icon: <InfoGlyph />,
                      onSelect: () => actions.open(trip, item),
                      "data-testid": "item-action-booking",
                    },
                  ]
                : [
                    {
                      label: "Move to another trip",
                      icon: <MoveGlyph />,
                      onSelect: () => actions.moveItem(trip, item),
                      "data-testid": "item-action-move",
                    },
                    {
                      label: "Change dates or guests",
                      icon: <CalendarGlyph />,
                      onSelect: () => actions.redateItem(trip, item),
                      "data-testid": "item-action-date",
                    },
                    {
                      label: "Remove",
                      icon: <TrashGlyph />,
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
