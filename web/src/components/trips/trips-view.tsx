"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { CancelDialog } from "@/components/bookings/cancel-dialog";
import { ChangeBookingSheet } from "@/components/bookings/change-booking-sheet";
import { CancelledBookings } from "@/components/bookings/cancelled-bookings";
import type { GuestBooking } from "@/components/bookings/use-bookings";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { Toast } from "@/components/ui/toast";
import { CartItemPanel } from "./cart-item-panel";
import { CartTripNav, type TripGroup } from "./cart-trip-nav";
import { RANGE_TYPES } from "./format";
import { NewTripSheet } from "./new-trip-sheet";
import { RecreateTripSheet, recreatedNotice } from "./recreate-trip-sheet";
import { TripAddProvider, useTripAdd } from "./trip-add-provider";
import { TripDetails, type TripActions } from "./trip-details";
import { pastOutcome, tripPhase, tripTiming } from "./trip-phase";
import { useBookedTrips, type Trip, type TripItem } from "./use-trips";

type Open =
  | { kind: "item"; tripId: number; itemId: number }
  | { kind: "change"; item: TripItem; booking: GuestBooking }
  | { kind: "cancel"; booking: GuestBooking }
  | { kind: "recreate"; trip: Trip }
  | { kind: "new" };

// Nothing on the Trips page edits a trip's items: those are the cart's.
const none = () => {};

// What a trip in the sidebar says under its dates: when it is, or how it went.
function tabDetail(trip: Trip) {
  return tripPhase(trip) === "past" ? pastOutcome(trip) : tripTiming(trip);
}

function bookedCount(trip: Trip) {
  return trip.items.filter((item) => item.booking).length;
}

type Tab = "upcoming" | "past" | "cancelled";

// The upcoming tab: happening now first, then what's coming (soonest first). The past one: what's
// over (latest first, as the API sends them).
function groupTrips(trips: Trip[], tab: "upcoming" | "past"): TripGroup[] {
  const by = (phase: string) => trips.filter((trip) => tripPhase(trip) === phase);
  const soonest = (a: Trip, b: Trip) => (a.starts_on ?? "9999").localeCompare(b.starts_on ?? "9999");
  const groups =
    tab === "past"
      ? [{ label: "Past", trips: by("past") }]
      : [
          { label: "Happening now", trips: by("now") },
          { label: "Upcoming", trips: by("upcoming").sort(soonest) },
        ];
  return groups.filter((group) => group.trips.length > 0);
}

// The Trips page (screen 8, laid out like the cart in RAA-140): every trip with a booking, in
// a sidebar grouped Happening now, Upcoming and Past, beside the one picked (TripDetails in
// "trips" mode: its booked items, when it is, what it was booked for). An item opens its
// panel with the booking, which can be changed or cancelled before it starts; a past one can
// be booked again (the add-to-trip flow). Any trip can be planned again into the cart
// (RecreateTripSheet). Trips still being planned are the cart's. A switch over the sidebar
// shows the upcoming trips, the past ones, or the cancelled bookings no trip holds any more
// (CancelledBookings); the sidebar lists trips only.
export function TripsView({ expandTripId }: { expandTripId?: number }) {
  return (
    <TripAddProvider>
      <BookedTrips expandTripId={expandTripId} />
    </TripAddProvider>
  );
}

function BookedTrips({ expandTripId }: { expandTripId?: number }) {
  const trips = useBookedTrips();
  const { add } = useTripAdd();
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(expandTripId);
  const [tab, setTab] = useState<Tab | null>(null);
  const [open, setOpen] = useState<Open | null>(null);
  const [notice, setNotice] = useState<{ id: number; text: string } | null>(null);

  const show = useCallback((text: string) => setNotice({ id: Date.now(), text }), []);
  const dismissNotice = useCallback(() => setNotice(null), []);
  const close = () => setOpen(null);

  function switchTo(next: Tab) {
    setTab(next);
    setSelectedId(undefined);
    window.history.replaceState(null, "", window.location.pathname);
  }

  function select(trip: Trip) {
    setSelectedId(trip.id);
    window.history.replaceState(null, "", `?trip=${trip.id}`);
  }

  function done(text: string) {
    setOpen(null);
    show(text);
  }

  const actions: TripActions = {
    open: (trip, item) => setOpen({ kind: "item", tripId: trip.id, itemId: item.id }),
    recreate: (trip) => setOpen({ kind: "recreate", trip }),
    edit: none,
    merge: none,
    remove: none,
    moveItem: none,
    redateItem: none,
    removeItem: none,
    checkout: none,
    findMore: none,
  };

  if (trips.isPending) return <p className="text-sm text-muted">Loading your trips…</p>;
  if (trips.isError) {
    return (
      <p role="alert" className="text-sm text-danger">
        {trips.error.message}
      </p>
    );
  }

  // Until the switch is used, the tab is the one holding the trip from `?trip=`.
  const linked = trips.data.find((trip) => trip.id === expandTripId);
  const shownTab = tab ?? (linked && tripPhase(linked) === "past" ? "past" : "upcoming");
  const groups = shownTab === "cancelled" ? [] : groupTrips(trips.data, shownTab);
  const ordered = groups.flatMap((group) => group.trips);
  const selected = ordered.find((trip) => trip.id === selectedId) ?? ordered[0];
  const panelTrip = open?.kind === "item" ? trips.data.find((trip) => trip.id === open.tripId) : undefined;
  const panelItem = open?.kind === "item" ? panelTrip?.items.find((item) => item.id === open.itemId) : undefined;

  return (
    <>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Show trips">
        <Pill on={shownTab === "upcoming"} onClick={() => switchTo("upcoming")} data-testid="trips-tab-upcoming">
          Upcoming
        </Pill>
        <Pill on={shownTab === "past"} onClick={() => switchTo("past")} data-testid="trips-tab-past">
          Past
        </Pill>
        <Pill on={shownTab === "cancelled"} onClick={() => switchTo("cancelled")} data-testid="trips-tab-cancelled">
          Cancelled
        </Pill>
      </div>

      {ordered.length > 0 ? (
        <div className="grid gap-gutter lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-start">
          <CartTripNav
            groups={groups}
            selectedId={selected?.id}
            onSelect={select}
            detail={tabDetail}
            label={shownTab === "past" ? "Your past trips" : "Your upcoming trips"}
            grouped
            count={bookedCount}
          />
          {selected && <TripDetails key={selected.id} trip={selected} actions={actions} mode="trips" />}
        </div>
      ) : shownTab === "cancelled" ? (
        <CancelledBookings />
      ) : shownTab === "past" ? (
        <Card edge="line" data-testid="trips-past-empty">
          <p className="p-card text-sm text-muted">No past trips yet. A booked trip moves here once it&apos;s over.</p>
        </Card>
      ) : (
        <Card edge="line" data-testid="trips-empty">
          <CardBody pad="lg" className="flex flex-col items-start gap-3">
            <p className="font-semibold">{trips.data.length === 0 ? "No booked trips yet" : "No upcoming trips"}</p>
            <p className="text-sm text-muted">
              Trips show here once something in them is booked. Your cart has the trips you&apos;re still planning.
            </p>
            <div className="flex flex-wrap gap-2">
              <ButtonLink href="/cart" size="sm">
                Open your cart
              </ButtonLink>
              <Button size="sm" variant="soft" data-testid="new-trip" onClick={() => setOpen({ kind: "new" })}>
                + Plan a new trip
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {panelTrip && panelItem && (
        <CartItemPanel
          trip={panelTrip}
          item={panelItem}
          actions={actions}
          onEditBooking={(booking) => setOpen({ kind: "change", item: panelItem, booking })}
          onCancelBooking={(booking) => setOpen({ kind: "cancel", booking })}
          onBookAgain={(item) => {
            setOpen(null);
            add({
              listingId: item.listing.id,
              title: item.listing.title,
              range: RANGE_TYPES.has(item.booking_type),
              quantity: item.quantity,
            });
          }}
          onClose={close}
        />
      )}

      {open?.kind === "change" && (
        <ChangeBookingSheet
          item={open.item}
          booking={open.booking}
          onClose={close}
          onSent={(booking) => done(`Change sent to the partner · ${booking.listing.title}`)}
        />
      )}

      {open?.kind === "cancel" && (
        <CancelDialog
          booking={open.booking}
          onClose={close}
          onCancelled={(booking) => done(`Cancelled ${booking.listing.title}`)}
        />
      )}

      {open?.kind === "recreate" && (
        <RecreateTripSheet
          trip={open.trip}
          onClose={close}
          onCopied={(copied) => {
            done(recreatedNotice(copied));
            router.push(`/cart?trip=${copied.trip.id}`);
          }}
        />
      )}

      {open?.kind === "new" && (
        <NewTripSheet onClose={close} onCreated={(trip) => router.push(`/cart?trip=${trip.id}`)} />
      )}

      <Toast data-testid="trips-toast" message={notice?.text ?? null} id={notice?.id} onDismiss={dismissNotice} />
    </>
  );
}
