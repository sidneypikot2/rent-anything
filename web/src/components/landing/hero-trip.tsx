"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, useContext, useState, type ComponentProps, type ReactNode } from "react";
import { chooseTrip } from "@/components/trips/chosen-trip";
import { tripOwnQuery, withDates } from "@/components/trips/trip-dates";
import { currentTrips, useTrips } from "@/components/trips/use-trips";
import { useSession } from "@/lib/auth/session";
import { LAUNCH_AREA, START_TRIP, startTripHref } from "./launch-area";
import { TripChoiceSheet } from "./trip-choice-sheet";

// What the home hero's search holds, for the rest of the hero (RAA-130): the trip dates and
// guests as a query ("?from=…&to=…&guests=2", or ""), so the category pills keep them; the
// destination in Where, or the launch area when Where holds none, so the pills open it; where its
// button starts a trip, or null when it searches instead, so the note under it can say what
// pressing it does and a phone's own button can go there; and what Where holds, for the pill a
// phone shows in its place (HeroSearch), and where its Search takes what Where holds (`search`).
type HeroTripState = {
  carry: string;
  trip: string | null;
  area: { slug: string; name: string };
  where: string;
  search: string;
};

const DEFAULT: HeroTripState = {
  carry: "",
  trip: startTripHref(LAUNCH_AREA.slug),
  area: { slug: LAUNCH_AREA.slug, name: LAUNCH_AREA.name },
  where: LAUNCH_AREA.name,
  search: `/${LAUNCH_AREA.slug}`,
};

// `label`: the button's words for this guest: Start your trip, or continue when they have trips.
type StartTrip = { asks: boolean; label: string; start: (href: string, carry: string) => void };

const HeroTripContext = createContext<{
  state: HeroTripState;
  set: (next: HeroTripState) => void;
  startTrip: StartTrip;
} | null>(null);

// Start your trip, for a guest who already has trips, first asks which one (TripChoiceSheet):
// a trip of theirs opens the destination with that trip's dates and guests, and its adds go to
// it; a new one opens it with the search's dates and the started banner. The choice lasts for the tab (chosen-trip.ts).
export function HeroTrip({ children }: { children: ReactNode }) {
  const [state, set] = useState<HeroTripState>(DEFAULT);
  const [asking, setAsking] = useState<{ href: string; carry: string } | null>(null);
  const router = useRouter();
  const isGuest = useSession()?.user.role === "guest";
  const trips = currentTrips(useTrips(isGuest).data);
  const asks = isGuest && trips.length > 0;
  const startTrip: StartTrip = {
    asks,
    label: !asks ? START_TRIP.action : trips.length === 1 ? START_TRIP.continueOne : START_TRIP.continueMany,
    start: (href, carry) => (asks ? setAsking({ href, carry }) : router.push(withDates(href, carry))),
  };
  return (
    <HeroTripContext.Provider value={{ state, set, startTrip }}>
      {children}
      {asking && (
        <TripChoiceSheet
          trips={trips}
          areaName={state.area.name}
          onClose={() => setAsking(null)}
          onPick={(choice) => {
            setAsking(null);
            if (choice === "new") {
              chooseTrip("new");
              router.push(withDates(asking.href, asking.carry));
            } else {
              chooseTrip(choice.id);
              const own = tripOwnQuery(choice);
              router.push(withDates(asking.href.replace(/[?&]start=trip/, ""), own || asking.carry));
            }
          }}
        />
      )}
    </HeroTripContext.Provider>
  );
}

// How the hero's button starts a trip: straight there, or through the which-trip question.
export function useStartTrip(): StartTrip {
  const router = useRouter();
  return (
    useContext(HeroTripContext)?.startTrip ?? {
      asks: false,
      label: START_TRIP.action,
      start: (href, carry) => router.push(withDates(href, carry)),
    }
  );
}

// The hero's state, as the search last reported it; outside the hero, the defaults.
export function useHeroTrip() {
  return useContext(HeroTripContext)?.state ?? DEFAULT;
}

// For the search, to report its state; null outside the hero.
export function useHeroTripReport() {
  return useContext(HeroTripContext)?.set ?? null;
}

// A link from the home page that keeps the dates and guests picked in the hero's search, so a
// destination or activity card below it opens with them, as the pills do; anywhere else, a link.
export function HeroTripLink({ href, ...props }: Omit<ComponentProps<typeof Link>, "href"> & { href: string }) {
  const { carry } = useHeroTrip();
  return <Link href={withDates(href, carry)} {...props} />;
}
