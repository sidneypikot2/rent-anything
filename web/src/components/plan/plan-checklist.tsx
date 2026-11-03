"use client";

import { useCallback, useRef, useState, useSyncExternalStore } from "react";
import { businessHref } from "@/components/discovery/browse-offers";
import { BOOKING_GROUPS } from "@/components/discovery/categories";
import type { PlanBusinessesPage } from "@/api/discovery";
import { ChevronGlyph, MapGlyph } from "@/components/discovery/tag-glyphs";
import { formatDateRange, thingCount } from "@/components/trips/format";
import { useTripHere } from "@/components/trips/use-trip-here";
import { pickedTotal, useTripQuote, type Trip } from "@/components/trips/use-trips";
import { Button, ButtonLink } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { distanceText, heartedSlugs, PLAN_ROWS, rowDone, rowHolds, stayPoint, byHearts, type PlanBusiness, type PlanPlace, type RowKey } from "./plan-data";
import { PlanCard } from "./plan-card";
import { PlanMapView, PlanPager, PlanResults } from "./plan-results";
import { PlanFoot } from "./plan-frame";
import { PlanPlaces } from "./plan-places";
import { PlanChecklistSkeleton, PlanOptionsSkeleton } from "./plan-skeletons";
import { PlanStayChoice } from "./plan-stay";
import { PlanSteps } from "./plan-steps";
import { usePlanBusinesses } from "./use-plan-businesses";

// Step 2: the trip's checklist (our Path B) as a sticky row of step pills (PlanSteps). The trip (with
// Change, back to step 1) sits in the plan's slim bar (PlanTripLabel); the steps, ticked once the trip has each here,
// and the one picked (else the first still open) shows its options under them — Where you'll
// stay asks where the guest is staying first, Getting around and Things to do add the places to
// see (the team's A3). Every step is optional: Skip moves on to the next (remembered in this
// browser for the trip; Review still names real gaps). An option is a business offering the step,
// an Airbnb-style card that opens its page with its options in this step (planBusinessHref); from lg the step's page sits beside a sticky map (on by default; Hide map over its corner, Show map in the step's header). The
// options come from the API a page at a time (usePlanBusinesses): the list and the map show the
// same page, with a pager. The foot sums the trip and leads to Review.
// `initial`: page 1 of the step it opens on, fetched on the server.
export function PlanChecklist({ place, choose, initial }: { place: PlanPlace; choose?: RowKey; initial?: { key: RowKey; data: PlanBusinessesPage } }) {
  const { session, trips, trip } = useTripHere(place.places);
  if (session === undefined || (session && trips.isPending)) return <PlanChecklistSkeleton />;
  if (!trip) return <NoTrip slug={place.area.slug} />;
  return <Checklist place={place} trip={trip} choose={choose} initial={initial} />;
}

// `choose`: the row to open at once (a gap's Add on the review).
function Checklist({
  place,
  trip,
  choose,
  initial,
}: {
  place: PlanPlace;
  trip: Trip;
  choose?: RowKey;
  initial?: { key: RowKey; data: PlanBusinessesPage };
}) {
  // The page each step is on, kept while the guest moves between steps.
  const [pages, setPages] = useState<Partial<Record<RowKey, number>>>({});
  const panelRef = useRef<HTMLDivElement>(null);
  // From lg: the step's page of options beside their map instead of a plain grid; kept from step
  // to step. A gap's Add on the review opens its step this way.
  // On by default; Show map in the step's header brings it back.
  const [mapOn, setMapOn] = useState(true);
  const wide = useWide();
  const showMap = mapOn && wide;
  // Below lg: the step whose map view covers the screen (PlanMapView); null shows the list.
  const [mapView, setMapView] = useState<RowKey | null>(null);
  const closeMapView = useCallback(() => setMapView(null), [setMapView]);
  const [skipped, toggleSkip] = useSkipped(trip.id);
  // The step shown under the stepper: the one the guest tapped, else the first still open.
  const [picked, setPicked] = useState<RowKey | null>(choose ?? null);
  const quote = useTripQuote(trip.id);
  const rows = PLAN_ROWS.filter((row) => row.key === "stay" || place.counts[row.key] > 0);
  const done = new Map(rows.map((row) => [row.key, rowDone(trip, row.key, place)]));
  const current = rows.find((row) => !done.get(row.key) && !skipped.has(row.key))?.key;
  const active = rows.find((row) => row.key === (picked ?? current)) ?? rows[0];
  const hearted = heartedSlugs(trip);
  const stay = stayPoint(trip);
  const page = pages[active.key] ?? 1;
  const results = usePlanBusinesses(place.area.slug, active.key, page, hearted, initial);
  const shown = results.data;
  // A new page: back to the top of its options, under the header.
  const turnPage = (key: RowKey) => (next: number) => {
    setPages((current) => ({ ...current, [key]: next }));
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    panelRef.current?.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
  };
  const total = pickedTotal(quote.data, trip.items);
  const landmarks = new Map(place.landmarks.map((landmark) => [landmark.slug, landmark]));
  const cardContext = { landmarks, hearted, stay, when: formatDateRange(trip.starts_on, trip.ends_on) ?? "" };

  // What an open step says to help pick, from the guest's own trip: the tours to the hearted
  // places, how far the hearted places no tour reaches are from the stay.
  const idle = (key: RowKey, fallback: string) => {
    if (key === "stay") return "Tell us where you're staying, or pick a stay here";
    if (key === "activity" && shown && shown.heartedTotal > 0)
      return `${shown.heartedTotal} ${shown.heartedTotal === 1 ? "tour goes" : "tours go"} to your hearted places`;
    if (key === "rental" && stay) {
      const far = place.landmarks
        .filter((landmark) => hearted.has(landmark.slug) && landmark.visitedBy.length === 0)
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
  const hrefOf = (key: RowKey) => (id: number) => planBusinessHref(id, key, trip, place.area.slug);

  // The open step's options under it, a page at a time, the pager under them: a sideways row to
  // swipe on a phone, two across on a tablet (the Map pill floating over the foot opens the map
  // view), four across from lg, or with the map on, beside a map of the page's pins that sticks
  // while they scroll.
  const options = (key: RowKey) => {
    if (!shown)
      return results.isError ? (
        <p className="text-sm text-muted">Couldn&apos;t load these just now. Try again in a moment.</p>
      ) : (
        <PlanOptionsSkeleton map={mapOn} />
      );
    if (shown.total === 0) return <p className="text-sm text-muted">Nothing to book here yet. Local partners are still being added.</p>;
    const href = hrefOf(key);
    const busy = results.isPlaceholderData;
    const pager = <PlanPager page={shown.page} perPage={shown.perPage} total={shown.total} onPage={turnPage(key)} />;
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
            <li key={business.id} className="min-w-0">
              <PlanCard business={business} href={href(business.id)} context={cardContext} />
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
          rows={rows.map((row) => {
            const isDone = Boolean(done.get(row.key));
            return { key: row.key, title: row.title, state: isDone ? "done" : skipped.has(row.key) ? "skipped" : "open" };
          })}
          active={active.key}
          onPick={setPicked}
        />

        {(() => {
          const row = active;
          const index = rows.indexOf(row);
          const isDone = Boolean(done.get(row.key));
          const isSkipped = !isDone && skipped.has(row.key);
          const holds = isDone ? rowHolds(trip, row.key, place) : null;
          const next = rows[index + 1];
          return (
            <div key={row.key} ref={panelRef} className="flex scroll-mt-(--plan-chrome) flex-col gap-3 rounded-card border border-line p-3 motion-safe:animate-swap-in sm:p-4" data-testid="plan-step-panel">
              <div className="flex items-start justify-between gap-3">
                {/* The title and its hint on one line from sm, so the options start higher. */}
                <div className="flex min-w-0 flex-col sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-3">
                  <h2 className={cn("font-display text-xl font-extrabold tracking-tight", isSkipped ? "text-muted" : "text-navy")}>
                    {row.title}
                  </h2>
                  <p className="text-sm text-muted">{holds ?? (isSkipped ? "Skipped. Undo to come back to it." : idle(row.key, row.idle))}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                {/* Only to bring the map back: Hide map is over the map's corner. */}
                {!isSkipped && !mapOn && (
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
                {!isDone && (
                  <button
                    type="button"
                    onClick={() => {
                      // Skipping moves on to the next step; Undo stays here.
                      if (!isSkipped && next) setPicked(next.key);
                      toggleSkip(row.key);
                    }}
                    className="-my-1 flex min-h-11 shrink-0 items-center px-1 text-sm font-semibold text-muted underline-offset-4 hover:underline"
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
              {!isSkipped &&
                (row.key === "stay" ? (
                  <PlanStayChoice trip={trip} center={place.center}>
                    {options("stay")}
                  </PlanStayChoice>
                ) : (
                  <>
                    {options(row.key)}
                    {row.key === "rental" && <PlanPlaces mode="ride" landmarks={place.landmarks} trip={trip} stay={stay?.point ?? null} />}
                    {row.key === "activity" && <PlanPlaces mode="tours" landmarks={place.landmarks} trip={trip} stay={stay?.point ?? null} />}
                  </>
                ))}
              {next && (
                <button
                  type="button"
                  onClick={() => setPicked(next.key)}
                  className="flex min-h-11 items-center gap-1 self-end text-sm font-semibold text-primary underline-offset-4 hover:underline"
                  data-testid="plan-step-next"
                >
                  Next: {next.title}
                  <ChevronGlyph direction="right" className="size-4" />
                </button>
              )}
            </div>
          );
        })()}
      </section>

      <PlanFoot
        float={
          active && !skipped.has(active.key) && place.counts[active.key] > 0 ? (
            <button
              type="button"
              onClick={() => setMapView(active.key)}
              className="flex min-h-11 items-center gap-2 rounded-full bg-navy px-5 text-sm font-semibold text-white shadow-float lg:hidden"
              data-testid={`plan-map-view-${active.key}`}
            >
              Map
              <MapGlyph className="size-4" />
            </button>
          ) : undefined
        }
        summary={
          trip.items.length === 0 ? (
            <p className="text-sm text-muted">Pick something from a step to review your trip.</p>
          ) : (
            <div className="flex items-baseline justify-between gap-3 font-bold text-navy">
              <span>{thingCount(trip.items.length)}</span>
              <span className="tabular-nums">{total ?? ""}</span>
            </div>
          )
        }
      >
        {/* Nothing to review until a listing is in the trip. */}
        {trip.items.length > 0 && (
          <ButtonLink href={`/plan/${place.area.slug}/review?trip=${trip.id}`} size="md" glyph="arrow" data-testid="plan-review">
            Review trip
          </ButtonLink>
        )}
      </PlanFoot>

      {/* The map view is always the open step's: the Map pill is under it. */}
      {mapView && mapView === active.key && shown && (
        <PlanMapView
          title={active.title}
          businesses={sorted}
          total={shown.total}
          page={shown.page}
          perPage={shown.perPage}
          onPage={(next) => setPages((current) => ({ ...current, [active.key]: next }))}
          context={cardContext}
          stay={stay}
          hrefOf={hrefOf(active.key)}
          onClose={closeMapView}
        />
      )}
    </>
  );
}

// A business's page from a plan step (planned trip, this step's options only, `plan=1`): the
// trip's dates and party, the step's What to book group, the place and the trip, so adds land in
// it and the way back returns to the plan.
function planBusinessHref(id: number, key: RowKey, trip: Trip, slug: string) {
  const group = BOOKING_GROUPS.find((each) => each.group === key);
  const dates = {
    from: trip.starts_on ?? undefined,
    to: trip.ends_on ?? undefined,
    guests: trip.guests,
    children: trip.children,
    infants: trip.infants,
  };
  const href = businessHref(id, dates, group?.id, slug);
  return `${href}${href.includes("?") ? "&" : "?"}trip=${trip.id}&plan=1`;
}

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

// The rows the guest skipped on this trip, kept in this browser (a convenience: Review still
// names what's missing). Storage can be blocked; the choice then lasts the visit.
const SKIP_EVENT = "plan-skip";
function useSkipped(tripId: number): [Set<RowKey>, (key: RowKey) => void] {
  const key = `plan-skipped-${tripId}`;
  const read = useCallback(() => {
    try {
      return localStorage.getItem(key) ?? "";
    } catch {
      return memory.get(key) ?? "";
    }
  }, [key]);
  const raw = useSyncExternalStore(subscribeSkips, read, () => "");
  const skipped = new Set(raw.split(",").filter(Boolean) as RowKey[]);
  const toggle = (row: RowKey) => {
    const next = new Set(skipped);
    if (next.has(row)) next.delete(row);
    else next.add(row);
    const value = [...next].join(",");
    memory.set(key, value);
    try {
      localStorage.setItem(key, value);
    } catch {
      // Kept in memory instead.
    }
    window.dispatchEvent(new Event(SKIP_EVENT));
  };
  return [skipped, toggle];
}

const memory = new Map<string, string>();
function subscribeSkips(listener: () => void) {
  window.addEventListener(SKIP_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(SKIP_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
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
