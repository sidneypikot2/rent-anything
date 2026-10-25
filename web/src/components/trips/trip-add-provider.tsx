"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { useToast } from "@/components/ui/toast";
import { startGuestSession } from "@/lib/auth/actions";
import { useSession } from "@/lib/auth/session";
import { EditTripSheet, type EditFocus } from "./edit-trip-sheet";
import { formatDateRange } from "./format";
import { readChosenTrip } from "./chosen-trip";
import { tripHere } from "./use-trip-here";
import { currentTrips, useFetchTrips, type AddRequest, type Trip } from "./use-trips";
import { WhichTripSheet } from "./which-trip-sheet";

type Context = {
  // Starts adding a listing: the add sheet, after making a guest session when signed out.
  add: (request: AddRequest) => void;
  // A guest's add is under way (the trips are being fetched or the item posted).
  busyListingId: number | null;
};

const TripAddContext = createContext<Context | null>(null);

export function useTripAdd() {
  const context = useContext(TripAddContext);
  if (!context) throw new Error("useTripAdd needs a TripAddProvider");
  return context;
}

// The add-to-trip flow for the listings on a page (RAA-66): a guest session made quietly on a
// signed-out first add (RAA-177: no account needed to plan or book), the add sheet, the toast,
// and the edit-trip sheet it leads to. On a place's page (`places`: its place and the places inside it) every add goes to the trip its banner shows (tripHere),
// or starts a new one, which then becomes the trip worked on: the sheet asks only the dates and
// guests, so an add never lands in another trip. Elsewhere the sheet asks which trip.
export function TripAddProvider({ children, places }: { children: ReactNode; places?: string[] }) {
  const session = useSession();
  const fetchTrips = useFetchTrips();
  const [choosing, setChoosing] = useState<{ request: AddRequest; trips: Trip[]; target?: Trip | "new" } | null>(
    null,
  );
  const [busyListingId, setBusyListingId] = useState<number | null>(null);
  const toast = useToast();
  const [editing, setEditing] = useState<{ trip: Trip; focus: EditFocus } | null>(null);
  // One add at a time: a second tap while one is under way (or its sheet is open) waits.
  const inFlight = useRef(false);

  const edit = useCallback(
    (trip: Trip, focus: EditFocus) => {
      setEditing({ trip, focus });
      toast.dismiss();
    },
    [toast],
  );

  // The toast says what was added or saved, with the trip for Rename, Change dates and View trip.
  const show = useCallback(
    (text: string, trip: Trip) =>
      toast.show(text, {
        "data-testid": "trip-toast",
        actions: (
          <>
            <button type="button" onClick={() => edit(trip, "name")} className="hover:underline">
              Rename
            </button>
            <button type="button" onClick={() => edit(trip, "dates")} className="hover:underline">
              Change dates
            </button>
            <Link href={`/cart?trip=${trip.id}`} data-testid="trip-toast-view" className="hover:underline">
              View trip
            </Link>
          </>
        ),
      }),
    [toast, edit],
  );

  const added = useCallback(
    (trip: Trip, before?: Trip) => {
      const grew = before && (before.starts_on !== trip.starts_on || before.ends_on !== trip.ends_on);
      const dates = grew && formatDateRange(trip.starts_on, trip.ends_on);
      show(dates ? `Added to ${trip.name} · now ${dates}` : `Added to ${trip.name}`, trip);
    },
    [show],
  );

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
    <TripAddContext.Provider value={{ add, busyListingId }}>
      {children}

      {choosing && (
        <WhichTripSheet
          request={choosing.request}
          trips={choosing.trips}
          target={choosing.target}
          onClose={closeChoosing}
          onAdded={(trip, before) => {
            closeChoosing();
            added(trip, before);
          }}
        />
      )}

      {editing && (
        <EditTripSheet
          trip={editing.trip}
          focus={editing.focus}
          onClose={() => setEditing(null)}
          onSaved={(trip) => {
            setEditing(null);
            show(`Saved ${trip.name}`, trip);
          }}
        />
      )}
    </TripAddContext.Provider>
  );
}
