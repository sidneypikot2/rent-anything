"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { Trip } from "@/components/trips/use-trips";
import { picksHere, PLACES_ROW, PLAN_ROWS, rowDone, type PlanPlace, type PlanStepRow, type StepKey } from "./plan-data";
import type { PlanStop } from "./plan-steps";

// The planner's one track (UX-laws review, Gap 2, 2026-11-11): Trip (step 1), the checklist's
// steps, then Review, built here once so the checklist and the review always show the same stops.

const TRIP_TITLE = "Where, when and who";
const REVIEW_TITLE = "Review";

// The checklist's steps for a place: Places to see where it has some, Where you'll stay always,
// the rest where the place has options. `done`: the trip has the step here (a pick, for Places to see).
export function planSteps(place: PlanPlace, trip: Trip) {
  const rows: PlanStepRow[] = [
    ...(place.landmarks.length > 0 ? [PLACES_ROW] : []),
    ...PLAN_ROWS.filter((row) => row.key === "stay" || place.counts[row.key] > 0),
  ];
  const picks = picksHere(trip, place);
  const done = new Map(rows.map((row) => [row.key, row.key === "places" ? picks.length > 0 : rowDone(trip, row.key, place)]));
  return { rows, done, picks };
}

// The trip's whole track: Trip (done: it exists) and Review link to their pages; a step links to
// `stepHref` when given (from Review), else opens on the checklist's own page.
export function planStops({
  rows,
  done,
  skipped,
  tripHref,
  reviewHref,
  stepHref,
}: {
  rows: PlanStepRow[];
  done: Map<StepKey, boolean>;
  skipped: Set<StepKey>;
  tripHref: string;
  reviewHref: string;
  stepHref?: (key: StepKey) => string;
}): PlanStop[] {
  return [
    { key: "trip", title: TRIP_TITLE, state: "done", href: tripHref },
    ...rows.map((row): PlanStop => ({
      key: row.key,
      title: row.title,
      state: done.get(row.key) ? "done" : skipped.has(row.key) ? "skipped" : "open",
      href: stepHref?.(row.key),
    })),
    { key: "review", title: REVIEW_TITLE, state: "open", href: reviewHref },
  ];
}

// Step 1's track, before there is a trip or a place's steps are known: every stop a place can
// have, shown ahead but not open yet.
export const PREVIEW_STOPS: PlanStop[] = [
  { key: "trip", title: TRIP_TITLE, state: "open" },
  ...[PLACES_ROW, ...PLAN_ROWS].map((row): PlanStop => ({ key: row.key, title: row.title, state: "open", preview: true })),
  { key: "review", title: REVIEW_TITLE, state: "open", preview: true },
];

// Step 1's link back from the checklist and the review.
export const tripStepHref = (trip: Trip, slug: string) => `/plan?trip=${trip.id}&where=${slug}`;
export const reviewStepHref = (trip: Trip, slug: string) => `/plan/${slug}/review?trip=${trip.id}`;

// The steps the guest skipped on this trip, kept in this browser (a convenience: Review still
// names what's missing). Storage can be blocked; the choice then lasts the visit.
const SKIP_EVENT = "plan-skip";
export function useSkipped(tripId: number): [Set<StepKey>, (key: StepKey) => void] {
  const key = `plan-skipped-${tripId}`;
  const read = useCallback(() => {
    try {
      return localStorage.getItem(key) ?? "";
    } catch {
      return memory.get(key) ?? "";
    }
  }, [key]);
  const raw = useSyncExternalStore(subscribeSkips, read, () => "");
  const skipped = new Set(raw.split(",").filter(Boolean) as StepKey[]);
  const toggle = (row: StepKey) => {
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
