"use client";

import Image from "next/image";
import { useState } from "react";
import { DetailPanelButton, LandmarkPanel, PanelPhoto } from "@/components/discovery/detail-panel";
import { ListGlyph, PlaceGlyph } from "@/components/discovery/tag-glyphs";
import { SaveLandmarkButton } from "@/components/trips/save-landmark-button";
import type { Trip } from "@/components/trips/use-trips";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Pill } from "@/components/ui/pill";
import type { LatLng } from "@/lib/map";
import { accessLine, picksSide, placeIcon, vibeHas, VIBES, type PlanLandmark, type PlanPlace } from "./plan-data";
import { MapOverlay, ResultsMap } from "./plan-results";
import type { ResultPin } from "./results-map";

// The pins of a place's places to see: an icon on each exact point, whatever the chips show, so
// the guest keeps sight of the whole island; names would hide it (the user, 2026-11-05). A pin's
// id is its place's index in `landmarks`.
function pinsOf(landmarks: PlanLandmark[]): ResultPin[] {
  return landmarks.flatMap((landmark, index) =>
    landmark.location ? [{ id: index, point: landmark.location, label: landmark.name, name: landmark.name, icon: placeIcon(landmark) }] : [],
  );
}

const pickedIds = (landmarks: PlanLandmark[], hearted: Set<string>) =>
  new Set(landmarks.flatMap((landmark, index) => (hearted.has(landmark.slug) ? [index] : [])));

const portMarks = (place: PlanPlace) => (place.port ? [{ point: place.port.location, label: place.port.name }] : []);

// Places to see, the plan's first step (`places-to-see-first.pdf`, RAA-258): what the guest came
// for, before where to sleep, as every later step uses the picks. Cards with a heart, the team's
// must-sees first (load-plan-place), filtered by vibe, beside a map where the picks turn navy;
// a phone stacks the cards, heart on the right, and has the map behind Show on a map. A card opens
// the place's details, the area page's side panel. A pick is the trip's saved place, so hearts from
// the area page arrive already picked.
export function PlanSee({
  place,
  trip,
  hearted,
  stay,
  wide,
  onTours,
}: {
  place: PlanPlace;
  trip: Trip;
  hearted: Set<string>;
  stay: LatLng | null;
  // From lg: the map beside the cards. Below it the map is behind Show on a map, so none is made.
  wide: boolean;
  // To Things to do, from a place's details; none when the place has no tours.
  onTours?: () => void;
}) {
  const [vibe, setVibe] = useState<string | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const { landmarks } = place;
  // Only the chips that lead somewhere: a tag no place here has yet stays hidden.
  const vibes = VIBES.filter((each) => landmarks.some((landmark) => vibeHas(each, landmark)));
  const picked = vibes.find((each) => each.label === vibe);
  const shown = landmarks.flatMap((landmark, index) => (!picked || vibeHas(picked, landmark) ? [{ landmark, index }] : []));
  // A tapped pin rings its card and brings it into view; the card then opens its details.
  const pickPin = (id: number | null) => {
    setHovered(id);
    if (id === null) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document
      .querySelector(`[data-place="${landmarks[id].slug}"]`)
      ?.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
  };
  const side = picksSide(landmarks.filter((landmark) => hearted.has(landmark.slug)), place);

  return (
    <div className="flex flex-col gap-3" data-testid="plan-see">
      {vibes.length > 0 && (
        <div role="group" aria-label="Filter places" className="-mx-3 flex gap-2 overflow-x-auto px-3 py-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
          <Pill on={!vibe} onClick={() => setVibe(null)} className="shrink-0" data-testid="plan-vibe-all">
            All
          </Pill>
          {vibes.map((each) => (
            <Pill key={each.label} on={vibe === each.label} onClick={() => setVibe(each.label)} className="shrink-0" data-testid="plan-vibe">
              {each.label}
            </Pill>
          ))}
        </div>
      )}
      {/* Under the map from lg. */}
      {side && !wide && (
        <p className="text-sm font-semibold text-forest" data-testid="plan-see-side">
          {side}
        </p>
      )}
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_22.5rem] lg:items-start">
        <ul className="@container grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2 sm:gap-y-6 lg:grid-cols-2 xl:grid-cols-3">
          {shown.map(({ landmark, index }) => (
            <li key={landmark.slug} className="min-w-0">
              <PlaceCard
                landmark={landmark}
                place={place}
                trip={trip}
                stay={stay}
                active={hovered === index}
                onHover={(on) => setHovered(on ? index : null)}
                onTours={onTours}
              />
            </li>
          ))}
        </ul>
        {/* Stuck under the stepper; short enough that its caption clears the step's foot before
            the page scrolls. */}
        {wide && (
          <div className="sticky top-(--plan-chrome) flex flex-col gap-2">
            <div className="relative h-[calc(100dvh-var(--plan-chrome)-22rem)] min-h-80 overflow-hidden rounded-card bg-sky-mist card-edge shadow-soft">
              <ResultsMap
                pins={pinsOf(landmarks)}
                stay={null}
                active={hovered}
                onPick={pickPin}
                picked={pickedIds(landmarks, hearted)}
                marks={portMarks(place)}
                controls
              />
            </div>
            <p className={side ? "text-sm font-semibold text-forest" : "text-small text-muted"} data-testid="plan-see-side">
              {side ?? `Picked places turn navy, so you can see where to stay${place.kind === "island" ? " on the island" : ""}.`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// One place: what it is and how to get there, the question each answers in a line. A row on a
// phone, a card from sm. All of it opens the place's details, but for its heart, which sits over
// the name's stretched button.
function PlaceCard({
  landmark,
  place,
  trip,
  stay,
  active,
  onHover,
  onTours,
}: {
  landmark: PlanLandmark;
  place: PlanPlace;
  trip: Trip;
  stay: LatLng | null;
  active: boolean;
  onHover: (on: boolean) => void;
  onTours?: () => void;
}) {
  const sample = landmark.photo?.alt.startsWith("Sample photo");
  const access = accessLine(landmark, { stay, port: place.port?.location ?? null });
  return (
    <article
      onPointerEnter={() => onHover(true)}
      onPointerLeave={() => onHover(false)}
      className="relative flex gap-3 sm:flex-col sm:gap-1.5"
      data-testid="plan-see-card"
      data-place={landmark.slug}
    >
      <div
        className={cn(
          "relative size-23 shrink-0 overflow-hidden rounded-control bg-sky-mist transition-shadow duration-300 ease-calm sm:h-28 sm:w-full",
          active && "ring-2 ring-navy ring-offset-2",
        )}
      >
        {landmark.photo ? (
          <Image src={landmark.photo.src} alt={landmark.photo.alt} fill sizes="(min-width: 40rem) 16rem, 6rem" className="object-cover" />
        ) : (
          <PlaceGlyph className="absolute top-1/2 left-1/2 size-7 -translate-x-1/2 -translate-y-1/2 text-primary/60" />
        )}
        {sample && <span className="absolute bottom-1.5 left-2 text-small text-white text-on-photo max-sm:hidden">Sample photo</span>}
        {landmark.mustSee && (
          <span className="absolute top-2 left-2 rounded-full bg-surface/90 px-2.5 py-1 text-small font-bold text-forest max-sm:hidden" data-testid="plan-must-see">
            Must see
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-small max-sm:pr-13">
        <h3 className="text-sm font-bold text-navy sm:text-control">
          <DetailPanelButton
            title={landmark.name}
            media={<PanelPhoto photo={landmark.photo} />}
            panel={
              <>
                <LandmarkPanel landmark={landmark} areaName={place.area.name} />
                <section className="flex flex-col items-start gap-2" data-testid="plan-see-getting-there">
                  <h3 className="text-sm font-semibold">Transfer</h3>
                  <p className="text-sm">{access}</p>
                  {onTours && landmark.visitedBy.length > 0 && (
                    <Button type="button" variant="soft" size="sm" onClick={onTours} data-testid="plan-see-tours">
                      See tours that go here
                    </Button>
                  )}
                </section>
              </>
            }
            actions={<SaveLandmarkButton slug={landmark.slug} name={landmark.name} guests={trip.guests} variant="panel" />}
            data-testid="plan-see-open"
          >
            {landmark.name}
          </DetailPanelButton>
        </h3>
        {landmark.description && <p className="line-clamp-2 text-muted">{landmark.description}</p>}
        <p className="text-navy" data-testid="plan-see-access">
          {access}
        </p>
      </div>
      <span className="absolute top-0 right-0 sm:top-2 sm:right-2">
        <SaveLandmarkButton slug={landmark.slug} name={landmark.name} guests={trip.guests} variant="pick" />
      </span>
    </article>
  );
}

// The places on a map over the whole screen, below lg: a tapped pin shows its place at the foot,
// with its heart, in the List pill's place.
export function PlanSeeMapView({
  place,
  trip,
  hearted,
  stay,
  onClose,
  onTours,
}: {
  place: PlanPlace;
  trip: Trip;
  hearted: Set<string>;
  stay: LatLng | null;
  onClose: () => void;
  onTours?: () => void;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const { landmarks } = place;
  const chosen = picked === null ? null : landmarks[picked];
  return (
    <MapOverlay
      label="Places to see on the map"
      heading={`Places to see · ${hearted.size} picked`}
      onClose={onClose}
      map={
        <ResultsMap
          pins={pinsOf(landmarks)}
          stay={null}
          active={picked}
          onPick={setPicked}
          picked={pickedIds(landmarks, hearted)}
          marks={portMarks(place)}
          covered={0.3}
        />
      }
    >
      {chosen ? (
        <div className="w-full max-w-md rounded-card bg-surface p-3 shadow-float card-edge">
          <PlaceCard landmark={chosen} place={place} trip={trip} stay={stay} active={false} onHover={() => undefined} onTours={onTours} />
        </div>
      ) : (
        <button
          type="button"
          onClick={onClose}
          className="flex min-h-11 items-center gap-2 rounded-full bg-navy px-5 text-sm font-semibold text-white shadow-float"
          data-testid="plan-map-list"
        >
          List
          <ListGlyph className="size-4" />
        </button>
      )}
    </MapOverlay>
  );
}
