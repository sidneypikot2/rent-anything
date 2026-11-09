"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ComponentProps, type MouseEvent } from "react";
import type { AreaCard } from "@/api/discovery";
import { fetchAreas } from "@/components/discovery/search-box";
import { LAUNCH_AREA } from "@/components/landing/launch-area";
import { TripChoiceSheet } from "@/components/landing/trip-choice-sheet";
import { chooseTrip } from "@/components/trips/chosen-trip";
import { useTripLinkPlaces } from "@/components/trips/trip-link";
import { useTripHere } from "@/components/trips/use-trip-here";
import type { Trip } from "@/components/trips/use-trips";
import { ButtonLink } from "@/components/ui/button";

// Starting the guided planner, from any Plan a trip. A guest who already has trips is first asked
// which (TripChoiceSheet) and leaves the page only once they answer: a new trip goes to step 1
// (`href`: /plan, or on a place's page /plan?where=<it> with the page's dates), one of theirs to
// its checklist when it has dates, else to step 1 filled from it (`planHref`). On a place's page
// (`places`) the trip it works on (`tripHere`) is picked to start with, so carrying on is one tap.
// Anyone else goes straight to `href`. The link stays a plain link to `href`, so a tap before the
// page is interactive, or a new-tab click, still gets there.
export function usePlanTripStart({ href = "/plan", places = [] }: { href?: string; places?: string[] } = {}) {
  const [asking, setAsking] = useState(false);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { session, isGuest, trips: tripsQuery, current: trips, trip: here } = useTripHere(places);
  // Whether to ask is known once the session has loaded and, for a guest, their trips; a tap
  // before then waits for it rather than skipping the question.
  const known = session !== undefined && (!isGuest || tripsQuery.data !== undefined || tripsQuery.isError);
  const asks = isGuest && trips.length > 0;
  useEffect(() => {
    // Nothing to ask: on to step 1, as the link would have gone.
    if (asking && known && !asks) router.push(href);
  }, [asking, known, asks, router, href]);
  const areas = () =>
    queryClient.fetchQuery({ queryKey: ["areas"], queryFn: fetchAreas, staleTime: 5 * 60_000 }).catch(() => []);
  async function pick(choice: Trip | "new") {
    if (choice === "new") return router.push(href);
    chooseTrip(choice.id);
    router.push(planHref(choice, await areas()));
  }
  function onClick(event: MouseEvent<HTMLAnchorElement>) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    if (isGuest) void areas();
    setAsking(true);
  }
  const sheet =
    asking && known && asks ? (
      <TripChoiceSheet
        trips={trips}
        areaName={LAUNCH_AREA.name}
        selected={here?.id}
        meta="Plan one of your trips, or start a new one"
        newDetail="Pick where, when and who next"
        onPick={(choice) => {
          setAsking(false);
          void pick(choice);
        }}
        onClose={() => setAsking(false)}
      />
    ) : null;
  return { href, onClick, sheet };
}

// A place page's Plan a trip (banner, section bar, Sample days, closing band, phone foot): a
// ButtonLink that asks which trip first, as the home's does. Its places are the page's
// (TripLinkProvider's) unless given.
export function PlanTripLink({
  href,
  places,
  ...props
}: ComponentProps<typeof ButtonLink> & { href: string; places?: string[] }) {
  const pagePlaces = useTripLinkPlaces();
  const plan = usePlanTripStart({ href, places: places ?? pagePlaces });
  return (
    <>
      <ButtonLink {...props} href={plan.href} onClick={plan.onClick} />
      {plan.sheet}
    </>
  );
}

// Where planning one of the guest's trips starts: its checklist when it has dates, else step 1
// filled from it. Its place is the destination its first item or saved place is in, else the one
// it is named after ("Bantayan Island · 4–7 Dec", as step 1 names it), else the launch area.
function planHref(trip: Trip, areas: AreaCard[]) {
  const bySlug = new Map(areas.map((area) => [area.slug, area]));
  const root = (slug: string) => {
    let area = bySlug.get(slug);
    const seen = new Set<string>();
    while (area?.parent_slug && bySlug.has(area.parent_slug) && !seen.has(area.slug)) {
      seen.add(area.slug);
      area = bySlug.get(area.parent_slug);
    }
    return area?.slug;
  };
  const slug =
    [...trip.items.map((item) => item.area.slug), ...trip.saved_landmarks.map((saved) => saved.area_slug)]
      .map(root)
      .find(Boolean) ??
    areas.find((area) => !(area.parent_slug && bySlug.has(area.parent_slug)) && trip.name.startsWith(`${area.name} ·`))
      ?.slug ??
    LAUNCH_AREA.slug;
  return trip.starts_on && trip.ends_on ? `/plan/${slug}?trip=${trip.id}` : `/plan?where=${slug}&trip=${trip.id}`;
}
