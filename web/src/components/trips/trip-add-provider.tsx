"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { useToast } from "@/components/ui/toast";
import { startGuestSession } from "@/lib/auth/actions";
import { useSession } from "@/lib/auth/session";
import { formatDateRange } from "./format";
import { readChosenTrip } from "./chosen-trip";
import { showAddedBadge } from "./added-badge";
import { tripHere } from "./use-trip-here";
import { currentTrips, useFetchTrips, type AddRequest, type Trip } from "./use-trips";
import { WhichTripSheet } from "./which-trip-sheet";

type Context = {
  // Starts adding a listing: the add sheet, after making a guest session when signed out.
  add: (request: AddRequest) => void;
  // A guest's add is under way (the trips are being fetched or the item posted).
  busyListingId: number | null;
  // The listing last added on this page, so the list can bring its row back into view.
  lastAdded: { listingId: number; at: number } | null;
};

const TripAddContext = createContext<Context | null>(null);

export function useTripAdd() {
  const context = useContext(TripAddContext);
  if (!context) throw new Error("useTripAdd needs a TripAddProvider");
  return context;
}

// The flow when the component may sit outside one (a listing's side panel in the cart): null there.
export function useOptionalTripAdd() {
  return useContext(TripAddContext);
}

// The add-to-trip flow for the listings on a page (RAA-66): a guest session made quietly on a
// signed-out first add (RAA-177: no account needed to plan or book), the add sheet, and the
// "Added to trip" badge that confirms it. On a place's page (`places`: its place and the places inside it) every add goes to the trip its banner shows (tripHere),
// or starts a new one, which then becomes the trip worked on: the sheet asks only the dates and
// guests, so an add never lands in another trip. Elsewhere the sheet asks which trip.
export function TripAddProvider({ children, places }: { children: ReactNode; places?: string[] }) {
  const session = useSession();
  const fetchTrips = useFetchTrips();
  const [choosing, setChoosing] = useState<{ request: AddRequest; trips: Trip[]; target?: Trip | "new" } | null>(
    null,
  );
  const [busyListingId, setBusyListingId] = useState<number | null>(null);
  const [lastAdded, setLastAdded] = useState<Context["lastAdded"]>(null);
  const toast = useToast();
  // One add at a time: a second tap while one is under way (or its sheet is open) waits.
  const inFlight = useRef(false);
  // What the last add put where, for screen readers (the flight is only decoration).
  const [announced, setAnnounced] = useState("");

  // An add is confirmed by a centred "Added to trip" badge that goes into the header's cart, never a toast: on a phone a
  // toast covered the card just tapped (2026-10-29). The live region names what was added, not
  // only where: "Added Beachfront nipa cottage to Bantayan Island".
  const added = useCallback((request: AddRequest, trip: Trip, before?: Trip) => {
    const grew = before && (before.starts_on !== trip.starts_on || before.ends_on !== trip.ends_on);
    const dates = grew && formatDateRange(trip.starts_on, trip.ends_on);
    // Gear counted into a line already there says the new count: "now 3 in Bantayan Island".
    const line = trip.items.find(
      (item) => item.listing.id === request.listingId && item.listing.group === "gear" && !item.booking && item.starts_on === (request.startsOn ?? null),
    );
    const what = line && line.quantity > 1 ? `${request.title}, now ${line.quantity} in` : `${request.title} to`;
    setAnnounced(`Added ${what} ${trip.name}${dates ? ` · now ${dates}` : ""}`);
    setLastAdded({ listingId: request.listingId, at: Date.now() });
    // After the sheet has gone, so the badge's way to the cart is read from the settled page.
    requestAnimationFrame(showAddedBadge);
  }, []);

  // Signed in: the add sheet, with the guest's trips to pick from.
  const start = useCallback(
    async (request: AddRequest, userId: number) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setBusyListingId(request.listingId);
      toast.dismiss();
      let sheetOpen = false;
      try {
        // The sheet confirms every add: the listing, its dates and guests, and the trip it goes
        // to (a new one when the guest has none yet).
        const trips = currentTrips(await fetchTrips(userId));
        // Read now, not from render: after sign-in the trips have only just been fetched.
        const target = places && (tripHere(trips, readChosenTrip(), places) ?? "new");
        setChoosing({ request, trips, target });
        sheetOpen = true;
      } catch (caught) {
        toast.show(caught instanceof Error ? caught.message : "Couldn't add it to your trip. Try again.", {
          tone: "danger",
          "data-testid": "trip-toast",
        });
      } finally {
        setBusyListingId(null);
        // An open sheet is still this add; closing it frees the next one.
        if (!sheetOpen) inFlight.current = false;
      }
    },
    [fetchTrips, toast, places],
  );

  const add = useCallback(
    (request: AddRequest) => {
      if (session === undefined) return;
      if (session === null) {
        // No sign-in first: a guest with no account owns the trip until checkout asks who
        // they are.
        if (inFlight.current) return;
        inFlight.current = true;
        setBusyListingId(request.listingId);
        void startGuestSession().then((result) => {
          inFlight.current = false;
          if (result.ok) return start(request, result.user.id);
          setBusyListingId(null);
          toast.show(result.error, { tone: "danger", "data-testid": "trip-toast" });
        });
        return;
      }
      if (session.user.role === "guest") void start(request, session.user.id);
    },
    [session, start, toast],
  );

  const closeChoosing = useCallback(() => {
    setChoosing(null);
    inFlight.current = false;
  }, []);

  return (
    <TripAddContext.Provider value={{ add, busyListingId, lastAdded }}>
      {children}

      {choosing && (
        <WhichTripSheet
          request={choosing.request}
          trips={choosing.trips}
          target={choosing.target}
          onClose={closeChoosing}
          onAdded={(trip, before) => {
            const { request } = choosing;
            closeChoosing();
            added(request, trip, before);
          }}
        />
      )}

      <p aria-live="polite" className="sr-only" data-testid="trip-added">
        {announced}
      </p>
    </TripAddContext.Provider>
  );
}
