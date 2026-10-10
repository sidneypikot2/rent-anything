import type { Explore, ExplorePlace } from "@/api/discovery";
import { CardLink } from "@/components/ui/card";
import { SectionTitle } from "@/components/ui/typography";
import { areaIcon } from "./icons";

// "Nearby destinations" and "Often visited with" for one destination (RAA-58), from the
// explore endpoint. Recommendations are curated links: they lead to another destination's
// page and never add its listings here.
export function ExploreSections({ explore, name }: { explore: Explore; name: string }) {
  const { destinations, recommendations } = explore;
  if (destinations.length === 0 && recommendations.length === 0) return null;

  return (
    <>
      {recommendations.length > 0 && (
        <PlaceGroup
          testId="often-visited-with"
          title={`Often visited with ${name}`}
          places={recommendations.map((place) => ({
            ...place,
            note: place.reason === "bundled" ? "Often done on the same trip" : "Next door",
          }))}
        />
      )}
      {destinations.length > 0 && (
        <PlaceGroup
          testId="nearby-destinations"
          title="Nearby destinations"
          places={destinations.map((place) => ({ ...place, note: `${place.distance_km.toFixed(1)} km away` }))}
        />
      )}
    </>
  );
}

function PlaceGroup({ testId, title, places }: { testId: string; title: string; places: (ExplorePlace & { note: string })[] }) {
  return (
    <section data-testid={testId} className="flex flex-col gap-3">
      <SectionTitle>{title}</SectionTitle>
      <ul className="grid gap-2 sm:grid-cols-2">
        {places.map((place) => (
          <li key={`${place.type}-${place.slug}`}>
            <CardLink href={placeHref(place)} className="flex items-center gap-3 p-3">
              <span aria-hidden className="text-2xl">
                {place.kind ? areaIcon(place.kind) : "📍"}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{place.name}</span>
                <span className="block truncate text-sm text-muted">{place.note}</span>
              </span>
            </CardLink>
          </li>
        ))}
      </ul>
    </section>
  );
}

// The explore places minus what the destination's page already shows or holds (RAA-85): its
// own landmarks, the places inside it and their landmarks, which would otherwise come back
// as "nearby".
export function withoutShown(
  explore: Explore,
  shown: { landmarks: { slug: string }[]; areas: Set<string> },
): Explore {
  const landmarks = new Set(shown.landmarks.map((landmark) => landmark.slug));
  const keep = (place: ExplorePlace) =>
    place.type === "landmark"
      ? !landmarks.has(place.slug) && !shown.areas.has(place.area_slug)
      : !shown.areas.has(place.slug);
  return {
    ...explore,
    destinations: explore.destinations.filter(keep),
    recommendations: explore.recommendations.filter(keep),
  };
}

// An area's own page, or a landmark on its area's page.
function placeHref(place: ExplorePlace): string {
  return place.type === "landmark" ? `/${place.area_slug}#${place.slug}` : `/${place.slug}`;
}
