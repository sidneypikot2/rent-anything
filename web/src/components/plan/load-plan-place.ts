import { cache } from "react";
import { getAreaPlaces, getDestinations, getExplore, getPlanBusinesses } from "@/api/discovery";
import type { PlanPlace } from "./plan-data";
import { toPlanPlace } from "./plan-place";

// What the plan's steps read of a place, on the server: its places to see (the area page's own
// data, without its listings: a step pages through those), its port and towns, how many options
// each step has, and the island it is a town of. Null for an unknown place. Cached per request: a
// page and its metadata share it.
export const loadPlanPlace = cache(async (slug: string): Promise<PlanPlace | null> => {
  const [detail, explore, destinations, stays] = await Promise.all([
    getAreaPlaces(slug),
    getExplore({ area: slug, listings: "0" }).catch(() => null),
    getDestinations().catch(() => []),
    // Every group's count comes with any step's page; the stays' is the one most opened first.
    getPlanBusinesses(slug, "stay"),
  ]);
  if (!detail || !stays) return null;
  return toPlanPlace(slug, detail, explore, destinations, stays.counts);
});
