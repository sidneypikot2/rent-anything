import type { AreaCard, AreaDetail, Explore, PlanBusinessesPage } from "@/api/discovery";
import { descendants, islandOf } from "@/components/discovery/browse-offers";
import { GETTING_HERE } from "@/components/landing/launch-area";
import { areaPhoto, landmarkPhotos } from "@/components/landing/sample-photos";
import type { PlanPlace } from "./plan-data";

// What the plan reads of a place, from the API's answers: its places to see, its port and towns,
// how many options each step has (`counts`, from any plan_businesses page), and the island it is a
// town of. Shared by the plan's pages (`loadPlanPlace`, on the server) and the cart (`usePlanPlace`).
export function toPlanPlace(
  slug: string,
  detail: AreaDetail,
  explore: Explore | null,
  destinations: AreaCard[],
  counts: PlanBusinessesPage["counts"],
): PlanPlace {
  // The team's must-sees first, then the places tours go to: they are the ones a trip can reach.
  const landmarks = [...detail.landmarks].sort((a, b) => Number(b.must_see) - Number(a.must_see) || b.visited_by.length - a.visited_by.length);
  const photos = landmarkPhotos(landmarks, [areaPhoto(slug, detail.area.kind).src]);
  return {
    area: { slug: detail.area.slug, name: detail.area.name },
    kind: detail.area.kind,
    port: detail.port ?? null,
    towns: detail.areas.map((child) => ({ name: child.name, center: child.center })),
    places: [slug, ...descendants(destinations, slug).map((child) => child.slug), ...detail.areas.map((child) => child.slug)].filter(
      (each, index, all) => all.indexOf(each) === index,
    ),
    island: islandOf(destinations, slug),
    // Null when explore didn't answer: no map rather than one at 0,0.
    center: explore?.anchor.location ?? null,
    counts,
    landmarks: landmarks.map((landmark, index) => ({
      slug: landmark.slug,
      name: landmark.name,
      description: landmark.description,
      photo: photos[index],
      visitedBy: landmark.visited_by,
      tours: landmark.visits.map(({ id, title, price_from_cents }) => ({ id, title, priceFromCents: price_from_cents })),
      location: landmark.location,
      tags: landmark.tags.map(({ slug, name }) => ({ slug, name })),
      mustSee: landmark.must_see,
      boatDeparture: landmark.boat_departure ?? null,
    })),
    gettingHere: GETTING_HERE[slug] ?? null,
  };
}
