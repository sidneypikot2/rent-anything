"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { fetchAreas } from "@/components/discovery/search-box";
import { tripPlaceSlug } from "@/components/landing/plan-trip-start";
import type { Trip } from "@/components/trips/use-trips";
import type { PlanPlace } from "./plan-data";
import { toPlanPlace } from "./plan-place";

// What the plan reads of a place, in the browser (the cart's and /trips' review): the same answers
// `loadPlanPlace` asks for on the server, through `toPlanPlace`.
async function fetchPlanPlace(slug: string, areas: Awaited<ReturnType<typeof fetchAreas>>): Promise<PlanPlace | null> {
  const client = apiClient();
  const [detail, explore, stays] = await Promise.all([
    client.GET("/api/v1/areas/{slug}", { params: { path: { slug } } }),
    client.GET("/api/v1/explore", { params: { query: { area: slug, listings: "0" } } }).catch(() => null),
    client.GET("/api/v1/areas/{slug}/plan_businesses", { params: { path: { slug }, query: { group: "stay" } } }),
  ]);
  if (!detail.data || !stays.data) return null;
  return toPlanPlace(slug, detail.data, explore?.data ?? null, areas, stays.data.counts);
}

// The place a trip is planned in (`tripPlaceSlug`) and what the plan reads of it. `place` is null
// while it loads or when it can't be had: the review then shows the days without it (no stops,
// ideas or step counts), never nothing.
export function usePlanPlace(trip: Trip) {
  const areas = useQuery({ queryKey: ["areas"], queryFn: fetchAreas, staleTime: 5 * 60_000 });
  const slug = areas.data ? tripPlaceSlug(trip, areas.data) : null;
  const place = useQuery({
    enabled: Boolean(slug && areas.data),
    queryKey: ["plan-place", slug],
    queryFn: () => fetchPlanPlace(slug!, areas.data!),
    staleTime: 5 * 60_000,
  });
  return { slug, place: place.data ?? null };
}
