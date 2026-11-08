"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState, type MouseEvent } from "react";
import type { AreaCard } from "@/api/discovery";
import { fetchAreas } from "@/components/discovery/search-box";
import { LAUNCH_AREA } from "@/components/landing/launch-area";
import { TripChoiceSheet } from "@/components/landing/trip-choice-sheet";
import { chooseTrip } from "@/components/trips/chosen-trip";
import { currentTrips, useTrips, type Trip } from "@/components/trips/use-trips";
import { useSession } from "@/lib/auth/session";

// Starting the guided planner from the home page. A guest who already has trips is first asked
// which (TripChoiceSheet) and leaves the home page only once they answer: a new trip goes to
// step 1, one of theirs to its checklist when it has dates, else to step 1 filled from it
// (`planHref`). Anyone else goes straight to /plan. The link stays a plain link to /plan, so a
// tap before the page is interactive, or a new-tab click, still gets there.
export function usePlanTripStart() {
  const [asking, setAsking] = useState(false);
  const router = useRouter();
  const queryClient = useQueryClient();
  const session = useSession();
  const isGuest = session?.user.role === "guest";
  const tripsQuery = useTrips(isGuest);
  const trips = currentTrips(tripsQuery.data);
  // Whether to ask is known once the session has loaded and, for a guest, their trips; a tap
  // before then waits for it rather than skipping the question.
  const known = session !== undefined && (!isGuest || tripsQuery.data !== undefined || tripsQuery.isError);
  const asks = isGuest && trips.length > 0;
  useEffect(() => {
    // Nothing to ask: on to step 1, as the link would have gone.
    if (asking && known && !asks) router.push("/plan");
  }, [asking, known, asks, router]);
  const areas = () =>
    queryClient.fetchQuery({ queryKey: ["areas"], queryFn: fetchAreas, staleTime: 5 * 60_000 }).catch(() => []);
  async function pick(choice: Trip | "new") {
    if (choice === "new") return router.push("/plan");
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
        meta="Plan one of your trips, or start a new one"
        newDetail="Pick where, when and who next"
        onPick={(choice) => {
          setAsking(false);
          void pick(choice);
        }}
        onClose={() => setAsking(false)}
      />
    ) : null;
  return { href: "/plan", onClick, sheet };
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
