"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronGlyph, PlaceGlyph } from "@/components/discovery/tag-glyphs";
import { SaveLandmarkButton } from "@/components/trips/save-landmark-button";
import { formatDay } from "@/components/trips/format";
import type { Trip } from "@/components/trips/use-trips";
import { distanceKm } from "@/lib/geo";
import { distanceText, heartedSlugs, type PlanLandmark } from "./plan-data";

// Places to see inside a step (the team's A3, in the place page's card format): a row of photo
// cards to swipe, each with a heart that saves it to the trip. Getting around (`ride`) puts the
// picks first, then the nearest, and says how far each is from the stay (a boat-only place says
// so instead, as no ride reaches it); Things to do (`tours`) puts the hearted
// first and says the trip's day a tour goes there or how many tours do. Sorted once when the trip
// loads, so a card never moves under a thumb that just hearted it.
export function PlanPlaces({
  mode,
  landmarks,
  trip,
  stay,
}: {
  mode: "ride" | "tours";
  landmarks: PlanLandmark[];
  trip: Trip;
  stay: { lat: number; lng: number } | null;
}) {
  const [order] = useState(() => {
    if (mode === "ride" && stay) {
      const picked = heartedSlugs(trip);
      const far = (landmark: PlanLandmark) => (landmark.location ? distanceKm(stay, landmark.location) : Infinity);
      return [...landmarks]
        .sort((a, b) => Number(picked.has(b.slug)) - Number(picked.has(a.slug)) || far(a) - far(b))
        .map((each) => each.slug);
    }
    const hearted = heartedSlugs(trip);
    return [...landmarks.filter((each) => hearted.has(each.slug)), ...landmarks.filter((each) => !hearted.has(each.slug))].map((each) => each.slug);
  });
  const strip = useRef<HTMLUListElement>(null);
  const [ends, setEnds] = useState({ start: true, end: true });
  const measure = useCallback(() => {
    const el = strip.current;
    if (!el) return;
    setEnds({ start: el.scrollLeft <= 1, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 1 });
  }, []);
  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure, landmarks.length]);
  // A mouse can't swipe: the arrows scroll the row by most of its width.
  const step = (by: number) => {
    const el = strip.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: by * el.clientWidth * 0.8, behavior: reduce ? "auto" : "smooth" });
  };
  if (landmarks.length === 0) return null;
  const rank = new Map(order.map((slug, index) => [slug, index]));
  const ordered = [...landmarks].sort((a, b) => (rank.get(a.slug) ?? Infinity) - (rank.get(b.slug) ?? Infinity));
  // The day each place is reached on, by a tour in the trip that goes there.
  const reached = new Map<string, string>();
  for (const item of trip.items) {
    if (!item.starts_on) continue;
    for (const landmark of landmarks)
      if (landmark.visitedBy.includes(item.listing.id) && !reached.has(landmark.slug)) reached.set(landmark.slug, item.starts_on);
  }
  const titleId = `plan-places-${mode}`;
  return (
    <section className="flex flex-col gap-2" aria-labelledby={titleId} data-testid={titleId}>
      <div className="flex items-end justify-between gap-3">
        <div>
          <h3 id={titleId} className="font-bold text-navy">
            Places to see
          </h3>
          <p className="text-small text-muted">
            {mode === "ride" ? "Ride there yourself. Heart one to keep it in your trip." : "Heart a place and its tours come first."}
          </p>
        </div>
        {!(ends.start && ends.end) && (
          <div className="flex shrink-0 gap-2 pointer-coarse:hidden">
            <StripStep direction="left" disabled={ends.start} onClick={() => step(-1)} />
            <StripStep direction="right" disabled={ends.end} onClick={() => step(1)} />
          </div>
        )}
      </div>
      <ul
        ref={strip}
        onScroll={measure}
        // Focusable, so the arrow keys scroll it too.
        tabIndex={0}
        aria-label="Places to see"
        className="-mr-3 flex snap-x snap-mandatory gap-3 overflow-x-auto rounded-card pr-3 pb-1 outline-none [scrollbar-width:none] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--focus) sm:-mr-6 sm:pr-6"
      >
        {ordered.map((landmark) => {
          const day = reached.get(landmark.slug);
          const far = distanceText(stay, landmark.location);
          const line =
            mode === "ride"
              ? landmark.boatDeparture
                ? "Boat tour only"
                : far
                  ? `${far} from your stay`
                  : "Ride there"
              : day
                ? `In your trip · ${formatDay(day)}`
                : landmark.visitedBy.length > 0
                  ? `${landmark.visitedBy.length} ${landmark.visitedBy.length === 1 ? "tour goes" : "tours go"} here`
                  : "No tour goes here yet";
          return (
            <li key={landmark.slug} className="relative flex h-44 w-36 shrink-0 snap-start flex-col justify-end overflow-hidden rounded-card bg-navy p-3 text-white" data-testid="plan-place">
              {landmark.photo ? (
                <Image src={landmark.photo.src} alt={landmark.photo.alt} fill sizes="9rem" className="object-cover" />
              ) : (
                <PlaceGlyph className="absolute top-1/3 left-1/2 size-10 -translate-x-1/2 -translate-y-1/2 text-sky-pale/60" />
              )}
              <span aria-hidden className="absolute inset-0 bg-linear-to-b from-transparent via-transparent to-scrim/80" />
              <span className="absolute top-2 right-2">
                <SaveLandmarkButton slug={landmark.slug} name={landmark.name} guests={trip.guests} />
              </span>
              <span className="relative text-sm font-bold leading-tight">{landmark.name}</span>
              <span className="relative text-small text-sky-pale">{line}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function StripStep({ direction, disabled, onClick }: { direction: "left" | "right"; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={direction === "left" ? "Previous places" : "More places"}
      className="flex size-11 items-center justify-center rounded-full border border-line-strong bg-surface text-navy transition-colors duration-300 ease-calm hover:bg-surface-2 disabled:border-line disabled:bg-surface-2 disabled:text-line-strong"
    >
      <ChevronGlyph direction={direction} className="size-4" />
    </button>
  );
}
