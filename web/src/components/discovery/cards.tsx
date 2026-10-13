import Image from "next/image";
import Link from "next/link";
import type { Activity, AreaCard } from "@/api/discovery";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardLink } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { GlassPanel } from "@/components/ui/glass";
import { TagGlyph } from "./tag-glyphs";
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

// "8 places to see · 9 to book", leaving out a count of nothing. `across` names the area
// when the counts include the places inside it, so the card and the area page agree.
export function countLine({ landmark_count, listing_count }: Counts, across?: string) {
  return [
    landmark_count > 0 && `${landmark_count} ${landmark_count === 1 ? "place" : "places"} to see`,
    listing_count > 0 && `${listing_count} to book${across ? ` across ${across}` : ""}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

// A destination's counts including the places listed inside it, so the island's card
// doesn't show fewer things to book than one of its towns.
export function withSubAreas(area: AreaCard, subAreas: AreaCard[]): Counts {
  return subAreas.reduce(
    (sum, sub) => ({
      landmark_count: sum.landmark_count + sub.landmark_count,
      listing_count: sum.listing_count + sub.listing_count,
    }),
    { landmark_count: area.landmark_count, listing_count: area.listing_count },
  );
}

// Text colours for a destination card on white, or on frosted glass over its photo.
const PLAIN = {
  strong: "text-foreground",
  muted: "text-muted",
  row: "hover:bg-surface-2",
  divider: "border-line",
  link: "text-link",
};
const ON_GLASS = {
  strong: "text-white",
  muted: "text-sky-mist",
  row: "hover:bg-white/15",
  divider: "border-white/20",
  link: "text-sky-pale",
};

// A destination on the home page: where it is, what to do there, how much there is, and the
// places inside it that have their own things to book. The whole card opens the destination
// (the heading's link stretches over it); the places inside it are links of their own above
// that. `wide` lays it out side by side from `sm` up, for a card that has a row to itself.
// With a `photo` the photo fills the card and the text sits on frosted glass over its foot
// (Sky & Forest, RAA-102); the API has no destination photos yet, so only the preview passes one.
export function DestinationCard({
  area,
  subAreas = [],
  wide = false,
  photo,
  className,
}: {
  area: AreaCard;
  subAreas?: AreaCard[];
  wide?: boolean;
  photo?: { src: string; alt: string };
  className?: string;
}) {
  const text = photo ? ON_GLASS : PLAIN;
  const body = (
    <>
      <div>
        <h3 className={cn("font-display text-2xl font-bold", photo && text.strong)}>
          <Link
            href={`/${area.slug}`}
            // The card clips its content, so the focus ring is drawn inside its edge.
            className="outline-none after:absolute after:inset-0 after:rounded-2xl after:content-[''] focus-visible:after:outline-2 focus-visible:after:-outline-offset-4 focus-visible:after:outline-primary"
          >
            {area.name}
          </Link>
        </h3>
        {area.parent_name && <p className={cn("text-sm", text.muted)}>{area.parent_name}, Philippines</p>}
      </div>
      {area.activities.length > 0 && (
        <p className={cn("text-sm", text.strong)}>
          <span className="sr-only">Things to do: </span>
          {area.activities.map((tag) => tag.name).join(" · ")}
        </p>
      )}
      {subAreas.length > 0 && (
        <div>
          <p className={cn("text-xs font-semibold uppercase tracking-wider", text.muted)}>Also in {area.name}</p>
          <ul className="mt-1">
            {subAreas.map((sub) => (
              <li key={sub.slug}>
                <Link
                  href={`/${sub.slug}`}
                  className={cn(
                    "relative z-10 -mx-2 flex min-h-11 items-center justify-between gap-3 rounded-lg px-2",
                    text.row,
                  )}
                >
                  <span className={cn("font-semibold", text.strong)}>{sub.name}</span>
                  <span className={cn("text-sm", text.muted)}>{countLine(sub)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className={cn("mt-auto flex min-h-11 items-center justify-between gap-x-3 border-t pt-3", text.divider)}>
        <p className={cn("min-w-0 text-sm", text.muted)}>
          {countLine(withSubAreas(area, subAreas), subAreas.length > 0 ? area.name : undefined)}
        </p>
        {/* What tapping the card does; the heading is the link. */}
        <span aria-hidden className={cn("shrink-0 whitespace-nowrap text-sm font-semibold", text.link)}>
          View destination →
        </span>
      </div>
    </>
  );

  if (photo) {
    return (
      <Card
        data-testid="destination-card"
        className={cn("relative isolate flex min-h-[26rem] flex-col justify-end p-3", className)}
      >
        <Image src={photo.src} alt={photo.alt} fill sizes="(min-width: 640px) 50vw, 100vw" className="-z-20 object-cover object-[50%_70%]" />
        <div aria-hidden className="absolute inset-0 -z-10 bg-linear-to-b from-transparent via-transparent to-scrim/50" />
        <Badge tone="mist" className="absolute left-3 top-3">
          {KIND_LABELS[area.kind] ?? area.kind}
        </Badge>
        <GlassPanel className="flex flex-col gap-3 rounded-xl p-4">{body}</GlassPanel>
      </Card>
    );
  }

  return (
    <Card
      data-testid="destination-card"
      className={cn(
        "relative flex flex-col transition-colors hover:border-primary",
        wide && "sm:flex-row",
        className,
      )}
    >
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
        {body}
      </CardBody>
    </Card>
  );
}

// "Browse by activity": an activity, how much there is to book for it (or, with nothing to
// book yet, how many places there are to see) and in how many destinations — the same words
// as the destination cards. The two counts stack, so a narrow card never wraps mid-phrase.
// A line icon in a tinted well beside the name, and the two counts on one line (Sky & Forest,
// RAA-102). With a `photo` the photo fills the card and those sit on frosted glass over its
// foot; the API has no activity photos yet, so only the preview passes one.
export function ActivityCard({ activity, photo }: { activity: Activity; photo?: { src: string; alt: string } }) {
  const toBook =
    activity.listing_count > 0
      ? `${activity.listing_count} to book`
      : `${activity.landmark_count} ${activity.landmark_count === 1 ? "place" : "places"} to see`;
  const where = `${activity.area_count} ${activity.area_count === 1 ? "destination" : "destinations"}`;
  if (photo) {
    return (
      <Link
        href={`/search?q=${encodeURIComponent(activity.name)}`}
        data-testid="activity-card"
        className="group relative isolate flex aspect-[4/5] flex-col justify-end overflow-hidden rounded-2xl p-2.5"
      >
        <Image
          src={photo.src}
          alt={photo.alt}
          fill
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
          className="-z-20 object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div aria-hidden className="absolute inset-0 -z-10 bg-linear-to-b from-transparent via-transparent to-scrim/60" />
        <GlassPanel className="flex items-center gap-2.5 rounded-xl p-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/25 bg-white/15 transition-colors group-hover:bg-primary">
            <TagGlyph slug={activity.slug} className="size-4" />
          </span>
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-sm leading-tight font-semibold">{activity.name}</span>
            <span className="text-xs leading-snug text-sky-mist">
              {toBook} · {where}
            </span>
          </span>
        </GlassPanel>
      </Link>
    );
  }
  return (
    <CardLink
      href={`/search?q=${encodeURIComponent(activity.name)}`}
      data-testid="activity-card"
      className="group flex items-center gap-4 p-4"
    >
      <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-mist text-primary transition-colors group-hover:bg-primary group-hover:text-white">
        <TagGlyph slug={activity.slug} className="size-6" />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="font-semibold text-foreground">{activity.name}</span>
        <span className="text-sm text-muted">
          {toBook} · {where}
        </span>
      </span>
    </CardLink>
  );
}
