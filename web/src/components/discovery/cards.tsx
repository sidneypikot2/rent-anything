import Image from "next/image";
import type { ComponentProps, ReactNode } from "react";
import type { Activity, AreaCard } from "@/api/discovery";
import { Badge } from "@/components/ui/badge";
import { Price } from "@/components/ui/typography";
import { Card, CardBody, CardLink } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { GlassPanel } from "@/components/ui/glass";
import { HeroTripLink } from "@/components/landing/hero-trip";
import { isApiPhoto } from "@/components/landing/sample-photos";
import { InTripBadge } from "@/components/trips/in-trip-badge";
import type { TripDates } from "@/components/trips/trip-dates";
import { GROUP_ICON } from "./categories";
import { placeIcon } from "./icons";
import { InstantBookBadge } from "./instant-book-badge";
import type { LandmarkVisit } from "./area-map-pins";
import type { Feature } from "./listing-features";
import { LandmarkLine, LandmarkToursButton, type LandmarkTour } from "./landmark-tours";
import { ListingPhotos } from "./listing-photos";
import { DetailPanelButton, LandmarkPanel, ListingPanel, PanelActions, PanelPhoto } from "./detail-panel";
import { ListingRowDetails } from "./listing-row-details";
import { PhotoCardFrame, SamplePhotoTag, type Photo } from "./photo-card";
import { PHOTO_CARD, PHOTO_CARD_IMAGE, PHOTO_SCRIM, STRETCHED_LINK } from "./photo-card-styles";
import { ArrowGlyph, CategoryGlyph, PlaceGlyph, TagGlyph } from "./tag-glyphs";
import { AreaScene, PlaceScene } from "./scenes";

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
  const toBook = ({ area }: DestinationGroup) => area.to_book_count;
  return groups.sort((a, b) => toBook(b) - toBook(a));
}

type Counts = Pick<AreaCard, "landmark_count" | "to_book_count">;

// "8 places to see · 10 to book", leaving out a count of nothing. "To book" is what the place's
// own page counts (`to_book_count`: a partner's offers in one kind of thing, the places inside
// it included), so the number a guest picks a destination by is the one its banner shows.
export function countLine({ landmark_count, to_book_count }: Counts) {
  return [
    landmark_count > 0 && `${landmark_count} ${landmark_count === 1 ? "place" : "places"} to see`,
    to_book_count > 0 && `${to_book_count} to book`,
  ]
    .filter(Boolean)
    .join(" · ");
}

// A destination's counts including the places listed inside it, so the island's card
// doesn't show fewer places to see than one of its towns. Its to_book_count has them already.
export function withSubAreas(area: AreaCard, subAreas: AreaCard[]): Counts {
  return {
    landmark_count: subAreas.reduce((sum, sub) => sum + sub.landmark_count, area.landmark_count),
    to_book_count: area.to_book_count,
  };
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
// the glass stands as a panel at the foot of its left side, under the section's heading and with
// the padding of the cards beside it, so their titles and counts line up across the row, leaving
// most of the photo clear; narrower, it is the usual card. Every card's glass, the lead's too, is at
// most max-w-md wide, so cards side by side have the same panel and a wide card keeps its photo
// rather than a strip of glass. On a photo, what there
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
      <h3 className={cn("line-clamp-2 font-display text-2xl leading-tight font-extrabold tracking-tight text-balance break-words", photo && text.strong)}>
        <HeroTripLink href={`/${area.slug}`} className={STRETCHED_LINK}>
          {area.name}
        </HeroTripLink>
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
          <p className={cn("text-sm font-semibold", text.muted)}>Also in {area.name}</p>
          <ul className="mt-1">
            {subAreas.map((sub) => (
              <li key={sub.slug}>
                <HeroTripLink
                  href={`/${sub.slug}`}
                  className={cn(
                    "relative z-10 -mx-2 flex min-h-11 items-center justify-between gap-3 rounded-control px-2",
                    text.row,
                  )}
                >
                  <span className={cn("font-semibold", text.strong)}>{sub.name}</span>
                  <span className={cn("text-sm tabular-nums", text.muted)}>{countLine(sub)}</span>
                </HeroTripLink>
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
        {/* The card's title names the area, so the counts, which include its towns, don't again. */}
        {countLine(withSubAreas(area, subAreas))}
      </p>
      {/* What tapping the card does; the heading is the link. */}
      <span aria-hidden className={cn("flex shrink-0 items-center gap-1 whitespace-nowrap text-sm font-semibold", text.link)}>
        View destination
        <ArrowGlyph className="size-4 transition-transform duration-500 ease-calm motion-safe:group-hover:translate-x-1" />
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
        scrimClassName={cn(feature && "@xl:bg-linear-to-l @xl:via-transparent @xl:to-scrim/45")}
        glassClassName={cn(feature && "max-w-md @xl:w-1/2 @4xl:w-[38%]")}
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
      ? `${activity.listing_count} ${activity.listing_count === 1 ? "thing" : "things"} to book`
      : `${activity.landmark_count} ${activity.landmark_count === 1 ? "place" : "places"} to see`;
  // Only once it is in more than one: "1 destination" says nothing while there is one launch area.
  const where = activity.area_count > 1 ? `${activity.area_count} destinations` : null;
  if (photo) {
    return (
      <HeroTripLink
        href={`/search?q=${encodeURIComponent(activity.name)}`}
        data-testid="activity-card"
        // Named by its words: the photo's alt would otherwise lead every card's name. A comma, not
        // the visible dot, which some screen readers read out as "middle dot".
        aria-label={[`${activity.name}: ${toBook}`, where].filter(Boolean).join(", ")}
        className={cn(PHOTO_CARD, "@container flex aspect-[4/5] flex-col justify-end p-2 lg:aspect-[4/3.6] lg:p-3")}
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
            columns, where the glass sits 8px in rather than 12px. A card narrower than 8.5rem (a
            320px phone) drops the icon and takes the name down to text-small, so "Sightseeing" fits on
            a line; a longer name, or a larger text size, wraps (hyphenated where the browser can)
            rather than being cut off. */}
        <GlassPanel tone="card" className="flex flex-col gap-0.5 rounded-control px-2.5 py-2 @max-[8.5rem]:px-2 lg:px-3 lg:py-2.5">
          {/* A heading, as the destination and step titles are, so the grid is reachable by heading. */}
          <h3 className="flex min-w-0 items-center gap-1.5 font-display text-control leading-tight font-extrabold tracking-tight @max-[8.5rem]:text-small lg:text-title-sm">
            <TagGlyph slug={activity.slug} className="size-4 shrink-0 text-sky-pale @max-[8.5rem]:hidden" />
            <span className="line-clamp-2 min-w-0 hyphens-auto break-words">{activity.name}</span>
          </h3>
          {/* How many destinations stays in the label: a second line on some cards would set their
              titles higher than the rest of the row's (RAA-130). */}
          <span className="text-small leading-snug text-sky-mist sm:whitespace-nowrap lg:text-sm">{toBook}</span>
        </GlassPanel>
      </HeroTripLink>
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
          {[toBook, where].filter(Boolean).join(" · ")}
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
  visits,
  tours,
  dates,
  areaName,
  reach,
}: {
  landmark: { slug: string; name: string; description: string; tags: { slug: string; name: string }[] };
  // A stand-in that fits it, or none (landmarkPhotos), when its icon holds the photo's place.
  photo: Photo | null;
  // The rows on the page that go there: the card's foot links to the first.
  visits?: LandmarkVisit[];
  // Those rows as its tour list shows them: the foot then opens the list rather than jumping to
  // the first, and the card says when a tour in the trip goes there.
  tours?: LandmarkTour[];
  // The page's dates and guests, for the tour list's Add to trip.
  dates?: TripDates;
  areaName: string;
  // With no tour going there, how to get there yourself (ReachYourself) in the foot instead.
  reach?: ReactNode;
}) {
  const goes = visits && visits.length > 0 ? visitsLine(visits) : null;
  return (
    <PhotoCardFrame
      photo={photo ?? undefined}
      // No fitting photo: a drawn scene from its tags where the photo would be, as a destination
      // card without one has, rather than a lone pin on navy beside the photo cards.
      placeholder={photo ? <PlaceGlyph className="size-12" /> : <PlaceScene tags={landmark.tags} />}
      badge={photo && !isApiPhoto(photo.src) ? <SamplePhotoTag /> : undefined}
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
              panel={<LandmarkPanel landmark={{ ...landmark, visits }} areaName={areaName} />}
              className="truncate"
            >
              {landmark.name}
            </DetailPanelButton>
          </h3>
          <LandmarkLine tags={landmark.tags.map((tag) => tag.name).join(" · ")} tours={tours ?? []} />
        </>
      }
      foot={
        goes && tours && tours.length > 0 && dates ? (
          <LandmarkToursButton place={landmark.name} label={goes} tours={tours} dates={dates} />
        ) : goes && visits ? (
          // A plain anchor: the row is on this page, and What to book shows it whatever section is
          // picked (it listens for the hash). Above the title's stretched button.
          <a
            href={`#listing-${visits[0].id}`}
            className="relative z-10 -my-1 flex min-h-11 items-center gap-1.5 self-start text-sm font-semibold text-sky-pale underline-offset-4 hover:underline"
          >
            {goes} <ArrowGlyph className="size-4" />
          </a>
        ) : (
          (reach ?? (
            // The same height as the link, so its glass sits level with its neighbours'.
            <span className="-my-1 flex min-h-11 items-center text-sm text-sky-mist">No tours go here yet</span>
          ))
        )
      }
    />
  );
}

// "2 tours go here", or "activities" once they aren't all tours.
function visitsLine(visits: LandmarkVisit[]) {
  const tours = visits.every((visit) => visit.category === "Tour");
  if (visits.length === 1) return tours ? "1 tour goes here" : "1 activity goes here";
  return `${visits.length} ${tours ? "tours" : "activities"} go here`;
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
  sizes,
  price,
  unpriced,
  action,
  kind,
  rowOnPhone = false,
  stacked = false,
  instantBook = false,
}: {
  href: string;
  title: string;
  category: string;
  // Its booking type, whose hue tints the icon that holds the photo's place (GROUP_ICON).
  kind?: string;
  note: string;
  summary?: string | null;
  // Its own cover; without one the card is the short row it becomes when a photo fails, led by
  // its icon, never a stand-in photo of something else.
  photo?: Photo;
  sizes?: string;
  price?: ComponentProps<typeof Price>;
  // Said where the price would be while the listing has none to show (pricedByText).
  unpriced?: string;
  action?: ReactNode;
  // A row on a phone: the photo a column on the left and the text beside it, so a short list
  // of them shows whole in a screen or so (the home page's From partners).
  rowOnPhone?: boolean;
  // From sm, the photo over the text rather than behind it, the text on the card's own navy: the
  // partner's photo shows whole, and the card reads apart from the sample-photo cards around it
  // (the home page's From partners, RAA-130 critique).
  stacked?: boolean;
  instantBook?: boolean;
}) {
  return (
    <PhotoCardFrame
      photo={photo}
      // A partner's own photo comes from storage, which can fail or never answer: its icon holds
      // the place, never a stand-in photo of something else. In a well and its group's hue, so a
      // row of them waiting on storage still reads as four different things, not empty slots.
      placeholder={
        <span
          className={cn(
            "flex size-24 items-center justify-center rounded-full border border-glass-edge bg-glass-fill",
            rowOnPhone && "max-sm:size-16",
            kind && kind in GROUP_ICON ? GROUP_ICON[kind as keyof typeof GROUP_ICON] : "text-sky-mist",
          )}
        >
          <CategoryGlyph name={category} className={cn("size-11", rowOnPhone && "max-sm:size-8")} />
        </span>
      }
      // Without its photo (failed, or storage hanging past PhotoCardFrame's timeout) the card
      // drops the photo's room and is a short row: the icon beside the title says what it is.
      photoClassName={cn(
        rowOnPhone && "max-sm:w-28! max-sm:h-full",
        stacked && "sm:h-40! sm:rounded-b-control",
        "group-data-photo-missing:hidden",
      )}
      className={cn(
        rowOnPhone && "max-sm:h-auto max-sm:min-h-36 max-sm:pl-31",
        // The text starts under the photo, and the card takes its row's height, so a row's
        // actions line up whatever its titles.
        stacked && "sm:h-full sm:pt-44 sm:data-photo-missing:pt-3",
        "data-photo-missing:h-full data-photo-missing:min-h-0 data-photo-missing:justify-start data-photo-missing:pl-3",
      )}
      scrimClassName={cn(rowOnPhone && "max-sm:hidden", stacked && "sm:hidden")}
      // No photo to read over, so no glass: a frame inside the navy card would be a card in a card.
      glassClassName={cn(
        rowOnPhone && "max-sm:border-transparent max-sm:bg-transparent max-sm:p-2",
        stacked && "sm:border-transparent sm:bg-transparent sm:px-2 sm:pt-2 sm:pb-1 sm:backdrop-blur-none",
        "group-data-photo-missing:border-transparent group-data-photo-missing:bg-transparent group-data-photo-missing:p-2",
      )}
      sizes={sizes}
      label={title}
      head={
        <div className="flex items-start gap-3">
          {/* Narrow (under 18rem, in an @container such as the home page's row of four) the title
              needs the room, and the line under it names the category already. */}
          <span
            aria-hidden
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-control border border-glass-edge bg-glass-fill text-white @max-2xs:hidden",
              // A phone's row shows the category in its photo column instead.
              rowOnPhone && "max-sm:hidden",
              "group-data-photo-missing:flex",
            )}
          >
            <CategoryGlyph name={category} className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            {/* On the home page it keeps the hero search's dates and guests, as its other cards do. */}
            <HeroTripLink
              href={href}
              data-testid="listing-link"
              className="line-clamp-2 font-display text-title-sm leading-snug font-extrabold tracking-tight break-words text-white underline-offset-4 hover:underline"
            >
              {title}
            </HeroTripLink>
            <span className="block truncate text-sm text-sky-mist">{note}</span>
            {instantBook && <InstantBookBadge small className="mt-1.5" />}
          </span>
        </div>
      }
      details={summary ? <p className="line-clamp-4 text-sm text-white/90">{summary}</p> : undefined}
      foot={
        (price || unpriced || action) && (
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            {price ? <Price onDark {...price} /> : unpriced ? <span className="text-sm text-sky-mist">{unpriced}</span> : <span />}
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
  features,
  price,
  unpriced,
  action,
  panelAction = action,
  instantBook = false,
  dates,
  sameTitle = 1,
  operator,
}: {
  listingId: number;
  href: string;
  title: string;
  category: string;
  by: string;
  summary?: string | null;
  // Empty for a listing with none of its own: its category icon shows instead.
  photos: Photo[];
  features: Feature[];
  price?: ComponentProps<typeof Price>;
  // How it is priced while it has no price (pricedByText).
  unpriced?: string;
  action?: ReactNode;
  // The action in its side panel's foot, where it is the one action (a prominent Add to trip).
  panelAction?: ReactNode;
  instantBook?: boolean;
  dates?: TripDates;
  // How many rows in its section share its title (counting itself; 1 for none), so who offers it
  // (`operator`) follows the title, where the eye compares them, with how many partners do.
  sameTitle?: number;
  operator?: string;
}) {
  return (
    // Top-aligned, so titles start on one line across rows whatever their summaries and chips.
    <Card className="relative grid gap-4 p-3 @sm:grid-cols-[10rem_minmax(0,1fr)] @2xl:grid-cols-[19rem_minmax(0,1fr)_auto] @2xl:items-start @2xl:gap-5">
      <ListingPhotos photos={photos} label={title} category={category} className="z-10 aspect-[16/10] @sm:aspect-square @2xl:aspect-[4/3]" />
      <div className="flex min-w-0 flex-col gap-2 px-1 @sm:px-0">
        <h3 className="text-lg leading-snug font-semibold text-balance">
          <DetailPanelButton
            data-testid="listing-open"
            title={title}
            media={<ListingPhotos photos={photos} label={title} category={category} count="bottom" className="aspect-[4/3]" />}
            panel={
              <ListingPanel
                listingId={listingId}
                href={href}
                category={category}
                by={by}
                summary={summary}
                features={features}
                instantBook={instantBook}
                dates={dates}
                unpriced={price ? undefined : unpriced}
              />
            }
            actions={<PanelActions price={price} unpriced={unpriced} action={panelAction} listingId={listingId} dates={dates} />}
            className="underline-offset-4 hover:underline"
          >
            {title}
          </DetailPanelButton>
        </h3>
        {/* Two rows with one title: who offers it, right under it, is what tells them apart. */}
        {sameTitle > 1 && operator && (
          <p className="-mt-1.5 text-sm text-muted">
            <span className="font-semibold text-foreground">{operator}</span> · one of {sameTitle} partners offering this
          </p>
        )}
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
          <InTripBadge listingId={listingId} />
          <Badge tone="mist" className="min-h-6 px-2.5 text-xs">
            <CategoryGlyph name={category} className="size-3.5" />
            {category}
          </Badge>
          {instantBook && <InstantBookBadge small />}
          <span>{sameTitle > 1 && operator ? withoutOperator(by, operator) : by}</span>
        </p>
        <ListingRowDetails summary={summary} features={features} />
      </div>
      {(price || action) && (
        <div className="relative z-10 flex items-center justify-between gap-3 border-t border-line px-1 pt-3 @sm:col-span-2 @2xl:col-span-1 @2xl:flex-col @2xl:items-end @2xl:justify-start @2xl:border-0 @2xl:px-0 @2xl:pt-1">
          {/* No price yet for rentals and transfers (only stays and tours are priced): it says how
              they are priced instead, so the empty slot doesn't read as a hidden cost. */}
          {price ? <Price {...price} /> : unpriced ? <span className="text-sm text-pretty text-muted @2xl:max-w-36 @2xl:text-right">{unpriced}</span> : <span />}
          {action}
        </div>
      )}
    </Card>
  );
}

// The by-line without "by <operator>", when the operator has its own line under the title.
function withoutOperator(by: string, operator: string) {
  return by.split(" · ").filter((part) => part !== `by ${operator}`).join(" · ");
}
