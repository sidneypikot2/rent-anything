"use client";

import { useSyncExternalStore } from "react";

// The trip's plan on a place's page has one panel (TripPlan, mounted with the banner) and three
// ways in: the phone's trip row, the first chip of What to book's row (the rail's first entry
// from lg), and the wide trip card. They live in different parts of the page, so the panel's
// open state and the count they show ("Your plan · 1") sit here rather than in props.
export type PlanSummary = { missing: number; problem: boolean };

let open = false;
let summary: PlanSummary | null = null;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export function openPlan() {
  open = true;
  emit();
}

export function closePlan() {
  open = false;
  emit();
}

// The shown trip's count, or null while the page shows none (signed out, no trip, loading).
export function setPlanSummary(next: PlanSummary | null) {
  if (next?.missing === summary?.missing && next?.problem === summary?.problem && (next === null) === (summary === null))
    return;
  summary = next;
  emit();
}

export const usePlanOpen = () => useSyncExternalStore(subscribe, () => open, () => false);
export const usePlanSummary = () => useSyncExternalStore(subscribe, () => summary, () => null);
