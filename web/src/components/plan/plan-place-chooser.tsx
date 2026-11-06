"use client";

import { useQueries } from "@tanstack/react-query";
import { useState } from "react";
import { listingQuery } from "@/components/discovery/detail-panel";
import { ArrowGlyph } from "@/components/discovery/tag-glyphs";
import { usePlanLandmark, type Trip } from "@/components/trips/use-trips";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { ChoiceCards } from "@/components/ui/choice-cards";
import { cn } from "@/components/ui/cn";
import { Dialog } from "@/components/ui/dialog";
import { addDays, daysBetween } from "@/lib/dates";
import { formatPeso } from "@/lib/money";
import { distanceText, heartedSlugs, rowItems, type PlanPlace } from "./plan-data";
import { dayParts, type PickStatus } from "./plan-days";

const dayLabel = (date: string) => {
  const { weekday, day } = dayParts(date);
  return `${weekday} ${day}`;
};

// How a guest means to see a place (RAA-263): a tour, which covers it by being in the trip; on
// their own on a day of the trip; or not this trip. A rental decides none of this: it only makes
// going on their own easier, and a boat-only place can't be reached that way at all.
export function PlanPlaceChooser({
  pick,
  trip,
  place,
  stay,
  back,
  onClose,
  onListing,
}: {
  pick: PickStatus;
  trip: Trip;
  place: PlanPlace;
  stay: { lat: number; lng: number } | null;
  back: string;
  onClose: () => void;
  onListing: (id: number) => void;
}) {
  const [way, setWay] = useState<string>(pick.state === "open" ? "" : pick.state);
  const [day, setDay] = useState(pick.day ?? trip.starts_on ?? "");
  const plan = usePlanLandmark();
  const { landmark } = pick;
  const boat = Boolean(landmark.boatDeparture);
  const tours = useQueries({ queries: landmark.visitedBy.map((id) => listingQuery(id)) });
  const hearted = heartedSlugs(trip);
  const held = new Set(trip.items.map((item) => item.listing.id));
  const hasRide = rowItems(trip, "rental", place).length > 0;
  const far = distanceText(stay, landmark.location);
  const dated = Boolean(trip.starts_on && trip.ends_on);
  const days = trip.starts_on && trip.ends_on ? Array.from({ length: Math.min(daysBetween(trip.starts_on, trip.ends_on) + 1, 60) }, (_, index) => addDays(trip.starts_on as string, index)) : [];
  const ownLine = boat ? "Not reachable on your own: boats only" : !dated ? "Add dates to your trip to pick a day" : [far && `${far} from your stay`, hasRide ? "Use your ride" : "You'll need a way there"].filter(Boolean).join(" · ");
  const save = (next: "own" | "skip") => pick.savedId && plan.mutate({ id: pick.savedId, plan: next, visitOn: next === "own" ? day : undefined }, { onSuccess: onClose });

  const choose = (next: string) => {
    setWay(next);
    // A tour covers a place by being in the trip, so an earlier say would hide it.
    if (next === "tour" && pick.hasPlan && pick.savedId) plan.mutate({ id: pick.savedId, plan: null });
  };

  return (
    <Dialog
      open
      placement="sheet"
      title={pick.name}
      meta={boat ? "Boat only" : (far && `${far} from your stay`) || undefined}
      onClose={onClose}
      data-testid="plan-chooser"
      actions={
        way === "own" ? (
          <Button type="button" size="touch" loading={plan.isPending} disabled={!day} onClick={() => save("own")} data-testid="plan-chooser-save">
            {`Go on ${day ? dayLabel(day) : "this day"}`}
          </Button>
        ) : way === "skip" ? (
          <Button type="button" size="touch" loading={plan.isPending} onClick={() => save("skip")} data-testid="plan-chooser-save">
            Skip this place
          </Button>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-3">
        <ChoiceCards
          legend={`How do you want to see ${pick.name}?`}
          name="plan-way"
          columns={1}
          value={way}
          onChange={choose}
          data-testid="plan-way"
          choices={[
            {
              value: "tour",
              label: "Book a tour",
              description: tours.length === 0 ? "No tour goes here yet" : tours.length === 1 ? "1 tour stops here" : `${tours.length} tours stop here`,
              disabled: tours.length === 0,
            },
            { value: "own", label: "Go on my own", description: ownLine, disabled: boat || !dated },
            { value: "skip", label: "Skip it this trip", description: "It stays in your picks, marked as skipped." },
          ]}
        />
        {way === "tour" && (
          <ul className="flex flex-col gap-2" data-testid="plan-chooser-tours">
            {tours.map(({ data: tour }, index) => {
              const id = landmark.visitedBy[index];
              const also = place.landmarks.filter((each) => each.visitedBy.includes(id) && !hearted.has(each.slug)).map((each) => each.name);
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => onListing(id)}
                    disabled={!tour}
                    data-testid="plan-chooser-tour"
                    className="flex min-h-11 w-full items-center gap-3 rounded-control border border-line bg-surface p-3 text-left transition-colors duration-300 ease-calm hover:border-primary"
                  >
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="text-sm font-semibold break-words text-navy">{tour?.title ?? "Loading…"}</span>
                      {tour?.price_from_cents ? <span className="text-small text-muted tabular-nums">From {formatPeso(tour.price_from_cents)}</span> : null}
                      {also.length > 0 && <span className="text-small text-muted">Also stops at {also.join(", ")}</span>}
                    </span>
                    {held.has(id) ? <Badge tone="kind">In your trip</Badge> : <ArrowGlyph className="size-4 shrink-0 text-primary" />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {way === "own" && (
          <div className="flex flex-col gap-2">
            {!hasRide && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-control border border-line p-3">
                <span className="text-sm text-muted">You have no ride on this trip.</span>
                <ButtonLink href={`${back}&choose=rental`} variant="soft" size="touch">
                  Find a ride
                </ButtonLink>
              </div>
            )}
            <p className="text-sm font-semibold">Which day?</p>
            <div className="flex flex-wrap gap-2">
              {days.map((each) => (
                <button
                  key={each}
                  type="button"
                  aria-pressed={each === day}
                  onClick={() => setDay(each)}
                  data-testid="plan-chooser-day"
                  className={cn(
                    "min-h-11 rounded-chip border px-4 text-sm font-semibold transition-colors duration-300 ease-calm",
                    each === day ? "border-primary bg-primary text-white" : "border-line-strong bg-surface text-navy hover:border-primary",
                  )}
                >
                  {dayLabel(each)}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}
