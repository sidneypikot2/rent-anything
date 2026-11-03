"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import type { AreaCard } from "@/api/discovery";
import { fetchAreas } from "@/components/discovery/search-box";
import { ArrowGlyph, BagGlyph, ChevronGlyph, SuitcaseGlyph } from "@/components/discovery/tag-glyphs";
import { LAUNCH_AREA } from "@/components/landing/launch-area";
import { TripChoiceSheet } from "@/components/landing/trip-choice-sheet";
import { chooseTrip } from "@/components/trips/chosen-trip";
import { currentTrips, useTrips, type Trip } from "@/components/trips/use-trips";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { useSession } from "@/lib/auth/session";

// The home hero's way in (the team's A1), two actions: Browse the launch area (its area page),
// for a guest still looking, or, under "Decided yet?", two answers. Plan a whole trip opens the
// guided planner (/plan: where, when and who, then the checklist); Book a thing or two opens
// today's search in its place (`search`), with a way back to the choice. No other start
// competes with them. Book a thing or two is a link to `/?book=one` (`initial`), so a tap
// before the page is interactive still opens the search; once it is, the switch happens in
// place and the URL follows.
// Plan a whole trip, for a guest who already has trips, first asks which (TripChoiceSheet) and
// leaves the home page only once they answer: a new trip goes to step 1, one of theirs to its
// checklist when it has dates, else to step 1 filled from it (`planHref`).
export function HeroPlanChoice({ search, initial = false }: { search: ReactNode; initial?: boolean }) {
  const [booking, setBookingState] = useState(initial);
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
  const setBooking = (on: boolean) => {
    setBookingState(on);
    window.history.replaceState(window.history.state, "", on ? "/?book=one" : "/");
  };
  if (booking)
    return (
      <div className="flex flex-col gap-3">
        {search}
        <button
          type="button"
          onClick={() => setBooking(false)}
          className="flex min-h-11 items-center gap-1.5 self-start text-sm font-semibold text-sky-pale underline-offset-4 hover:underline"
        >
          <ChevronGlyph direction="left" className="size-4" />
          Plan a whole trip instead
        </button>
      </div>
    );
  return (
    <div className="flex w-full max-w-xl flex-col gap-3" data-testid="plan-choice">
      <ButtonLink
        href={`/${LAUNCH_AREA.slug}`}
        variant="paper"
        arrow
        className="max-sm:w-full sm:self-start"
        data-testid="browse-launch-area"
      >
        Browse {LAUNCH_AREA.name}
      </ButtonLink>
      <p className="mt-2 text-base font-bold text-white">Decided yet?</p>
      <Choice
        href="/plan"
        onClick={() => {
          if (isGuest) void areas();
          setAsking(true);
        }}
        icon={<SuitcaseGlyph className="size-6" />}
        title="Plan a whole trip"
        note="Stay, getting there, tours and the places you want to see. About 2 minutes."
        testId="plan-whole-trip"
        lead
      />
      <Choice
        href="/?book=one"
        onClick={() => setBooking(true)}
        icon={<BagGlyph className="size-6" />}
        title="Book a thing or two"
        note="A scooter, a van, a tour or a room."
        testId="plan-one-thing"
      />
      {asking && known && asks && (
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
      )}
    </div>
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

const CARD =
  "group flex min-h-20 w-full items-center gap-3 rounded-card bg-surface p-3 text-left text-foreground shadow-float transition-[box-shadow,transform] duration-500 ease-calm hover:shadow-lift motion-safe:hover:-translate-y-0.5";

function Choice({
  href,
  onClick,
  icon,
  title,
  note,
  testId,
  lead = false,
}: {
  href: string;
  onClick?: () => void;
  icon: ReactNode;
  title: string;
  note: string;
  testId: string;
  lead?: boolean;
}) {
  const body = (
    <>
      <span
        aria-hidden
        className={cn(
          "flex size-12 shrink-0 items-center justify-center rounded-control",
          lead ? "bg-primary text-white" : "bg-mist text-primary",
        )}
      >
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-bold text-navy">{title}</span>
        <span className="text-sm text-muted">{note}</span>
      </span>
      <ArrowGlyph className="size-5 shrink-0 text-primary transition-transform duration-500 ease-calm motion-safe:group-hover:translate-x-0.5" />
    </>
  );
  return (
    <Link
      href={href}
      onClick={
        onClick &&
        ((event) => {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
          event.preventDefault();
          onClick();
        })
      }
      className={cn(CARD, lead && "ring-2 ring-primary")}
      data-testid={testId}
    >
      {body}
    </Link>
  );
}
