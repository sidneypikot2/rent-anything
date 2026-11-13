"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, type MouseEvent, type ReactNode } from "react";
import { useSession } from "@/lib/auth/session";
import { chooseTrip, readChosenTrip } from "./chosen-trip";
import { tripOwnQuery } from "./trip-dates";
import { useTripHere } from "./use-trip-here";
import { currentTrips, useTrips } from "./use-trips";

// What a place's page (and a business page opened from one) carries into a listing's or a
// business's page: the place (`?place=`, whose name the header shows and whose trip an add goes
// to) and, once the guest has a trip here, that trip (`?trip=<id>`), so the page opened — often a
// new tab — adds to it without asking which trip, and shows its dates and guests.
const TripLinkContext = createContext<{ place: string; places: string[] } | null>(null);

export function TripLinkProvider({ place, places, children }: { place: string; places: string[]; children: ReactNode }) {
  return <TripLinkContext.Provider value={{ place, places }}>{children}</TripLinkContext.Provider>;
}

// The page's places (its own and the ones inside it), or none outside a TripLinkProvider.
export function useTripLinkPlaces() {
  return useContext(TripLinkContext)?.places ?? NO_PLACES;
}
const NO_PLACES: string[] = [];

const CARRIED = /^\/(listings|businesses)\/\d+/;

// The page's links to listings and businesses with the place and the trip added; anything else,
// or outside a TripLinkProvider, as it is.
export function useTripHref() {
  const context = useContext(TripLinkContext);
  const { trip } = useTripHere(context?.places ?? []);
  return (href: string) => {
    if (!context || !CARRIED.test(href)) return href;
    const hash = href.indexOf("#");
    const [path, fragment] = hash < 0 ? [href, ""] : [href.slice(0, hash), href.slice(hash)];
    const [pathname, search = ""] = path.split("?");
    const params = new URLSearchParams(search);
    if (!params.has("place")) params.set("place", context.place);
    if (trip) params.set("trip", String(trip.id));
    return `${pathname}?${params}${fragment}`;
  };
}

// A link to a listing's row in What to book (#listing-<id>: a place to see's tours): on the What to
// book page (`/<place>/book`) a jump to the row, again on a second tap; on the place's page (or
// outside a TripLinkProvider's place) that page, with the page's dates, guests and trip.
export function useRowLink() {
  const context = useContext(TripLinkContext);
  const pathname = usePathname();
  const router = useRouter();
  const book = context ? `/${context.place}/book` : null;
  const here = !book || pathname === book;
  return (id: number, before?: () => void) => {
    const hash = `#listing-${id}`;
    return {
      href: here ? hash : `${book}${hash}`,
      onClick: (event: MouseEvent<HTMLAnchorElement>) => {
        before?.();
        if (here) {
          // The same row again: no hashchange would fire, so send one.
          if (window.location.hash !== hash) return;
          event.preventDefault();
          window.dispatchEvent(new HashChangeEvent("hashchange"));
          return;
        }
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
        event.preventDefault();
        router.push(`${book}${window.location.search}${hash}`);
      },
    };
  };
}

// A listing's or business's page opened with `?trip=<id>`: that trip, when it is one of the
// guest's current trips, becomes the one this tab works on (chosen-trip.ts), so its adds go to it;
// and a URL with no dates or guests takes the trip's own, as a place's banner does. Another
// account's or a finished trip's id is ignored. `urlDates={false}` (the planner) only chooses the
// trip: its pages carry the trip's dates in their links, and a late `router.replace` there would
// land after the guest picked a step, dropping `?choose=` and remounting the step (RAA-323).
export function AdoptTrip({ id, urlDates = true }: { id: number; urlDates?: boolean }) {
  const isGuest = useSession()?.user.role === "guest";
  const trips = useTrips(isGuest);
  const trip = currentTrips(trips.data).find((each) => each.id === id);
  const router = useRouter();
  const pathname = usePathname();
  const ownQuery = trip ? tripOwnQuery(trip) : "";
  useEffect(() => {
    if (!trip) return;
    if (readChosenTrip() !== trip.id) chooseTrip(trip.id);
    if (!urlDates || !ownQuery) return;
    const params = new URLSearchParams(window.location.search);
    if (["from", "to", "guests"].some((key) => params.has(key))) return;
    new URLSearchParams(ownQuery).forEach((value, key) => params.set(key, value));
    router.replace(`${pathname}?${params}${window.location.hash}`, { scroll: false });
  }, [trip, ownQuery, urlDates, pathname, router]);
  return null;
}
