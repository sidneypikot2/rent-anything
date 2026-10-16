import Image from "next/image";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import type { Activity, AreaCard } from "@/api/discovery";
import { Badge } from "@/components/ui/badge";
import { Eyebrow, Price } from "@/components/ui/typography";
import { Card, CardBody, CardLink } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { GlassPanel } from "@/components/ui/glass";
import { placeIcon } from "./icons";
import type { Feature } from "./listing-features";
import { ListingPhotos } from "./listing-photos";
import { DetailPanelButton, LandmarkPanel, ListingPanel, PanelActions, PanelPhoto } from "./detail-panel";
import { ListingRowDetails } from "./listing-row-details";
import { PhotoCardFrame, type Photo } from "./photo-card";
import { PHOTO_CARD, PHOTO_CARD_IMAGE, PHOTO_SCRIM, STRETCHED_LINK } from "./photo-card-styles";
import { CategoryGlyph, TagGlyph } from "./tag-glyphs";
import { AreaScene } from "./scenes";

export { PHOTO_CARD, PHOTO_CARD_IMAGE } from "./photo-card-styles";

const KIND_LABELS: Record<string, string> = {
  island: "Island",
  city: "City",
  town: "Town",
  province: "Province",
  region: "Region",
};

// The badge's tone on a destination's photo (RAA-130): islands and cities have their own.
const KIND_TONES: Record<string, "island" | "city"> = { island: "island", city: "city" };

// How tall a destination photo card is, the lead one and the rest; the home page's skeleton
// takes the same, so the cards arrive where it stood.
export const DESTINATION_HEIGHTS = { feature: "min-h-[26rem] sm:min-h-[28rem]", other: "h-80" };

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
  row: "hover:bg-glass-hover",
  divider: "border-glass-edge",
  link: "text-sky-pale",
};

// A destination on the home page: where it is, what to do there, how much there is, and the
// places inside it that have their own things to book. The whole card opens the destination
// (the heading's link stretches over it); the places inside it are links of their own above
// that. `wide` lays it out side by side from `sm` up, for a card that has a row to itself.
// With a `photo` the photo fills the card and the text sits on frosted glass over its foot
// (Sky & Forest, RAA-102); the API has no destination photos yet, so only the preview passes one.
// `feature` is the lead destination's card (RAA-108): once the card itself is wide enough (a
// container query, since the home grid gives it anything from a phone's width to the whole row)
// the glass stands as a panel at the foot of its right side, as tall as its contents, leaving
// most of the photo clear; narrower, it is the usual card. Otherwise the glass is at most max-w-md wide, so a
// card with a row to itself keeps its photo rather than a strip of glass. On a photo, what there
// is to do and the places inside it fold away until its info button or keyboard focus opens them
// (RAA-126), so every destination card is one height.
export function DestinationCard({
  area,
  subAreas = [],
  wide = false,
  feature = false,
  photo,
  className,
}: {
  area: AreaCard;
  subAreas?: AreaCard[];
  wide?: boolean;
  feature?: boolean;
  photo?: { src: string; alt: string };
  className?: string;
}) {
  const text = photo ? ON_GLASS : PLAIN;
  const head = (
    <>
      <h3 className={cn("truncate font-display text-2xl leading-tight font-extrabold tracking-tight", photo && text.strong)}>
        <Link href={`/${area.slug}`} className={STRETCHED_LINK}>
          {area.name}
        </Link>
      </h3>
      {area.parent_name && <p className={cn("truncate text-sm", text.muted)}>{area.parent_name}, Philippines</p>}
    </>
  );
  const details = (area.activities.length > 0 || subAreas.length > 0) && (
    <>
      {area.activities.length > 0 && (
        <p className={cn("text-sm", text.strong)}>
          <span className="sr-only">Things to do: </span>
          {area.activities.map((tag) => tag.name).join(" · ")}
        </p>
      )}
      {subAreas.length > 0 && (
        <div>
          <Eyebrow tone="inherit" className={text.muted}>Also in {area.name}</Eyebrow>
          <ul className="mt-1">
            {subAreas.map((sub) => (
              <li key={sub.slug}>
                <Link
                  href={`/${sub.slug}`}
                  className={cn(
                    "relative z-10 -mx-2 flex min-h-11 items-center justify-between gap-3 rounded-control px-2",
                    text.row,
                  )}
                >
                  <span className={cn("font-semibold", text.strong)}>{sub.name}</span>
                  <span className={cn("text-sm tabular-nums", text.muted)}>{countLine(sub)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
  const foot = (
    <div className={cn("mt-auto flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t pt-3", text.divider)}>
      <p className={cn("text-sm text-pretty", text.muted)}>
        {countLine(withSubAreas(area, subAreas), subAreas.length > 0 ? area.name : undefined)}
      </p>
      {/* What tapping the card does; the heading is the link. */}
      <span aria-hidden className={cn("shrink-0 whitespace-nowrap text-sm font-semibold", text.link)}>
        View destination{" "}
        <span className="inline-flex transition-transform duration-500 ease-calm group-hover:translate-x-1">→</span>
      </span>
    </div>
  );

  if (photo) {
    return (
      <PhotoCardFrame
        data-testid="destination-card"
        photo={photo}
        label={area.name}
        sizes={feature ? "(min-width: 72rem) 48rem, (min-width: 1024px) 67vw, 100vw" : "(min-width: 72rem) 36rem, (min-width: 640px) 50vw, 100vw"}
        height={feature ? DESTINATION_HEIGHTS.feature : DESTINATION_HEIGHTS.other}
        className={cn(feature && "@container", className)}
        scrimClassName={cn(feature && "@xl:bg-linear-to-r @xl:via-transparent @xl:to-scrim/45")}
        glassClassName={feature ? "@xl:ml-auto @xl:w-1/2 @xl:p-6 @4xl:w-[38%]" : "max-w-md"}
        badge={<Badge tone={KIND_TONES[area.kind] ?? "mist"}>{KIND_LABELS[area.kind] ?? area.kind}</Badge>}
        head={head}
        details={details || undefined}
        foot={foot}
      />
    );
  }

  return (
    <Card
      data-testid="destination-card"
      className={cn(
        "group relative flex flex-col transition-colors hover:border-primary",
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
        <div className="min-w-0">{head}</div>
        {details}
        {foot}
      </CardBody>
    </Card>
  );
}

// "Browse by activity": an activity, how much there is to book for it (or, with nothing to
// book yet, how many places there are to see) and in how many destinations — the same words
// as the destination cards. Each count keeps to one line, so a narrow card never wraps mid-phrase.
// A line icon in a tinted well beside the name, and the two counts on one line (Sky & Forest,
// RAA-102). With a `photo` the photo fills the card and those sit on frosted glass over its
// foot, one count to a line, as a quarter-row card is too narrow for both at 14px; the API has
// no activity photos yet, so only the preview passes one. In a phone's two columns the glass
// shows only how much there is to book, so it leaves the photo showing; the card's label still
// names both counts.
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
        // Named by its words: the photo's alt would otherwise lead every card's name. A comma, not
        // the visible dot, which some screen readers read out as "middle dot".
        aria-label={`${activity.name}: ${toBook}, ${where}`}
        className={cn(PHOTO_CARD, "flex aspect-[4/5] flex-col justify-end p-2 lg:aspect-[4/3.6] lg:p-3")}
      >
        <Image
          src={photo.src}
          alt={photo.alt}
          fill
          sizes="(min-width: 72rem) 18rem, (min-width: 1024px) 25vw, 50vw"
          className={PHOTO_CARD_IMAGE}
        />
        <div aria-hidden className={PHOTO_SCRIM} />
        {/* The name leads with its icon, the counts under it (RAA-130): tighter on a phone's two
            columns, where the glass sits 8px in rather than 12px. */}
        <GlassPanel tone="card" className="flex flex-col gap-0.5 rounded-control px-2.5 py-2 lg:px-3 lg:py-2.5">
          <span className="flex min-w-0 items-center gap-1.5 font-display text-[0.9375rem] leading-tight font-extrabold tracking-tight lg:text-[1.0625rem]">
            <TagGlyph slug={activity.slug} className="size-4 shrink-0 text-sky-pale" />
            <span className="line-clamp-2">{activity.name}</span>
          </span>
          <span className="flex flex-col text-xs leading-snug whitespace-nowrap text-sky-mist sm:text-[0.8125rem]">
            <span>{toBook}</span>
            <span className="hidden sm:block">{where}</span>
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
      <span className="flex size-12 shrink-0 items-center justify-center rounded-control bg-mist text-primary transition-colors group-hover:bg-primary group-hover:text-white">
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

// A place to see on a destination's page: its name and tags on the card, the whole of it in a
// side panel the card opens (RAA-126). Its `id` is the landmark's slug, so a search result can
// link straight to it (#kota-beach).
export function LandmarkCard({
  landmark,
  photo,
  areaName,
}: {
  landmark: { slug: string; name: string; description: string; tags: { slug: string; name: string }[] };
  photo: Photo;
  areaName: string;
}) {
  return (
    <PhotoCardFrame
      photo={photo}
      label={landmark.name}
      id={landmark.slug}
      data-testid="landmark"
      className="scroll-mt-24"
      head={
        <>
          <h3 className="flex min-w-0 items-center gap-2 font-semibold text-white">
            <span aria-hidden className="shrink-0 text-sky-pale">
              {placeIcon()}
            </span>
            <DetailPanelButton
              title={landmark.name}
              media={<PanelPhoto photo={photo} />}
              panel={<LandmarkPanel landmark={landmark} areaName={areaName} />}
              className="truncate"
            >
              {landmark.name}
            </DetailPanelButton>
          </h3>
          {landmark.tags.length > 0 && (
            <p className="truncate text-sm text-sky-mist">{landmark.tags.map((tag) => tag.name).join(" · ")}</p>
          )}
        </>
      }
    />
  );
}

// A thing to book: its category's icon, the title linking to the listing and a note line at
// rest, the summary folded away (RAA-126), and its price and an action (Add to trip) on the
// panel's last row, always showing.
export function ListingCard({
  href,
  title,
  category,
  note,
  summary,
  photo,
  price,
  action,
}: {
  href: string;
  title: string;
  category: string;
  note: string;
  summary?: string | null;
  photo: Photo;
  price?: ComponentProps<typeof Price>;
  action?: ReactNode;
}) {
  return (
    <PhotoCardFrame
      photo={photo}
      label={title}
      head={
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="flex size-9 shrink-0 items-center justify-center rounded-control border border-glass-edge bg-glass-fill text-white"
          >
            <CategoryGlyph name={category} className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <Link
              href={href}
              data-testid="listing-link"
              className="line-clamp-2 font-semibold break-words text-white underline-offset-4 hover:underline"
            >
              {title}
            </Link>
            <span className="block truncate text-sm text-sky-mist">{note}</span>
          </span>
        </div>
      }
      details={summary ? <p className="line-clamp-4 text-sm text-white/90">{summary}</p> : undefined}
      foot={
        (price || action) && (
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            {price ? <Price onDark {...price} /> : <span />}
            {action}
          </div>
        )
      }
    />
  );
}

// A thing to book as a row on white (RAA-125), for the area page's paper sheet: its photos to
// step through, then the title linking to the listing, its category and who offers it, a short
// summary and chips for what it includes, then its price and the action (Add to trip). It goes by
// its container's width (an @container around it), not the window's, as the area page's map can
// take half the window: stacked when narrow, a small photo beside the details from 24rem, and from
// 42rem the photo on the left and the price and action on the right. At
// rest the summary keeps to one line and the chips to two rows (RAA-126, ListingRowDetails).
export function ListingRow({
  listingId,
  href,
  title,
  category,
  by,
  summary,
  photos,
  samplePhoto = false,
  features,
  price,
  action,
}: {
  listingId: number;
  href: string;
  title: string;
  category: string;
  by: string;
  summary?: string | null;
  photos: Photo[];
  samplePhoto?: boolean;
  features: Feature[];
  price?: ComponentProps<typeof Price>;
  action?: ReactNode;
}) {
  return (
    // Top-aligned, so titles start on one line across rows whatever their summaries and chips.
    <Card className="relative grid gap-4 p-3 @sm:grid-cols-[10rem_minmax(0,1fr)] @2xl:grid-cols-[19rem_minmax(0,1fr)_auto] @2xl:items-start @2xl:gap-5">
      <ListingPhotos photos={photos} label={title} sample={samplePhoto} className="z-10 aspect-[16/10] @sm:aspect-square @2xl:aspect-[4/3]" />
      <div className="flex min-w-0 flex-col gap-2 px-1 @sm:px-0">
        <h3 className="text-lg leading-snug font-semibold text-balance">
          <DetailPanelButton
            data-testid="listing-open"
            title={title}
            media={<ListingPhotos photos={photos} label={title} sample={samplePhoto} count="bottom" className="aspect-[4/3]" />}
            panel={
              <ListingPanel
                listingId={listingId}
                href={href}
                category={category}
                by={by}
                summary={summary}
                features={features}
              />
            }
            actions={<PanelActions price={price} action={action} />}
            className="underline-offset-4 hover:underline"
          >
            {title}
          </DetailPanelButton>
        </h3>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
          <Badge tone="mist" className="min-h-6 px-2.5 text-xs">
            <CategoryGlyph name={category} className="size-3.5" />
            {category}
          </Badge>
          {by}
        </p>
        <ListingRowDetails summary={summary} features={features} />
      </div>
      {(price || action) && (
        <div className="relative z-10 flex items-center justify-between gap-3 border-t border-line px-1 pt-3 @sm:col-span-2 @2xl:col-span-1 @2xl:flex-col @2xl:items-end @2xl:justify-start @2xl:border-0 @2xl:px-0 @2xl:pt-1">
          {/* No price yet for rentals and transfers (only stays and tours are priced), so nothing
              is promised here. */}
          {price ? <Price {...price} /> : <span />}
          {action}
        </div>
      )}
    </Card>
  );
}
