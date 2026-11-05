import { HeartGlyph, PlaceGlyph } from "@/components/discovery/tag-glyphs";
import { cn } from "@/components/ui/cn";

type Stop = { slug: string; name: string };

export const stopsText = (count: number) => `Stops at ${count} ${count === 1 ? "place" : "places"}`;

// What a tour's stops cover of the trip's picks. No count while they cover none, or on a page
// with no place to count picks in.
function coverText(stops: Stop[], covered: number, picks: number | null) {
  if (picks === null || covered === 0) return stopsText(stops.length);
  if (covered < picks) return `Covers ${covered} of your ${picks} picks`;
  if (picks === 1) return "Covers your pick";
  return picks === 2 ? "Covers both of your picks" : `Covers all ${picks} of your picks`;
}

// The places a tour includes, in the add sheet: each stop as the guest's pick or an extra, and the
// picks here it misses, in the words the review then uses. Nothing for a listing with no stops.
export function AddSheetStops({
  stops,
  saved,
  places,
}: {
  stops: Stop[];
  // What the trip being added to has saved.
  saved: (Stop & { area_slug: string })[];
  places?: string[];
}) {
  if (stops.length === 0) return null;
  const picked = new Set(saved.map((pick) => pick.slug));
  const onTour = new Set(stops.map((stop) => stop.slug));
  const here = places ? saved.filter((pick) => places.includes(pick.area_slug)) : null;
  const covered = here?.filter((pick) => onTour.has(pick.slug)).length ?? 0;
  const missed = here?.filter((pick) => !onTour.has(pick.slug)) ?? [];
  const ordered = [...stops.filter((stop) => picked.has(stop.slug)), ...stops.filter((stop) => !picked.has(stop.slug))];
  return (
    <section className="flex flex-col gap-2 rounded-card border border-line p-3" aria-label="What this tour includes" data-testid="add-sheet-stops">
      <p className={cn("text-sm font-semibold", covered > 0 ? "text-forest" : "text-navy")} data-testid="add-sheet-cover">
        {coverText(stops, covered, here && here.length)}
      </p>
      <ul className="flex flex-col divide-y divide-line">
        {ordered.map((stop) => {
          const pick = picked.has(stop.slug);
          return (
            <li key={stop.slug} className="flex items-center gap-2 py-1.5 text-sm text-navy" data-testid="add-sheet-stop">
              {pick ? <HeartGlyph filled className="size-4 shrink-0 text-forest" /> : <PlaceGlyph className="size-4 shrink-0 text-muted" />}
              <span className="min-w-0 flex-1">{stop.name}</span>
              <span className={cn("shrink-0 text-small", pick ? "font-semibold text-forest" : "text-muted")}>{pick ? "Your pick" : "Also included"}</span>
            </li>
          );
        })}
      </ul>
      {missed.length > 0 && (
        <p className="text-small text-muted" data-testid="add-sheet-missed">
          Not on this tour: {missed.map((pick) => pick.name).join(", ")}
        </p>
      )}
    </section>
  );
}
