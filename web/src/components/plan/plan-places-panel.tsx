"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { dayParts, type PickState, type PickStatus } from "./plan-days";
import { placeIcon } from "./plan-data";
import { ResultsMap } from "./plan-results";
import type { ResultPin } from "./results-map";

// A pin's colour by what the guest has settled, so the map reads like the list.
const PIN_TONE: Record<PickState, string> = {
  open: "bg-warning text-white after:bg-warning",
  own: "bg-primary text-white after:bg-primary",
  tour: "bg-forest text-white after:bg-forest",
  skip: "bg-tag text-muted after:bg-tag",
  added: "bg-sky-deep text-white after:bg-sky-deep",
};

function stateBadge(pick: PickStatus) {
  if (pick.state === "tour") return <Badge tone="emerald">Covered by a tour</Badge>;
  if (pick.state === "skip") return <Badge tone="mist">Skipped</Badge>;
  if (pick.state === "added") return <Badge tone="aqua">Added by a tour</Badge>;
  if (pick.state === "own" && pick.day) {
    const { weekday, day } = dayParts(pick.day);
    return <Badge tone="kind">{`On my own · ${weekday} ${day}`}</Badge>;
  }
  return null;
}

function PlaceRow({ pick, onChoose, onListing }: { pick: PickStatus; onChoose: (pick: PickStatus) => void; onListing: (id: number) => void }) {
  const { tour } = pick;
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line py-3 first:border-t-0" data-testid="plan-pick" data-state={pick.state}>
      <div className="flex min-w-48 flex-1 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-1.5 font-semibold text-navy">
          {pick.name}
          {pick.state === "open" && pick.landmark.boatDeparture && <Badge tone="aqua">Boat only</Badge>}
        </span>
        {pick.line && <span className={pick.noRide ? "text-small font-semibold text-warning" : "text-small text-muted"}>{pick.line}</span>}
      </div>
      <div className="ml-auto flex items-center gap-1">
        {stateBadge(pick)}
        {pick.state === "open" ? (
          <Button type="button" size="sm" onClick={() => onChoose(pick)} data-testid="plan-pick-choose">
            Choose how
          </Button>
        ) : pick.state === "added" && tour ? (
          <button type="button" onClick={() => onListing(tour.listing.id)} className="min-h-11 rounded-button px-2 text-sm font-semibold text-primary">
            View tour
          </button>
        ) : (
          <button type="button" onClick={() => onChoose(pick)} aria-label={`Change how you see ${pick.name}`} className="min-h-11 rounded-button px-2 text-sm font-semibold text-primary" data-testid="plan-pick-change">
            Change
          </button>
        )}
      </div>
    </li>
  );
}

// Everything the guest picked, with a way to settle each, beside the days (RAA-263): how far along
// they are, where the places are, then what still needs a plan first. Places a tour adds show
// with the reason and don't count: they were never asked for. An indicator only: it never makes
// the plan not ready (plan.md). `mapKey`: changed when the panel comes into view on a phone, so
// the map lays out at its real size.
export function PlanPlacesPanel({
  picks,
  stay,
  mapKey,
  onChoose,
  onListing,
}: {
  picks: PickStatus[];
  stay: { point: { lat: number; lng: number }; name: string } | null;
  mapKey: string;
  onChoose: (pick: PickStatus) => void;
  onListing: (id: number) => void;
}) {
  const chosen = picks.filter((pick) => pick.state !== "added");
  const sorted = chosen.filter((pick) => pick.state !== "open").length;
  const open = chosen.length - sorted;
  const added = picks.length - chosen.length;
  const pins: ResultPin[] = picks.flatMap((pick, index) =>
    pick.landmark.location ? [{ id: index, point: pick.landmark.location, label: pick.name, name: pick.name, icon: placeIcon(pick.landmark), tone: PIN_TONE[pick.state] }] : [],
  );
  const pinPicked = (id: number | null) => {
    const pick = id === null ? undefined : picks[id];
    if (!pick) return;
    if (pick.state === "added" && pick.tour) onListing(pick.tour.listing.id);
    else onChoose(pick);
  };
  return (
    <section className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4" aria-labelledby="plan-picks" data-testid="plan-places">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="plan-picks" className="font-display text-title-sm font-extrabold tracking-tight text-navy">
          Places you picked
        </h2>
        {chosen.length > 0 && (
          <span className="shrink-0 text-sm font-semibold text-muted" data-testid="plan-places-count">
            {sorted} of {chosen.length} sorted
          </span>
        )}
      </div>
      {chosen.length > 0 && (
        <div className="h-2 overflow-hidden rounded-full bg-tag" aria-hidden>
          <div className="h-full rounded-full bg-primary transition-[width] duration-500 ease-calm" style={{ width: `${(sorted / chosen.length) * 100}%` }} />
        </div>
      )}
      <p className="text-sm text-muted">
        {added > 0 && `${added} more ${added === 1 ? "place comes" : "places come"} with your tours. `}
        {open > 0 ? `${open} ${open === 1 ? "place needs" : "places need"} a plan: book a tour, go on your own, or skip it.` : chosen.length > 0 ? "Every place you picked has a plan." : ""}
      </p>
      {pins.length > 0 && <ResultsMap key={mapKey} pins={pins} stay={stay} active={null} onPick={pinPicked} className="aspect-[16/11] overflow-hidden rounded-control" />}
      <ul className="flex flex-col">
        {picks.map((pick) => (
          <PlaceRow key={pick.slug} pick={pick} onChoose={onChoose} onListing={onListing} />
        ))}
      </ul>
    </section>
  );
}
