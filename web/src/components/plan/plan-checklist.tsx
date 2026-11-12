"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useRef, useState, useSyncExternalStore } from "react";
import { businessHref, titleCardHref } from "@/components/discovery/browse-offers";
import { BOOKING_GROUPS } from "@/components/discovery/categories";
import type { PlanBusinessesPage } from "@/api/discovery";
import { MapGlyph } from "@/components/discovery/tag-glyphs";
import { formatDateRange } from "@/components/trips/format";
import { useTripHere } from "@/components/trips/use-trip-here";
import { pickedTotal, useTripQuote, type Trip } from "@/components/trips/use-trips";
import { Button, ButtonLink } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import {
  byHearts,
  distanceText,
  picksApartKm,
  rowHolds,
  stayPoint,
  PLACES_ROW,
  PLAN_ROWS,
  type PlanBusiness,
  type PlanLandmark,
  type PlanPlace,
  type RowKey,
  type StepKey,
} from "./plan-data";
import { PlanCard } from "./plan-card";
import { PlanMapView, PlanResults } from "./plan-results";
import { Pager } from "@/components/ui/pager";
import { PlanFoot } from "./plan-frame";
import { PlanPlaces } from "./plan-places";
import { PlanSee, PlanSeeMapView } from "./plan-see";
import { PlanChecklistSkeleton, PlanOptionsSkeleton } from "./plan-skeletons";
import { PlanStayChoice } from "./plan-stay";
import { PlanSteps } from "./plan-steps";
import { planSteps, planStops, reviewStepHref, tripStepHref, useSkipped } from "./plan-track";
import { PlanTripButton, PlanTripSheet } from "./plan-trip-sheet";
import { usePlanBusinesses } from "./use-plan-businesses";
import { PlanFilterDialog, PlanFilterPills } from "./plan-filters";
import { FilterButton } from "@/components/discovery/filter-controls";
import { NO_FILTERS, setCount, type Filters } from "@/components/discovery/filters";

// Step 2: the trip's checklist (our Path B) as a sticky segmented stepper (PlanSteps). The trip (with
// Change, back to step 1) sits in the plan's slim bar (PlanTripLabel); the steps, ticked once the trip has each here,
// and the one picked (else the first still open) shows its options under them — Places to see
// leads (PlanSee), as every later step uses its picks; Where you'll
// stay asks where the guest is staying first, Vehicle rental and Things to do add the places to
// see (the team's A3). Every step is optional: Skip moves on to the next (remembered in this
// browser for the trip; Review still names real gaps). An option is a business offering the step,
// an Airbnb-style card that opens its page with its options in this step (planBusinessHref); from lg the step's page sits beside a sticky map (on by default; Hide map over its corner, Show map in the step's header). The
// options come from the API a page at a time (usePlanBusinesses): the list and the map show the
// same page, with a pager. The foot sums the trip and leads to Review.
// `initial`: page 1 of the step it opens on, fetched on the server.
export function PlanChecklist({ place, choose, initial }: { place: PlanPlace; choose?: StepKey; initial?: { key: RowKey; data: PlanBusinessesPage } }) {
  const { session, trips, trip } = useTripHere(place.places);
  if (session === undefined || (session && trips.isPending)) return <PlanChecklistSkeleton />;
  if (!trip) return <NoTrip slug={place.area.slug} />;
  return <Checklist place={place} trip={trip} choose={choose} initial={initial} />;
}

// `choose`: the row to open at once (a gap's Add, or a stop on the review's track).
function Checklist({
  place,
  trip,
  choose,
  initial,
}: {
  place: PlanPlace;
  trip: Trip;
  choose?: StepKey;
  initial?: { key: RowKey; data: PlanBusinessesPage };
}) {
  // The page each step is on, kept while the guest moves between steps.
  const [pages, setPages] = useState<Partial<Record<RowKey, number>>>({});
  // Each step's own filters, What to book's for its category (plan-filters.tsx), applied on the
  // server; a change starts it on page 1.
  const [filters, setFilters] = useState<Partial<Record<RowKey, Filters>>>({});
  const [filtering, setFiltering] = useState<RowKey | null>(null);
  const filtersOf = (key: RowKey) => filters[key] ?? NO_FILTERS;
  const setFiltersOf = (key: RowKey, next: Filters) => {
    setFilters((current) => ({ ...current, [key]: next }));
    setPages((current) => ({ ...current, [key]: 1 }));
  };
  const panelRef = useRef<HTMLDivElement>(null);
  // From lg: the step's page of options beside their map instead of a plain grid; kept from step
  // to step. A gap's Add on the review opens its step this way.
  // On by default; Show map in the step's header brings it back.
  const [mapOn, setMapOn] = useState(true);
  const wide = useWide();
  const showMap = mapOn && wide;
  // Below lg: the step whose map view covers the screen (PlanMapView); null shows the list.
  const [mapView, setMapView] = useState<StepKey | null>(null);
  const [tripOpen, setTripOpen] = useState(false);
  const closeMapView = useCallback(() => setMapView(null), [setMapView]);
  const [skipped, toggleSkip] = useSkipped(trip.id);
  // The step shown under the stepper: the one the guest tapped, else the first still open. It is
  // kept in the URL (`?choose=`, replaced, never a new entry), so Back from a page opened here (a
  // listing, the shop sheet over the plan) lands on the same step. Read from the live URL: a Back
  // can show the server's render from before the step was picked, whose `choose` is stale.
  const searchParams = useSearchParams();
  const [picked, setPickedState] = useState<StepKey | null>(() => stepParam(searchParams.get("choose")) ?? choose ?? null);
  const setPicked = useCallback((key: StepKey) => {
    setPickedState(key);
    const url = new URL(window.location.href);
    url.searchParams.set("choose", key);
    window.history.replaceState(window.history.state, "", url);
  }, []);
  const quote = useTripQuote(trip.id);
  const hasPlaces = place.landmarks.length > 0;
  const { rows, done, picks } = planSteps(place, trip);
  // Places to see stays open until the guest leaves it, picks or not: its first heart ticks it,
  // and moving on then would pull the cards from under their thumb. A trip with a listing is past it.
  const current =
    hasPlaces && trip.items.length === 0 && !skipped.has("places")
      ? "places"
      : rows.find((row) => row.key !== "places" && !done.get(row.key) && !skipped.has(row.key))?.key;
  const active = rows.find((row) => row.key === (picked ?? current)) ?? rows[0];
  const onPlaces = active.key === "places";
  const hearted = new Set(picks.map((pick) => pick.slug));
  const apartKm = picksApartKm(picks);
  const stay = stayPoint(trip);
  // Places to see has no options: the query rests on the stays, disabled.
  const optionsKey: RowKey = active.key === "places" ? "stay" : active.key;
  const page = pages[optionsKey] ?? 1;
  const results = usePlanBusinesses(place.area.slug, optionsKey, page, hearted, initial, !onPlaces, filtersOf(optionsKey));
  const shown = results.data;
  // A new page: back to the top of its options, under the header.
  const turnPage = (key: RowKey) => (next: number) => {
    setPages((current) => ({ ...current, [key]: next }));
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    panelRef.current?.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
  };
  const total = pickedTotal(quote.data, trip.items);
  const landmarks = new Map(place.landmarks.map((landmark) => [landmark.slug, landmark]));
  // The stay leading the page, when every pick is close to it.
  const leader = active.key === "stay" && shown?.page === 1 ? shown.businesses[0] : undefined;
  const best =
    leader && leader.near.length === picks.length && picks.length > 0 && leader.near.every((each) => each.km <= NEAR_KM)
      ? { id: leader.pin, label: picks.length === 1 ? `Near ${picks[0].name}` : `Near all ${picks.length} picks` }
      : null;
  const cardContext = { landmarks, hearted, stay, when: formatDateRange(trip.starts_on, trip.ends_on) ?? "", best };

  // What an open step says to help pick, from the guest's own trip: the tours to the hearted
  // places, how far the hearted places no tour reaches are from the stay.
  const idle = (key: StepKey, fallback: string) => {
    if (key === "stay") return picks.length > 0 ? "Closest to the places you picked come first" : "Tell us where you're staying, or pick a stay here";
    if (key === "activity" && shown && shown.heartedTotal > 0)
      return `${shown.heartedTotal} ${shown.heartedTotal === 1 ? "tour goes" : "tours go"} to your hearted places`;
    if (key === "rental" && stay) {
      const far = place.landmarks
        .filter((landmark) => hearted.has(landmark.slug) && landmark.visitedBy.length === 0 && !landmark.boatDeparture)
        .flatMap((landmark) => {
          const km = distanceText(stay.point, landmark.location);
          return km ? [`${landmark.name} ${km}`] : [];
        });
      if (far.length > 0) return `${far.slice(0, 2).join(", ")} from your stay`;
    }
    if (key === "transfer" && place.gettingHere) return place.gettingHere.route;
    return fallback;
  };

  // The page shown of the open step, tours to hearted places first (the API's order).
  const businesses = shown?.businesses ?? [];
  const { toHearted, rest } = active.key === "activity" ? byHearts(businesses, hearted) : { toHearted: [] as PlanBusiness[], rest: businesses };
  const sorted = [...toHearted, ...rest];
  const hrefOf = (key: RowKey) => (business: PlanBusiness) => planBusinessHref(business, key, trip, place.area.slug);
  // To another step from its foot: the new panel from its top, as a long list may have scrolled.
  const goTo = (key: StepKey) => {
    setPicked(key);
    requestAnimationFrame(() => {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      panelRef.current?.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
    });
  };
  // From a place's details, over the phone's map or the list.
  const toTours =
    place.counts.activity > 0
      ? () => {
          setMapView(null);
          goTo("activity");
        }
      : undefined;
  const noListings = trip.items.length === 0;
  const nextOf = (key: StepKey) => rows[rows.findIndex((row) => row.key === key) + 1];
  const reviewHref = reviewStepHref(trip, place.area.slug);

  // The open step's options under it, a page at a time, the pager under them: a sideways row to
  // swipe on a phone, two across on a tablet (the Map pill floating over the foot opens the map
  // view), four across from lg, or with the map on, beside a map of the page's pins that sticks
  // while they scroll.
  const options = (key: RowKey) => {
    if (shown?.total === 0)
      return setCount(filtersOf(key)) > 0 ? (
        <p className="text-sm text-muted" data-testid="plan-filter-empty">
          Nothing here matches these filters.{" "}
          <button type="button" onClick={() => setFiltersOf(key, NO_FILTERS)} className="font-semibold text-link underline-offset-4 hover:underline">
            Clear
          </button>
        </p>
      ) : (
        <p className="text-sm text-muted">Nothing to book here yet. Local partners are still being added.</p>
      );
    if (!shown)
      return results.isError ? (
        <p className="text-sm text-muted">Couldn&apos;t load these just now. Try again in a moment.</p>
      ) : (
        <PlanOptionsSkeleton map={mapOn} />
      );
    const href = hrefOf(key);
    const busy = results.isPlaceholderData;
    const pager = <Pager page={shown.page} perPage={shown.perPage} total={shown.total} onPage={turnPage(key)} />;
    if (showMap) {
      return (
        <div className="flex flex-col gap-3" data-testid={`plan-options-${key}`}>
          <PlanResults
            groups={[
              { title: toHearted.length > 0 ? "Goes to your hearted places" : undefined, businesses: toHearted, count: shown.heartedTotal },
              { title: toHearted.length > 0 ? "More things to do" : undefined, businesses: rest, count: shown.total - shown.heartedTotal },
            ]}
            context={cardContext}
            stay={stay}
            hrefOf={href}
            pager={pager}
            busy={busy}
            onHide={() => setMapOn(false)}
          />
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-3">
        <ul
          aria-busy={busy || undefined}
          className={cn("grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-4", busy && "opacity-60")}
          data-testid={`plan-options-${key}`}
        >
          {sorted.map((business) => (
            <li key={business.key} className="min-w-0">
              <PlanCard business={business} href={href(business)} context={cardContext} />
            </li>
          ))}
        </ul>
        {pager}
      </div>
    );
  };

  return (
    <>
      <section className="flex flex-col gap-3 pb-8" aria-labelledby="plan-checklist-title">
        <h1 id="plan-checklist-title" className="sr-only">
          Your trip checklist
        </h1>
        <PlanSteps
          stops={planStops({ rows, done, skipped, tripHref: tripStepHref(trip, place.area.slug), reviewHref })}
          active={active.key}
          onPick={setPicked}
        />

        {(() => {
          const row = active;
          const index = rows.indexOf(row);
          const isDone = Boolean(done.get(row.key));
          const isSkipped = !isDone && skipped.has(row.key);
          const holds = isDone && row.key !== "places" ? rowHolds(trip, row.key, place) : null;
          const next = rows[index + 1];
          return (
            <div key={row.key} ref={panelRef} className="flex scroll-mt-(--plan-chrome) flex-col gap-3 rounded-card border border-line p-3 motion-safe:animate-swap-in sm:p-4" data-testid="plan-step-panel">
              <div className="flex items-start justify-between gap-3">
                {/* The title and its hint on one line from sm, so the options start higher. */}
                <div className="flex min-w-0 flex-col sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-3">
                  <h2 className={cn("font-display text-xl font-extrabold tracking-tight", isSkipped ? "text-muted" : "text-navy")}>
                    {row.key === "places" && !isSkipped ? "What do you want to see?" : row.title}
                  </h2>
                  {row.key === "places" && !isSkipped ? (
                    <p className="text-sm text-muted">
                      Heart a few. We&apos;ll find a stay near them<span className="max-sm:hidden"> and tours that go there</span>.
                    </p>
                  ) : (
                    <p className="text-sm text-muted">{holds ?? (isSkipped ? "Skipped. Undo to come back to it." : idle(row.key, row.idle))}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                {/* Filters need more than one option to choose between, or some already set. */}
                {!isSkipped && row.key !== "places" && ((shown && shown.facets.cards > 1) || setCount(filtersOf(row.key)) > 0) && (
                  <FilterButton
                    title={row.title}
                    set={setCount(filtersOf(row.key))}
                    onClick={() => setFiltering(row.key as RowKey)}
                    testId={`plan-filter-${row.key}`}
                  />
                )}
                {/* Only to bring the map back: Hide map is over the map's corner. */}
                {!isSkipped && !mapOn && row.key !== "places" && (
                  <Button
                    type="button"
                    variant="soft"
                    size="sm"
                    onClick={() => setMapOn(true)}
                    className="max-lg:hidden"
                    data-testid={`plan-show-map-${row.key}`}
                  >
                    <MapGlyph className="size-4" />
                    Show map
                  </Button>
                )}
                {(!isDone || row.key === "places") && (
                  <button
                    type="button"
                    onClick={() => {
                      // Skipping moves on to the next step; Undo stays here. With picks Places to
                      // see isn't skipped: it only moves on.
                      if (!isSkipped && next) setPicked(next.key);
                      if (!isDone) toggleSkip(row.key);
                    }}
                    className="-my-1 flex min-h-11 min-w-11 shrink-0 items-center justify-center px-1 text-sm font-semibold text-muted underline-offset-4 hover:underline"
                    data-testid={`plan-skip-${row.key}`}
                  >
                    {isSkipped ? (
                      "Undo"
                    ) : (
                      <>
                        Skip<span className="max-sm:sr-only">&nbsp;this step</span>
                      </>
                    )}
                  </button>
                )}
                </div>
              </div>
              {!isSkipped && row.key !== "places" && (
                <PlanFilterPills
                  title={row.title}
                  filters={filtersOf(row.key)}
                  facets={shown?.facets}
                  onChange={(next) => setFiltersOf(row.key as RowKey, next)}
                  onMore={() => setFiltering(row.key as RowKey)}
                />
              )}
              {!isSkipped &&
                (row.key === "places" ? (
                  <PlanSee place={place} trip={trip} hearted={hearted} stay={stay?.point ?? null} wide={wide} onTours={toTours} />
                ) : row.key === "stay" ? (
                  <>
                    {apartKm && (
                      <p className="text-sm text-muted" data-testid="plan-picks-apart">
                        Your picks are about {apartKm} km apart, so no stay is close to all of them. Stay near the ones you&apos;ll go to most.
                      </p>
                    )}
                    <PlanStayChoice trip={trip} center={place.center}>
                      {options("stay")}
                    </PlanStayChoice>
                  </>
                ) : (
                  <>
                    {options(row.key)}
                    {row.key === "rental" && <PlanPlaces mode="ride" landmarks={place.landmarks} trip={trip} stay={stay?.point ?? null} />}
                    {row.key === "activity" && <PlanPlaces mode="tours" landmarks={place.landmarks} trip={trip} stay={stay?.point ?? null} />}
                  </>
                ))}
            </div>
          );
        })()}
      </section>

      <PlanFoot
        row
        float={
          active && !skipped.has(active.key) && (onPlaces || place.counts[optionsKey] > 0) ? (
            <button
              type="button"
              onClick={() => setMapView(active.key)}
              className="flex min-h-11 items-center gap-2 rounded-full bg-navy px-5 text-sm font-semibold text-white shadow-float lg:hidden"
              data-testid={`plan-map-view-${active.key}`}
            >
              {onPlaces ? "Show on a map" : "Map"}
              <MapGlyph className="size-4" />
            </button>
          ) : undefined
        }
        summary={
          // Once the trip holds a listing, the trip opens from here at any step; Next stays the
          // main button (2026-11-10).
          !noListings ? (
            <PlanTripButton count={trip.items.length} total={total} onOpen={() => setTripOpen(true)} />
          ) : onPlaces ? (
            <PicksTray picks={picks} />
          ) : (
            <p className="text-sm text-muted">
              {picks.length > 0 ? `Your trip: ${picks.length} ${picks.length === 1 ? "place" : "places"} to see` : "Pick something from a step to review your trip."}
            </p>
          )
        }
      >
        {/* Next on every step, naming the next stop on the track; the last one's is Review. */}
        {nextOf(active.key) ? (
          <Button type="button" size="md" glyph="arrow" onClick={() => goTo(nextOf(active.key).key)} data-testid="plan-foot-next">
            Next: {nextOf(active.key).title}
          </Button>
        ) : (
          <ButtonLink href={reviewHref} size="md" glyph="arrow" data-testid="plan-review">
            Next: Review
          </ButtonLink>
        )}
      </PlanFoot>

      {!noListings && (
        <PlanTripSheet
          open={tripOpen}
          onClose={() => setTripOpen(false)}
          trip={trip}
          place={place.area.name}
          quote={quote.data}
          total={total}
          stillOpen={rows.filter((row) => row.key !== "places" && !done.get(row.key) && !skipped.has(row.key)).map((row) => row.title)}
          reviewHref={reviewHref}
        />
      )}

      {/* The map view is always the open step's: the Map pill is under it. */}
      {mapView === "places" && onPlaces && (
        <PlanSeeMapView place={place} trip={trip} hearted={hearted} stay={stay?.point ?? null} onClose={closeMapView} onTours={toTours} />
      )}
      {mapView && mapView === active.key && !onPlaces && shown && (
        <PlanMapView
          title={active.title}
          businesses={sorted}
          total={shown.total}
          page={shown.page}
          perPage={shown.perPage}
          onPage={(next) => setPages((current) => ({ ...current, [optionsKey]: next }))}
          context={cardContext}
          stay={stay}
          hrefOf={hrefOf(optionsKey)}
          onClose={closeMapView}
        />
      )}
      {filtering && filtering === optionsKey && shown && (
        <PlanFilterDialog
          title={active.title}
          slug={place.area.slug}
          stepKey={filtering}
          hearted={hearted}
          facets={shown.facets}
          filters={filtersOf(filtering)}
          onApply={(next) => {
            setFiltersOf(filtering, next);
            setFiltering(null);
          }}
          onClose={() => setFiltering(null)}
        />
      )}
    </>
  );
}

// Places to see's foot: how many are picked and which.
function PicksTray({ picks }: { picks: PlanLandmark[] }) {
  if (picks.length === 0)
    return (
      <div className="flex min-w-0 flex-col" data-testid="plan-picks-tray">
        <p className="text-sm font-bold text-navy">
          <span className="sm:hidden">None picked yet</span>
          <span className="max-sm:hidden">No places picked yet</span>
        </p>
        <p className="truncate text-small text-muted">
          <span className="sm:hidden">You can pick later</span>
          <span className="max-sm:hidden">You can skip this and pick later</span>
        </p>
      </div>
    );
  return (
    <div className="flex min-w-0 flex-col" data-testid="plan-picks-tray">
      <p className="text-sm font-bold text-navy">
        {picks.length} {picks.length === 1 ? "place" : "places"} picked
      </p>
      <p className="truncate text-small text-muted">{picks.map((pick) => pick.name).join(" · ")}</p>
    </div>
  );
}

// A card's page from a plan step (`plan=1`, so the way back returns to the plan): a title card's
// first listing (the API leads with the one going to hearted places), a stay's business on the
// step's What to book group; with the trip's dates and party, the place and the trip, so adds land in it.
function planBusinessHref(business: PlanBusiness, key: RowKey, trip: Trip, slug: string) {
  const group = BOOKING_GROUPS.find((each) => each.group === key);
  const dates = {
    from: trip.starts_on ?? undefined,
    to: trip.ends_on ?? undefined,
    guests: trip.guests,
    children: trip.children,
    infants: trip.infants,
  };
  const href = business.titled
    ? titleCardHref([{ id: business.listing_ids[0] }], dates, slug)
    : businessHref(business.id, dates, group?.id, slug);
  return `${href}${href.includes("?") ? "&" : "?"}trip=${trip.id}&plan=1`;
}

// How close every pick must be for a stay to say it's near them all.
const NEAR_KM = 3;

// No trip to plan here yet (a link shared without one, or a new browser): start at step 1.
function NoTrip({ slug }: { slug: string }) {
  return (
    <div className="flex flex-col items-start gap-3 py-10">
      <h1 className="font-display text-2xl font-extrabold tracking-tight text-navy">Let&apos;s start your trip</h1>
      <p className="text-muted">Tell us where, when and who&apos;s coming, and we&apos;ll set out what you need.</p>
      <ButtonLink href={`/plan?where=${slug}`} glyph="arrow">
        Start planning
      </ButtonLink>
    </div>
  );
}

// From lg (64rem): the options sit beside their map. Off on the server and the first paint.
const WIDE = "(min-width: 64rem)";
function subscribeWide(onChange: () => void) {
  const query = window.matchMedia(WIDE);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
function useWide() {
  return useSyncExternalStore(subscribeWide, () => window.matchMedia(WIDE).matches, () => false);
}

// A step named in the URL (`?choose=`), or null for anything else.
function stepParam(value: string | null): StepKey | null {
  return [PLACES_ROW, ...PLAN_ROWS].find((row) => row.key === value)?.key ?? null;
}
