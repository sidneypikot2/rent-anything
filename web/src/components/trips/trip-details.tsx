"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BAND_PHOTO } from "@/components/landing/sample-photos";
import { CopyGlyph, MergeGlyph, PencilGlyph, TrashGlyph } from "@/components/discovery/tag-glyphs";
import { useOpensInNewTab } from "@/components/discovery/business-row";
import { BOOKING_STATE, LAUNCH_AREA } from "@/components/landing/launch-area";
import { payable, payBy, payTotal } from "@/components/bookings/pay-sheet";
import { PlanReviewBody } from "@/components/plan/plan-review-body";
import { usePlanPlace } from "@/components/plan/use-plan-place";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Menu } from "@/components/ui/menu";
import { bookingProgress } from "./cart-trip-nav";
import { DeletionBanner } from "./deletion-banner";
import type { EditFocus } from "./edit-trip-sheet";
import { formatDateRange, guestCount, itemCount, thingCount, todayIso } from "./format";
import { pastOutcome, tripPhase, tripTiming } from "./trip-phase";
import { itemProblem, itemQuote, pickedTotal, quoteTotal, useTripQuote, type Trip, type TripItem, type TripQuote } from "./use-trips";
import { listingPath } from "@/lib/seo";

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

// The trip picked in the cart (RAA-135): a header with its name, dates, guests and where it goes,
// then the trip as the planner reviews it (RAA-305, `PlanReviewBody`): day by day, with what is
// still missing linking back to the planner's step, and the picked places under a tab. A row opens
// the item's panel (the listing and its booking), where it is re-dated, moved, removed, sent or
// paid on its own. The foot sends every item that can be sent (Send to partners, as the review)
// and pays for every request its partner accepted (RAA-143). Prices and problems come from the
// trip's quote: an item that can't be sent as it is says why on its row and stays out of the send.
// On the Trips page (`mode="trips"`) it shows only the booked items, with no gaps or foot, when
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
  const quote = useTripQuote(trip.id);
  const { slug, place } = usePlanPlace(trip);
  const router = useRouter();
  const newTab = useOpensInNewTab();
  const dates = formatDateRange(trip.starts_on, trip.ends_on) ?? "No dates yet";
  const progress = bookingProgress(trip);
  const cart = mode === "cart";
  const phase = tripPhase(trip);
  const shown = cart ? trip.items : trip.items.filter((item) => item.booking);
  const unbooked = trip.items.length - trip.items.filter((item) => item.booking).length;
  const toSend = cart ? trip.items.filter((item) => bookable(item) && !itemProblem(item, itemQuote(quote.data, item))) : [];
  const sendTotal = pickedTotal(quote.data, toSend);
  const toPay = cart ? trip.items.filter(payable) : [];
  const toPayBy = payBy(toPay);
  const totalCents = !quote.data ? 0 : cart ? quote.data.total_cents : bookedTotal(quote.data, shown);
  const shownTrip = cart ? trip : { ...trip, items: shown };
  const back = `/plan/${slug ?? LAUNCH_AREA.slug}?trip=${trip.id}`;
  // A tour named in the places panel: its item's panel when the trip holds it, else its page, as
  // the review opens it.
  function openListing(id: number) {
    const item = shown.find((each) => each.listing.id === id);
    if (item) return actions.open(trip, item);
    const href = `${listingPath({ id })}?trip=${trip.id}${slug ? `&place=${slug}` : ""}`;
    if (newTab) window.open(href, "_blank");
    else router.push(href);
  }

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

      {shown.length === 0 && (
        <Card edge="line">
          <div className="flex flex-col items-start gap-3 px-4 py-3.5 sm:p-card">
            <p className="text-sm text-muted">
              {trip.saved_landmarks.length > 0 ? "Nothing to book in this trip yet" : "Nothing in this trip yet"}. Add tours, rentals or
              stays from a destination.
            </p>
            {cart && (
              <Button type="button" size="sm" onClick={() => actions.findMore(trip)}>
                Find something to add
              </Button>
            )}
          </div>
        </Card>
      )}

      {(shown.length > 0 || (cart && trip.saved_landmarks.length > 0)) && (
        <div className="flex min-w-0 flex-col" data-testid="trip-review">
          <PlanReviewBody
            trip={shownTrip}
            place={place}
            quote={quote.data}
            onEvent={(item) => actions.open(trip, item)}
            onListing={openListing}
            back={back}
            gaps={cart && phase !== "past"}
            layout="tabs"
          />
        </div>
      )}

      {!cart && unbooked > 0 && phase !== "past" && (
        <p className="text-sm text-muted">
          {itemCount(unbooked)} in this trip {unbooked === 1 ? "isn't" : "aren't"} booked yet.{" "}
          <Link href={`/cart?trip=${trip.id}`} className="font-semibold text-link hover:underline" data-testid="trip-open-cart">
            Open it in the cart
          </Link>
        </p>
      )}

      {cart && (toSend.length > 0 || toPay.length > 0) && (
        // Sticky at every width: on a phone a long trip put the send far down the page. The same
        // words as the plan's review foot; paying sits beside it once a partner has accepted.
        <Card edge="line" className="sticky bottom-3 z-20 flex flex-col gap-3 px-card py-4" data-testid="cart-foot">
          {toSend.length > 0 && (
            <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-3">
              <div className="min-w-0 flex-1 text-sm">
                <p className="flex items-baseline justify-between gap-3 font-bold text-navy">
                  <span>{thingCount(toSend.length)}</span>
                  {sendTotal && (
                    <span className="tabular-nums" data-testid="cart-picked-total">
                      {sendTotal}
                    </span>
                  )}
                </p>
                <p className="text-small text-muted text-pretty" data-testid="cart-send-note">
                  Each goes to its partner as a request; {BOOKING_STATE.answer}, and {BOOKING_STATE.unpaid}.
                </p>
              </div>
              <Button type="button" size="md" glyph="arrow" className="shrink-0 sm:min-w-40" onClick={() => actions.checkout(trip, toSend)} data-testid="cart-checkout">
                Send to partners
              </Button>
            </div>
          )}
          {toPay.length > 0 && (
            <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-3" data-testid="cart-pay-bar">
              <div className="min-w-0 flex-1 text-sm">
                <p className="text-muted">{itemCount(toPay.length)} accepted · pay to confirm</p>
                <p className="font-semibold" data-testid="cart-pay-total">
                  {payTotal(toPay)}
                  {toPayBy && ` · pay by ${toPayBy}`}
                </p>
              </div>
              <Button type="button" size="md" className="shrink-0 sm:min-w-40" onClick={() => actions.pay(trip, toPay)} data-testid="cart-pay">
                Pay
              </Button>
            </div>
          )}
        </Card>
      )}
    </section>
  );
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
