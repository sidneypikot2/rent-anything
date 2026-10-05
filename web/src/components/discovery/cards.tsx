import Link from "next/link";
import type { Activity, AreaCard } from "@/api/discovery";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { areaIcon, tagIcon } from "./icons";

const KIND_LABELS: Record<string, string> = {
  island: "Island",
  city: "City",
  town: "Town",
  province: "Province",
  region: "Region",
};

// A destination on the home page: where it is, what to do there, how much there is.
export function DestinationCard({ area }: { area: AreaCard }) {
  return (
    <Card data-testid="destination-card" className="flex flex-col">
      <div className="relative flex h-36 items-center justify-center border-b border-line bg-sage text-6xl">
        <span aria-hidden>{areaIcon(area.kind)}</span>
        <Badge className="absolute left-3 top-3">{KIND_LABELS[area.kind] ?? area.kind}</Badge>
      </div>
      <CardBody pad="lg" className="flex flex-1 flex-col gap-3">
        <div>
          <h3 className="font-display text-2xl font-bold">{area.name}</h3>
          {area.parent_name && <p className="text-sm text-muted">📍 {area.parent_name}, Philippines</p>}
        </div>
        {area.activities.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {area.activities.map((tag) => (
              <Badge key={tag.slug} tone="mist">
                {tagIcon(tag.slug)} {tag.name}
              </Badge>
            ))}
          </div>
        )}
        <div className="mt-auto flex items-center justify-between gap-3 border-t border-line pt-3">
          <p className="text-sm text-muted">
            {area.landmark_count} places to see · {area.listing_count} to book
          </p>
          <ButtonLink href={`/${area.slug}`} variant="soft" size="sm">
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
    <Link
      href={`/search?q=${encodeURIComponent(activity.name)}`}
      data-testid="activity-card"
      className="group flex flex-col items-center gap-2 rounded-2xl border-[1.5px] border-line bg-surface p-4 text-center transition-colors hover:border-primary hover:bg-surface-2"
    >
      <span aria-hidden className="flex size-12 items-center justify-center rounded-full bg-fern/50 text-2xl">
        {tagIcon(activity.slug)}
      </span>
      <span className="font-semibold text-foreground">{activity.name}</span>
      <span className="text-xs text-muted">
        {activity.area_count} {activity.area_count === 1 ? "destination" : "destinations"} · {activity.landmark_count}{" "}
        {activity.landmark_count === 1 ? "spot" : "spots"}
      </span>
    </Link>
  );
}
