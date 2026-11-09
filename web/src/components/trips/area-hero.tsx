"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ComponentProps, type ReactNode } from "react";
import { PageBanner } from "@/components/landing/page-banner";
import { jumpToSection } from "@/components/area/area-nav";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { glassClasses } from "@/components/ui/glass";
import { ArrowGlyph } from "@/components/discovery/tag-glyphs";
import { tripOwnQuery } from "./trip-dates";
import { type Sight } from "./trip-missing";
import { TripPlan } from "./trip-plan-panel";
import { useTripHere } from "./use-trip-here";

// An area page's banner: the place's photo and name (`banner`, built on the server), and nothing about the guest's trip — the trip shows in
// What to book (Your plan) and the closing band (AreaTripBand). Out of sight it still does two
// things for the trip the page works on (useTripHere): puts the trip's own dates and guests into
// a URL that has none (a bare link, the home's place cards), so prices and the add sheet start
// from the trip; the page has no header search (`search={false}`, 2026-11-08); and mounts its guide (TripPlan), which What to book's Your
// plan opens. `starting`: arrived from the home's "Start your trip" (RAA-80), dropped from the URL.
// At its foot, one fixed lead (TripLead) saying how a trip starts and Plan
// a trip: the same whatever trips the guest has, so the banner never switches on them.
export function AreaHero({
  banner,
  areaName,
  places,
  island,
  offered,
  sights = [],
  starting = false,
  plan,
}: {
  banner: {
    photo: ComponentProps<typeof PageBanner>["photo"];
    carousel?: ComponentProps<typeof PageBanner>["carousel"];
    eyebrow: string;
    title: ReactNode;
  };
  areaName: string;
  places: string[];
  // The island this place is a town of (its top-most destination), when it is one (coversHere).
  island?: string | null;
  // The groups the place has listings in, so the plan asks only for those.
  offered: string[];
  // The places to see here and the listings that go to each, for the plan's ideas.
  sights?: Sight[];
  starting?: boolean;
  // Plan a whole trip on this place (RAA-252): the lead's main button.
  plan?: { href: string; label: string };
}) {
  const { session, isGuest, trips, trip } = useTripHere(places);
  const router = useRouter();
  const pathname = usePathname();
  const loading = isGuest && trips.isPending;

  // The shown trip's own dates and guests, into a URL that has none. Dates already in the URL stay.
  const ownQuery = trip && !loading ? tripOwnQuery(trip) : "";
  useEffect(() => {
    if (!ownQuery) return;
    const params = new URLSearchParams(window.location.search);
    if (["from", "to", "guests"].some((key) => params.has(key))) return;
    new URLSearchParams(ownQuery).forEach((value, key) => params.set(key, value));
    router.replace(`${pathname}?${params}${window.location.hash}`, { scroll: false });
  }, [ownQuery, pathname, router]);

  useEffect(() => {
    if (!starting) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("start");
    window.history.replaceState(window.history.state, "", url);
  }, [starting]);

  return (
    <PageBanner
      photo={banner.photo}
      carousel={banner.carousel}
      eyebrow={banner.eyebrow}
      title={banner.title}
      search={false}
    >
      {/* A partner or admin browsing sees the place alone. */}
      {!(session && !isGuest) && <TripLead plan={plan} />}
      {!loading && trip && (
        <TripPlan trip={trip} places={places} island={island} offered={offered} sights={sights} placeName={areaName} />
      )}
    </PageBanner>
  );
}

// Which layout a piece belongs to. Compact is a phone (under the search breakpoint) or a short
// window (`fold`); the rest is wide. CSS picks, so the server's render already matches the screen.
const WIDE_ONLY = "max-search:hidden fold:hidden";
const COMPACT_ONLY = "hidden max-search:flex fold:flex";

// How a trip starts here, and Plan a trip. Wide, one forest glass card;
// compact, Plan a trip as the main button over one slim row, so a phone's first screen has both.
function TripLead({ plan }: { plan?: { href: string; label: string } }) {
  return (
    <>
      <div
        aria-label="Your trip"
        data-testid="trip-lead"
        className={cn(glassClasses("forest"), "flex flex-col gap-3 rounded-card px-4 py-3 sm:px-5", WIDE_ONLY)}
      >
        <div className="flex min-w-0 flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div className="min-w-0">
            <h2 className="font-display text-lg leading-tight font-extrabold tracking-tight text-balance">
              Your trip starts with your first add
            </h2>
            <p className="mt-0.5 text-sm text-pretty text-sky-mist">
              Add what you need, then book it all from your trip.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {plan && (
              <ButtonLink
                href={plan.href}
                variant="paper"
                size="touch"
                arrow
                data-testid="plan-trip"
                className="shrink-0"
              >
                {plan.label}
              </ButtonLink>
            )}
          </div>
        </div>
      </div>
      {plan && (
        <div className={COMPACT_ONLY}>
          <ButtonLink
            href={plan.href}
            variant="paper"
            arrow
            data-testid="plan-trip-compact"
            className="w-full justify-center"
          >
            {plan.label}
          </ButtonLink>
        </div>
      )}
      <a
        href="#listings"
        onClick={jumpToSection("listings")}
        data-testid="trip-lead-compact"
        className={cn(
          glassClasses("forest"),
          COMPACT_ONLY,
          "@container min-h-11 items-center justify-between gap-3 rounded-card py-1.5 pr-4 pl-3 text-left text-sm",
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span aria-hidden className="size-2 shrink-0 rounded-full bg-sky-pale" />
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="truncate font-semibold">Start your trip here</span>
            <span className="truncate text-small text-sky-mist">Saving it is free</span>
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5 font-semibold">
          <span className="@max-[18rem]:sr-only">What to book</span>
          <ArrowGlyph className="size-4 rotate-90 text-sky-pale" />
        </span>
      </a>
    </>
  );
}
