import { cache } from "react";
import { getAreaPlaces, getDestinations, getExplore, getPlanBusinesses } from "@/api/discovery";
import { descendants, islandOf } from "@/components/discovery/browse-offers";
import { GETTING_HERE } from "@/components/landing/launch-area";
import { areaPhoto, landmarkPhotos } from "@/components/landing/sample-photos";
import type { PlanPlace } from "./plan-data";

// What the plan's steps read of a place, on the server: its places to see (the area page's own
// data, without its listings: a step pages through those), with the points explore gives them
// (rounded), how many options each step has, and the island it is a town of. Null for an unknown
// place. Cached per request: a page and its metadata share it.
export const loadPlanPlace = cache(async (slug: string): Promise<PlanPlace | null> => {
  const [detail, explore, destinations, stays] = await Promise.all([
    getAreaPlaces(slug),
    getExplore({ area: slug, listings: "0" }).catch(() => null),
    getDestinations().catch(() => []),
    // Every group's count comes with any step's page; the stays' is the one most opened first.
    getPlanBusinesses(slug, "stay"),
  ]);
  if (!detail || !stays) return null;
  const placePoints = new Map(
    (explore?.destinations ?? []).filter((each) => each.type === "landmark").map((each) => [each.slug, each.location]),
  );
  // The places tours go to first: they are the ones a trip can reach.
  const landmarks = [...detail.landmarks].sort((a, b) => b.visited_by.length - a.visited_by.length);
  const photos = landmarkPhotos(landmarks, [areaPhoto(slug, detail.area.kind).src]);
  return {
    area: { slug: detail.area.slug, name: detail.area.name },
    places: [slug, ...descendants(destinations, slug).map((child) => child.slug), ...detail.areas.map((child) => child.slug)].filter(
      (each, index, all) => all.indexOf(each) === index,
    ),
    island: islandOf(destinations, slug),
    // Null when explore didn't answer: no map rather than one at 0,0.
    center: explore?.anchor.location ?? null,
    counts: stays.counts,
    landmarks: landmarks.map((landmark, index) => ({
      slug: landmark.slug,
      name: landmark.name,
      description: landmark.description,
      photo: photos[index],
      visitedBy: landmark.visited_by,
      location: placePoints.get(landmark.slug) ?? null,
    })),
    gettingHere: GETTING_HERE[slug] ?? null,
  };
});
