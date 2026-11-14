"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { addDays, todayIso } from "./format";

// The window the booking card's calendar asks about: from today, as many days as the API answers.
const WINDOW_DAYS = 92;

// A listing's units free each day from today (RAA-315, GET /listings/{id}/availability), as
// "YYYY-MM-DD" => count, for the booking card's calendar; undefined while it loads or off.
export function useListingAvailability(listingId: number, enabled = true) {
  const from = todayIso();
  const to = addDays(from, WINDOW_DAYS - 1);
  const query = useQuery({
    enabled,
    queryKey: ["listing-availability", listingId, from],
    queryFn: async () => {
      const { data, error } = await apiClient().GET("/api/v1/listings/{listing_id}/availability", {
        params: { path: { listing_id: listingId }, query: { from, to } },
      });
      if (error || !data) throw new Error("Couldn't load what is free");
      return Object.fromEntries(data.days.map((day) => [day.date, day.units_free]));
    },
    staleTime: 60_000,
  });
  return query.data;
}

// The longest run of days from `from` to the day before `to` with a unit free (the rental's
// days; its return day needn't be), as a rental range: the card opens on it rather than on dates
// it can't cover. The range itself when every day is free, or nothing is known; null when none is.
export function freeRun(free: Record<string, number> | undefined, from: string, to: string) {
  if (!free || !from || !to || to <= from) return { from, to };
  type Run = { from: string; to: string; days: number };
  let best: Run | null = null;
  let run: Run | null = null;
  for (let day = from; day < to; day = addDays(day, 1)) {
    if ((free[day] ?? 1) > 0) {
      const next: Run = run ? { from: run.from, to: addDays(day, 1), days: run.days + 1 } : { from: day, to: addDays(day, 1), days: 1 };
      run = next;
      if (!best || next.days > best.days) best = next;
    } else {
      run = null;
    }
  }
  return best ? { from: best.from, to: best.to } : null;
}
