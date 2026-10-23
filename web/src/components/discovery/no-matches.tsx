import type { AreaCard } from "@/api/discovery";
import { BRAND } from "@/lib/brand";
import { LAUNCH_AREA } from "@/components/landing/launch-area";
import { withDates } from "@/components/trips/trip-dates";
import { cn } from "@/components/ui/cn";
import { PillLink } from "@/components/ui/pill";
import { groupDestinations } from "./cards";
import { TRIP_ORDER_GROUPS } from "./categories";
import { areaIcon } from "./icons";
import { CategoryGlyph } from "./tag-glyphs";

// Nothing found is not a dead end, in the search's suggestions and on /search alike: the places
// the site has so far (once they're known), then the launch area's kinds of things to book, one
// tap away, named and ordered as the hero's shortcuts (TRIP_ORDER_GROUPS). `carry`: the dates and
// guests, kept on every link.
export function NoMatches({
  query,
  carry,
  destinations,
  short = false,
  className,
}: {
  query: string;
  carry: string;
  destinations?: AreaCard[];
  // Too short to search (/search with one letter): no "Nothing matches" line, only where to go.
  short?: boolean;
  className?: string;
}) {
  const places = destinations ? groupDestinations(destinations).map(({ area }) => area) : [];
  return (
    <div data-testid="search-empty" className={cn("flex flex-col gap-3", className)}>
      <p role="status" className="text-pretty">
        {!short && (
          <>
            <span className="font-semibold">Nothing matches “{query}” yet.</span>{" "}
          </>
        )}
        {places.length > 0 ? `${placesLine(places.map((area) => area.name))} so far:` : `Browse ${LAUNCH_AREA.name}:`}
      </p>
      {places.length > 0 && (
        <ul aria-label={`Places on ${BRAND}`} className="flex flex-wrap gap-2">
          {places.map((area) => (
            <li key={area.slug}>
              <PillLink href={withDates(`/${area.slug}`, carry)}>
                <span aria-hidden className="text-primary">
                  {areaIcon(area.kind)}
                </span>
                {area.name}
              </PillLink>
            </li>
          ))}
        </ul>
      )}
      {places.length > 0 && <p className="text-sm text-muted">Or browse {LAUNCH_AREA.name}:</p>}
      <ul aria-label={`Browse ${LAUNCH_AREA.name}`} className="flex flex-wrap gap-2">
        {TRIP_ORDER_GROUPS.map((group) => (
          <li key={group.id}>
            <PillLink href={withDates(`/${LAUNCH_AREA.slug}?show=${group.id}#listings`, carry)}>
              <CategoryGlyph name={group.icon} className="size-4.5 shrink-0 text-primary" />
              {group.short}
            </PillLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

// "We're on Bantayan Island", "… and Cebu City", "…, Santa Fe and Cebu City".
function placesLine(names: string[]) {
  const list = names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
  return `We're on ${list}`;
}
