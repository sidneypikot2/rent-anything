"use client";

import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Toast } from "@/components/ui/toast";
import { getSession, useSession } from "@/lib/auth/session";
import { EditTripSheet, type EditFocus } from "./edit-trip-sheet";
import { formatDateRange } from "./format";
import { SignInSheet } from "./sign-in-sheet";
import { currentTrips, useAddTripItem, useFetchTrips, type AddRequest, type Trip } from "./use-trips";
import { WhichTripSheet } from "./which-trip-sheet";

// An add kept through sign-in: the page it started on, so it finishes there and nowhere
// else, and when, so one given up on doesn't come back later in the session.
type PendingAdd = AddRequest & { path: string; savedAt: number };

const PENDING_KEY = "trip-pending-add";
const PENDING_TTL_MS = 30 * 60 * 1000;

// False when storage is blocked: then only the sign-in sheet can finish the add.
function savePending(pending: PendingAdd) {
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));
    return true;
  } catch {
    return false;
  }
}

function clearPending() {
  try {
    sessionStorage.removeItem(PENDING_KEY);
  } catch {
    // Nothing was saved.
  }
}

// The pending add for this page, taken so it runs once. One for another page stays for
// that page; an expired one is dropped.
function takePending(pathname: string): PendingAdd | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    const pending = raw ? (JSON.parse(raw) as PendingAdd) : null;
    if (!pending) return null;
    if (Date.now() - pending.savedAt >= PENDING_TTL_MS) {
      clearPending();
      return null;
    }
    if (new URL(pending.path, window.location.origin).pathname !== pathname) return null;
    clearPending();
    return pending;
  } catch {
    return null;
  }
}

// What the toast says: an add or a save (with the trip, for Rename and Change dates), or
// an error. The id restarts the toast's timer for each one.
type Notice = { id: number; text: string; trip?: Trip };

type Context = {
  // Starts adding a listing: sign-in first when signed out, then the which-trip sheet
  // when the guest already has trips.
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

// The add-to-trip flow for the listings on a page (RAA-66): sign-in before the first add,
// the which-trip sheet, the toast, and the edit-trip sheet it leads to.
export function TripAddProvider({ children }: { children: ReactNode }) {
  const session = useSession();
  const pathname = usePathname();
  const fetchTrips = useFetchTrips();
  const { mutateAsync: addItem } = useAddTripItem();
  const [signingIn, setSigningIn] = useState<{ pending: PendingAdd; saved: boolean } | null>(null);
  const [choosing, setChoosing] = useState<{ request: AddRequest; trips: Trip[] } | null>(null);
  const [busyListingId, setBusyListingId] = useState<number | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [editing, setEditing] = useState<{ trip: Trip; focus: EditFocus } | null>(null);
  // One add at a time: a second tap while one is under way (or its sheet is open) waits.
  const inFlight = useRef(false);

  const show = useCallback((text: string, trip?: Trip) => setNotice({ id: Date.now(), text, trip }), []);

  const added = useCallback(
    (trip: Trip, before?: Trip) => {
      const grew = before && (before.starts_on !== trip.starts_on || before.ends_on !== trip.ends_on);
      const dates = grew && formatDateRange(trip.starts_on, trip.ends_on);
      show(dates ? `Added to ${trip.name} · now ${dates}` : `Added to ${trip.name}`, trip);
    },
    [show],
  );

  // Signed in: with no trips, the add creates one straight away; otherwise the guest picks.
  const start = useCallback(
    async (request: AddRequest, userId: number) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setBusyListingId(request.listingId);
      setNotice(null);
      let sheetOpen = false;
      try {
        const trips = currentTrips(await fetchTrips(userId));
        if (trips.length > 0) {
          setChoosing({ request, trips });
          sheetOpen = true;
        } else {
          added(await addItem({ request, tripId: null }));
        }
      } catch (caught) {
        show(caught instanceof Error ? caught.message : "Couldn't add it to your trip. Try again.");
      } finally {
        setBusyListingId(null);
        // An open sheet is still this add; closing it frees the next one.
        if (!sheetOpen) inFlight.current = false;
      }
    },
    [fetchTrips, addItem, added, show],
  );

  const add = useCallback(
    (request: AddRequest) => {
      if (session === undefined) return;
      if (session === null) {
        const pending = {
          ...request,
          path: `${window.location.pathname}${window.location.search}`,
          savedAt: Date.now(),
        };
        setSigningIn({ pending, saved: savePending(pending) });
        return;
      }
      if (session.user.role === "guest") void start(request, session.user.id);
    },
    [session, start],
  );

  // Back from /register (or a reload) with an add kept through sign-in: finish it here.
  // Taking it clears it, so it runs once.
  const guestId = session?.user.role === "guest" ? session.user.id : undefined;
  useEffect(() => {
    if (guestId === undefined) return;
    const pending = takePending(pathname);
    if (!pending) return;
    const { listingId, title, range, startsOn, endsOn, quantity } = pending;
    // The add is a request to the API that sets state as it goes, not render state, so it
    // starts after the effect rather than inside it.
    queueMicrotask(() => void start({ listingId, title, range, startsOn, endsOn, quantity }, guestId));
  }, [guestId, pathname, start]);

  const dismissNotice = useCallback(() => setNotice(null), []);
  const closeChoosing = useCallback(() => {
    setChoosing(null);
    inFlight.current = false;
  }, []);

  function edit(trip: Trip, focus: EditFocus) {
    setEditing({ trip, focus });
    setNotice(null);
  }

  const noticeTrip = notice?.trip;

  return (
    <TripAddContext.Provider value={{ add, busyListingId }}>
      {children}

      <SignInSheet
        open={signingIn !== null}
        next={signingIn?.pending.path}
        onClose={() => {
          // Dismissed: drop the add. The native dialog also reports a close after a
          // sign-in, when signingIn is already null and the effect above has taken it.
          if (signingIn === null) return;
          clearPending();
          setSigningIn(null);
        }}
        onSignedIn={() => {
          // The session is saved by now. The effect above picks a saved add up; with
          // storage blocked, the add finishes from here.
          const user = getSession()?.user;
          if (signingIn && !signingIn.saved && user?.role === "guest") void start(signingIn.pending, user.id);
          setSigningIn(null);
        }}
      />

      {choosing && (
        <WhichTripSheet
          request={choosing.request}
          trips={choosing.trips}
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

      <Toast
        data-testid="trip-toast"
        message={notice?.text ?? null}
        id={notice?.id}
        onDismiss={dismissNotice}
        actions={
          noticeTrip && (
            <>
              <button type="button" onClick={() => edit(noticeTrip, "name")} className="hover:underline">
                Rename
              </button>
              <button type="button" onClick={() => edit(noticeTrip, "dates")} className="hover:underline">
                Change dates
              </button>
            </>
          )
        }
      />
    </TripAddContext.Provider>
  );
}
