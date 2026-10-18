"use client";

import Link from "next/link";
import { createContext, useContext, useState, type ComponentProps, type ReactNode } from "react";
import { withDates } from "@/components/trips/trip-dates";
import { LAUNCH_AREA, startTripHref } from "./launch-area";

// What the home hero's search holds, for the rest of the hero (RAA-130): the trip dates and
// guests as a query ("?from=…&to=…&guests=2", or ""), so the category pills keep them; the
// destination in Where, or the launch area when Where holds none, so the pills open it; where its
// button starts a trip, or null when it searches instead, so the note under it can say what
// pressing it does and a phone's own button can go there; and what Where holds, for the pill a
// phone shows in its place (HeroSearch).
type HeroTripState = { carry: string; trip: string | null; area: { slug: string; name: string }; where: string };

const DEFAULT: HeroTripState = {
  carry: "",
  trip: startTripHref(LAUNCH_AREA.slug),
  area: { slug: LAUNCH_AREA.slug, name: LAUNCH_AREA.name },
  where: LAUNCH_AREA.name,
};

const HeroTripContext = createContext<{ state: HeroTripState; set: (next: HeroTripState) => void } | null>(null);

export function HeroTrip({ children }: { children: ReactNode }) {
  const [state, set] = useState<HeroTripState>(DEFAULT);
  return <HeroTripContext.Provider value={{ state, set }}>{children}</HeroTripContext.Provider>;
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
