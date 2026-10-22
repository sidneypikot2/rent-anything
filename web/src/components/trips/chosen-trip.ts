"use client";

import { useSyncExternalStore } from "react";

// The trip a guest said they're working on, from the home page's Start your trip (TripChoiceSheet):
// one of their trips, or "new" for a trip that starts with the next add. Kept for the tab, so
// the place's page shows that trip (useTripHere) and the add sheet picks it (WhichTripSheet).
// Null when they haven't chosen: the page and the sheet go by the server's suggestion.
export type ChosenTrip = number | "new" | null;

const KEY = "chosen-trip";
const listeners = new Set<() => void>();
// Storage can be blocked; the choice then lasts until the page reloads.
let memory: string | null = null;

function read() {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return memory;
  }
}

export function chooseTrip(choice: number | "new") {
  memory = String(choice);
  try {
    sessionStorage.setItem(KEY, memory);
  } catch {
    // Kept in memory instead.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useChosenTrip(): ChosenTrip {
  const raw = useSyncExternalStore(subscribe, read, () => null);
  if (raw === "new") return "new";
  return raw && /^\d+$/.test(raw) ? Number(raw) : null;
}
