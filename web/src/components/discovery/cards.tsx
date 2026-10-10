import Link from "next/link";
import type { Activity, AreaCard } from "@/api/discovery";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardLink } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { tagIcon } from "./icons";
import { AreaScene } from "./scenes";

const KIND_LABELS: Record<string, string> = {
  island: "Island",
  city: "City",
  town: "Town",
  province: "Province",
  region: "Region",
};

export type DestinationGroup = { area: AreaCard; subAreas: AreaCard[] };

// Destinations as the home page shows them: an area inside another listed one (Santa Fe on
// Bantayan Island) goes in the card of its top-most listed ancestor, however deep; one whose
// parent isn't listed stays a card of its own. Cards are ordered by how much there is to book
// in them, sub-areas included; sub-areas keep the API's order (most to book first).
export function groupDestinations(areas: AreaCard[]): DestinationGroup[] {
  const bySlug = new Map(areas.map((area) => [area.slug, area]));
  const root = (area: AreaCard) => {
    let top = area;
    const seen = new Set([area.slug]);
    while (top.parent_slug && bySlug.has(top.parent_slug) && !seen.has(top.parent_slug)) {
      top = bySlug.get(top.parent_slug)!;
      seen.add(top.slug);
    }
    return top;
  };
  const groups = areas
    .filter((area) => root(area) === area)
    .map((area) => ({ area, subAreas: areas.filter((sub) => sub !== area && root(sub) === area) }));
  const toBook = ({ area, subAreas }: DestinationGroup) => withSubAreas(area, subAreas).listing_count;
  return groups.sort((a, b) => toBook(b) - toBook(a));
}

type Counts = Pick<AreaCard, "landmark_count" | "listing_count">;

// "8 places to see · 9 to book", leaving out a count of nothing.
function countLine({ landmark_count, listing_count }: Counts) {
  return [
    landmark_count > 0 && `${landmark_count} ${landmark_count === 1 ? "place" : "places"} to see`,
    listing_count > 0 && `${listing_count} to book`,
  ]
    .filter(Boolean)
    .join(" · ");
}

// A destination's counts including the places listed inside it, so the island's card
// doesn't show fewer things to book than one of its towns.
function withSubAreas(area: AreaCard, subAreas: AreaCard[]): Counts {
  return subAreas.reduce(
    (sum, sub) => ({
      landmark_count: sum.landmark_count + sub.landmark_count,
      listing_count: sum.listing_count + sub.listing_count,
    }),
    { landmark_count: area.landmark_count, listing_count: area.listing_count },
  );
}

// A destination on the home page: where it is, what to do there, how much there is, and the
// places inside it that have their own things to book. `wide` lays it out side by side from
// `sm` up, for a card that has a row to itself.
export function DestinationCard({
  area,
  subAreas = [],
  wide = false,
  className,
}: {
  area: AreaCard;
  subAreas?: AreaCard[];
  wide?: boolean;
  className?: string;
}) {
  return (
    <Card data-testid="destination-card" className={cn("flex flex-col", wide && "sm:flex-row", className)}>
      <div
        className={cn(
          "relative h-36 border-b border-line",
          wide && "sm:h-auto sm:w-2/5 sm:shrink-0 sm:border-b-0 sm:border-r",
        )}
      >
        <AreaScene kind={area.kind} />
        <Badge className="absolute left-3 top-3">{KIND_LABELS[area.kind] ?? area.kind}</Badge>
      </div>
      <CardBody pad="lg" className="flex flex-1 flex-col gap-3">
        <div>
          <h3 className="font-display text-2xl font-bold">{area.name}</h3>
          {area.parent_name && (
            <p className="text-sm text-muted">
              <span aria-hidden>📍</span> {area.parent_name}, Philippines
            </p>
          )}
        </div>
        {area.activities.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {area.activities.map((tag) => (
              <Badge key={tag.slug} tone="mist">
                <span aria-hidden>{tagIcon(tag.slug)}</span> {tag.name}
              </Badge>
            ))}
          </div>
        )}
        {subAreas.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Also in {area.name}</p>
            <ul className="mt-1">
              {subAreas.map((sub) => (
                <li key={sub.slug}>
                  <Link
                    href={`/${sub.slug}`}
                    className="-mx-2 flex min-h-11 items-center justify-between gap-3 rounded-lg px-2 hover:bg-surface-2"
                  >
                    <span className="font-semibold text-foreground">{sub.name}</span>
                    <span className="text-sm text-muted">{countLine(sub)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
          <p className="text-sm text-muted">{countLine(withSubAreas(area, subAreas))}</p>
          <ButtonLink href={`/${area.slug}`} variant="soft" size="sm" className="shrink-0 whitespace-nowrap">
            View destination
          </ButtonLink>
        </div>
      </CardBody>
    </Card>
  );
}

// "Browse by activity": an activity and how many destinations offer it.
export function ActivityCard({ activity }: { activity: Activity }) {
  return (
    <CardLink
      href={`/search?q=${encodeURIComponent(activity.name)}`}
      data-testid="activity-card"
      className="flex flex-col items-center gap-2 p-4 text-center"
    >
      <span aria-hidden className="flex size-12 items-center justify-center rounded-full bg-fern/50 text-2xl">
        {tagIcon(activity.slug)}
      </span>
      <span className="font-semibold text-foreground">{activity.name}</span>
      <span className="text-xs text-muted">
        {activity.area_count} {activity.area_count === 1 ? "destination" : "destinations"} · {activity.landmark_count}{" "}
        {activity.landmark_count === 1 ? "spot" : "spots"}
      </span>
    </CardLink>
  );
}
