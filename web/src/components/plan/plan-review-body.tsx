"use client";

import Link from "next/link";
import { useState } from "react";
import { BookingStatusBadge } from "@/components/bookings/booking-status";
import { ChevronGlyph, PlusGlyph } from "@/components/discovery/tag-glyphs";
import { itemAmount } from "@/components/trips/format";
import { itemPriceLabel, itemProblem, itemQuote, type Trip, type TripItem, type TripQuote } from "@/components/trips/use-trips";
import { cn } from "@/components/ui/cn";
import { formatDateRange } from "@/lib/dates";
import { PLAN_ROWS, stayPoint, type PlanPlace, type RowKey } from "./plan-data";
import { dayParts, pickStatuses, planDays, type DayGap, type PickStatus } from "./plan-days";
import { PlanPlaceChooser } from "./plan-place-chooser";
import { PlanPlacesPanel } from "./plan-places-panel";

// The trip day by day as the planner reviews it (A6, RAA-263), shared by the plan's Review and the
// cart's and /trips' trip (RAA-305): every day saying what happens and when, what runs through it,
// the picks the guest goes to themselves, and what's still missing as a gap whose Add goes back to
// its checklist step; beside it from lg (`layout="beside"`, the review) or under a tab (`"tabs"`, the
// cart's narrower column) every picked place and how it is settled. Items with no day yet follow
// the days. A row calls `onEvent` (the review opens the listing, the cart its item panel).
export function PlanReviewBody({
  trip,
  place: loaded,
  quote,
  onEvent,
  onListing,
  back,
  gaps = true,
  layout,
}: {
  trip: Trip;
  // Null while the cart still loads it: the days show without stops, ideas or step counts.
  place: PlanPlace | null;
  quote: TripQuote | undefined;
  onEvent: (item: TripItem) => void;
  onListing: (id: number) => void;
  // The plan's checklist for this trip (`/plan/<area>?trip=<id>`): gaps and the place chooser link there.
  back: string;
  // False on /trips, which only shows what was booked.
  gaps?: boolean;
  layout: "beside" | "tabs";
}) {
  const [tab, setTab] = useState<"days" | "places">("days");
  const [choosing, setChoosing] = useState<string | null>(null);
  const place = loaded ?? emptyPlace(trip);
  const stay = stayPoint(trip);
  const days = planDays(trip, place, stay?.point ?? null);
  const undated = trip.items.filter((item) => !item.starts_on);
  const picks = pickStatuses(trip, place, stay?.point ?? null);
  const picking = loaded ? picks.find((pick) => pick.slug === choosing) : undefined;
  const open = picks.filter((pick) => pick.state === "open").length;
  const hasPlaces = picks.length > 0;
  const beside = layout === "beside";
  const choose = (pick: PickStatus) => setChoosing(pick.slug);

  return (
    <>
      {hasPlaces && (
        <div className={cn("flex gap-2 pt-3", beside && "lg:hidden")} role="group" aria-label="Show">
          {(["days", "places"] as const).map((each) => (
            <button
              key={each}
              type="button"
              aria-pressed={tab === each}
              onClick={() => setTab(each)}
              data-testid={`plan-tab-${each}`}
              className={cn(
                "min-h-11 flex-1 rounded-chip border px-3 text-sm font-semibold transition-colors duration-300 ease-calm",
                tab === each ? "border-primary bg-primary text-white" : "border-line-strong bg-surface text-navy",
              )}
            >
              {each === "days" ? "Days" : open > 0 ? `Places · ${open} to decide` : "Places"}
            </button>
          ))}
        </div>
      )}

      <div
        className={cn(
          beside && hasPlaces && "lg:grid lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start lg:gap-gutter",
          beside && !hasPlaces && "mx-auto w-full max-w-narrow",
        )}
      >
        <div className={cn("min-w-0", tab === "places" && (beside ? "max-lg:hidden" : "hidden"))}>
          {days ? (
            <ol className="flex flex-col pt-3 pb-4" data-testid="plan-days">
              {days.map((day, index) => {
                const { weekday, day: number } = dayParts(day.date);
                const lastDay = index === days.length - 1;
                const dayGaps = gaps ? day.gaps : [];
                return (
                  <li key={day.date} className="flex gap-3" data-testid="plan-day">
                    <div className="flex w-12 shrink-0 flex-col items-center">
                      <span className="flex size-12 flex-col items-center justify-center rounded-full bg-navy text-white">
                        <span className="text-xs leading-none font-bold">{weekday}</span>
                        <span className="text-lg leading-tight font-extrabold">{number}</span>
                      </span>
                      {!lastDay && <span aria-hidden className="mt-1 w-0.5 flex-1 bg-line" />}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-2 pb-6">
                      {day.title ? <p className="pt-3 text-sm font-bold text-muted">{day.title}</p> : <span className="pt-3" />}
                      {index === 0 && trip.own_stay && (
                        <p className="border-l-2 border-kind-stay/50 py-0.5 pl-3 text-small text-muted">
                          Staying at your own place{trip.own_stay.name ? ` · ${trip.own_stay.name}` : ""}
                        </p>
                      )}
                      {day.events.map((event, at) => (
                        <EventRow key={`${event.item.id}-${at}`} item={event.item} priced={event.priced} quote={quote} onOpen={onEvent} />
                      ))}
                      {day.runs.map((run) => (
                        <p
                          key={run.text}
                          className={cn(
                            "border-l-2 py-0.5 pl-3 text-small text-muted",
                            run.kind === "stay" ? "border-kind-stay/50" : run.kind === "ride" ? "border-kind-rental/50" : "border-kind-activity/50",
                          )}
                        >
                          {run.text}
                        </p>
                      ))}
                      {day.own.map((pick) => (
                        <button
                          key={pick.slug}
                          type="button"
                          onClick={() => choose(pick)}
                          data-testid="plan-own"
                          className="flex w-full items-start gap-3 rounded-card border border-line bg-surface p-3 text-left transition-colors duration-300 ease-calm hover:border-line-strong hover:bg-surface-2"
                        >
                          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <span className="inline-flex items-center gap-1.5 self-start rounded-chip bg-lagoon-tint px-2 py-0.5 text-xs font-bold text-lagoon-ink">
                              <span aria-hidden className="size-2 rounded-full bg-primary" />
                              On my own
                            </span>
                            <span className="font-semibold text-navy">{pick.name}</span>
                            {pick.line && <span className={pick.noRide ? "text-small font-semibold text-warning" : "text-small text-muted"}>{pick.line}</span>}
                          </span>
                          <ChevronGlyph direction="right" className="mt-0.5 size-4 shrink-0 text-muted" />
                        </button>
                      ))}
                      {dayGaps.map((gap) => (
                        <GapLink key={gap.text} gap={gap} back={back} />
                      ))}
                      {day.events.length === 0 && day.own.length === 0 && day.runs.length === 0 && dayGaps.length === 0 && (
                        <p className="text-small text-muted">Nothing planned yet.</p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="py-6 text-muted">Add dates to see your trip day by day.</p>
          )}

          {undated.length > 0 && (
            <section aria-labelledby={`trip-${trip.id}-undated`} className="flex flex-col gap-2 pb-6" data-testid="plan-undated">
              <h3 id={`trip-${trip.id}-undated`} className="text-sm font-bold text-muted">
                Not on a day yet
              </h3>
              {undated.map((item) => (
                <EventRow key={item.id} item={item} priced quote={quote} onOpen={onEvent} />
              ))}
            </section>
          )}
        </div>

        {hasPlaces && (
          <aside className={cn("pt-3 pb-8", beside ? "lg:sticky lg:top-(--plan-chrome)" : "", tab === "days" && (beside ? "max-lg:hidden" : "hidden"))}>
            <PlanPlacesPanel picks={picks} stay={stay} mapKey={tab} onChoose={choose} onListing={onListing} />
          </aside>
        )}
      </div>

      {picking && loaded && (
        <PlanPlaceChooser pick={picking} trip={trip} place={loaded} stay={stay?.point ?? null} back={back} onClose={() => setChoosing(null)} onListing={onListing} />
      )}
    </>
  );
}

// One thing on a day, kept to its title, its dates and where it stands: its booking's status once
// sent, its price until then (on the day that carries it, `priced`), and why it can't be sent as
// it is (dates taken, listing off) in warning.
function EventRow({ item, priced, quote, onOpen }: { item: TripItem; priced: boolean; quote: TripQuote | undefined; onOpen: (item: TripItem) => void }) {
  const line = itemQuote(quote, item);
  const price = priced ? itemPriceLabel(line) : null;
  const problem = priced ? itemProblem(item, line) : null;
  const dates = formatDateRange(item.starts_on, item.ends_on ?? item.starts_on) ?? "No date yet";
  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      data-testid="plan-event"
      className="flex w-full items-center gap-3 rounded-card border border-line bg-surface p-3 text-left transition-colors duration-300 ease-calm hover:border-line-strong hover:bg-surface-2"
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5" data-testid="plan-event-open">
        <span className="font-semibold text-navy">{item.listing.title}</span>
        <span className="text-small text-muted">{dates} · {itemAmount(item)}</span>
        {problem && (
          <span className="text-small font-semibold text-warning" data-testid="plan-event-problem">
            {problem}
          </span>
        )}
      </span>
      {item.booking ? (
        <BookingStatusBadge status={item.booking.status} small />
      ) : (
        price && <span className="shrink-0 text-sm font-extrabold text-primary tabular-nums">{price}</span>
      )}
      <ChevronGlyph direction="right" className="size-4 shrink-0 text-muted" />
    </button>
  );
}

// Something the trip lacks, with its way back to the step that fixes it.
function GapLink({ gap, back }: { gap: DayGap; back: string }) {
  return (
    <Link
      href={`${back}&choose=${gap.row}`}
      data-testid="plan-gap"
      className={cn(
        "flex min-h-11 items-center justify-between gap-3 rounded-card border border-dashed px-3 py-2 text-sm font-semibold transition-colors duration-300 ease-calm",
        gap.idea ? "border-line-strong text-muted hover:bg-surface-2" : "border-warning/60 bg-warning/5 text-warning hover:bg-warning/10",
      )}
    >
      {gap.text}
      <span className="flex shrink-0 items-center gap-1 text-primary">
        <PlusGlyph className="size-4" />
        Add
      </span>
    </Link>
  );
}

// A place the cart hasn't loaded yet: nothing offered and no places to see, so the days show the
// trip's own items and nights with no bed, but no stops, ideas or "no ride here" yet.
function emptyPlace(trip: Trip): PlanPlace {
  return {
    area: { slug: "", name: "" },
    kind: "",
    port: null,
    towns: [],
    places: trip.items.map((item) => (item.destination ?? item.area).slug),
    island: null,
    center: null,
    counts: Object.fromEntries(PLAN_ROWS.map((row) => [row.key, 0])) as Record<RowKey, number>,
    landmarks: [],
    gettingHere: null,
  };
}
