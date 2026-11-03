"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, type ReactNode } from "react";
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

// A listing's or business's page opened with `?trip=<id>`: that trip, when it is one of the
// guest's current trips, becomes the one this tab works on (chosen-trip.ts), so its adds go to it;
// and a URL with no dates or guests takes the trip's own, as a place's banner does. Another
// account's or a finished trip's id is ignored.
export function AdoptTrip({ id }: { id: number }) {
  const isGuest = useSession()?.user.role === "guest";
  const trips = useTrips(isGuest);
  const trip = currentTrips(trips.data).find((each) => each.id === id);
  const router = useRouter();
  const pathname = usePathname();
  const ownQuery = trip ? tripOwnQuery(trip) : "";
  useEffect(() => {
    if (!trip) return;
    if (readChosenTrip() !== trip.id) chooseTrip(trip.id);
    if (!ownQuery) return;
    const params = new URLSearchParams(window.location.search);
    if (["from", "to", "guests"].some((key) => params.has(key))) return;
    new URLSearchParams(ownQuery).forEach((value, key) => params.set(key, value));
    router.replace(`${pathname}?${params}${window.location.hash}`, { scroll: false });
  }, [trip, ownQuery, pathname, router]);
  return null;
}
