import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getArea, getDestinations, getExplore, type AreaCard, type AreaDetail } from "@/api/discovery";
import { countLine, LandmarkCard, ListingRow, PHOTO_CARD, PHOTO_CARD_IMAGE, withSubAreas } from "@/components/discovery/cards";
import { ExploreSections, withoutShown } from "@/components/discovery/explore-sections";
import { areaIcon } from "@/components/discovery/icons";
import { ListingBrowser } from "@/components/discovery/listing-browser";
import { listingFeatures } from "@/components/discovery/listing-features";
import { AreaGlyph } from "@/components/discovery/tag-glyphs";
import { CurrentPlace } from "@/components/landing/current-place";
import { PageBanner } from "@/components/landing/page-banner";
import { PageSheet } from "@/components/landing/page-sheet";
import { areaPhoto, landmarkPhoto, listingCover } from "@/components/landing/sample-photos";
import { AddToTripButton } from "@/components/trips/add-to-trip-button";
import { TripAddProvider } from "@/components/trips/trip-add-provider";
import { readTripDates, tripDatesQuery } from "@/components/trips/trip-dates";
import { TripDatesBar } from "@/components/trips/trip-dates-bar";
import { TripStartedBanner } from "@/components/trips/trip-started-banner";
import { GlassPanel, glassClasses } from "@/components/ui/glass";
import { cn } from "@/components/ui/cn";
import { Section } from "@/components/ui/section";
import { DisplayTitle } from "@/components/ui/typography";
import { formatPeso } from "@/lib/money";
import { priceUnitText } from "@/lib/pricing";

type Listing = AreaDetail["listings"][number];

// Listings grouped by what the trip needs (SPEC: the area home groups by trip need), which
// What to book's filter offers (RAA-125). Each group keeps its anchor, and an icon for the rail.
const TRIP_NEEDS: { title: string; id: string; icon: string; bookingTypes: Listing["booking_type"][] }[] = [
  { title: "Tours & activities", id: "need-activity", icon: "Tour", bookingTypes: ["activity"] },
  { title: "Getting there & around", id: "need-transfer", icon: "Van transfer", bookingTypes: ["transfer"] },
  { title: "Rentals & gear", id: "need-rental", icon: "Motorcycle", bookingTypes: ["rental"] },
  { title: "Stays", id: "need-stay", icon: "Hotel or cottage", bookingTypes: ["stay"] },
];

export async function generateMetadata(props: PageProps<"/[area]">): Promise<Metadata> {
  const detail = await getArea((await props.params).area);
  return { title: detail ? detail.area.name : "Not found" };
}

// A destination: the places to see there, everything to book, and the destinations around
// it and often visited with it (RAA-58). Listings go into the guest's trips (RAA-66), with
// the trip dates and guests from the URL; booking comes later (M3). Since RAA-108 the banner
// shows the place's photo with its counts as chips. Since RAA-125 tabs under it lead to its
// sections, places to see come first (spots to recommend before things to sell), and what to
// book sits on a paper sheet: a filter rail beside rows with their photos and what they include.
export default async function AreaPage(props: PageProps<"/[area]">) {
  const slug = (await props.params).area;
  const searchParams = await props.searchParams;
  const dates = readTripDates(searchParams);
  const datesQuery = tripDatesQuery(dates);
  // Arrived from the home page's "Start your trip" (RAA-80).
  const starting = searchParams.start === "trip";
  const [detail, explore, destinations] = await Promise.all([
    getArea(slug),
    getExplore({ area: slug }),
    // Only for the counts, so the page still renders without them.
    getDestinations().catch((error: unknown) => {
      console.error(error);
      return null;
    }),
  ]);
  if (!detail) notFound();
  const { area, areas, landmarks, listings } = detail;
  const counts = destinations ? areaCounts(destinations, slug) : null;
  // Nearby places that aren't on this page or inside this place (its landmarks, the places
  // inside it, however deep, and their landmarks).
  const inside = new Set([
    ...areas.map((child) => child.slug),
    ...(destinations ? descendants(destinations, slug).map((child) => child.slug) : []),
  ]);
  const nearby = explore && withoutShown(explore, { landmarks, areas: inside });
  const hasNearby = Boolean(nearby && (nearby.destinations.length > 0 || nearby.recommendations.length > 0));
  const needs = TRIP_NEEDS.map((need) => ({
    ...need,
    listings: listings.filter((listing) => need.bookingTypes.includes(listing.booking_type)),
  })).filter((need) => need.listings.length > 0);
  const stats = [
    landmarks.length > 0 && { count: landmarks.length, label: landmarks.length === 1 ? "place to see" : "places to see" },
    listings.length > 0 && { count: listings.length, label: `to book${counts && counts.more.length > 0 ? " here" : ""}` },
  ].filter((stat) => stat !== false);

  return (
    <main className="flex flex-1 flex-col">
      <CurrentPlace name={area.name} />
      <PageBanner
        photo={areaPhoto(slug, area.kind)}
        eyebrow={area.parent_name ? `${area.parent_name}, Philippines` : "Philippines"}
        title={
          <DisplayTitle className="flex items-center gap-4">
            <GlassPanel aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-control sm:size-14">
              <AreaGlyph kind={area.kind} className="size-6 text-sky-pale sm:size-7" />
            </GlassPanel>
            {area.name}
          </DisplayTitle>
        }
      >
          {(stats.length > 0 || (counts && counts.more.length > 0)) && (
            <ul aria-label={`In ${area.name}`} className="flex flex-wrap gap-2">
              {stats.map((stat) => (
                <li key={stat.label} className={cn(STAT_CHIP, glassClasses())}>
                  <StatCount count={stat.count} /> {stat.label}
                </li>
              ))}
              {/* What the places inside this one add, linked, so the island's total isn't a
                  promise this page can't show (RAA-85). */}
              {counts?.more.map((child) => (
                <li key={child.area.slug}>
                  <Link href={`/${child.area.slug}`} className={cn(STAT_CHIP, glassClasses(), "hover:bg-glass-hover")}>
                    <StatCount count={child.listingCount} /> {listings.length > 0 ? "more" : "to book"} in {child.area.name}
                    <span aria-hidden className="text-sky-pale">→</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
      </PageBanner>

      <PageSheet tone="clear">
        {/* One block under the search bar, as it is one block under the banner. */}
        <div className="page-sections mx-auto flex w-full max-w-page flex-col gap-section pt-block pb-page-pad">
          {landmarks.length > 0 && (
            <Section id="places" surface="photo" title="Places to see">
              {/* A row to swipe on a phone, two to a row from sm, four from lg. */}
              <div className="-mx-3 grid snap-x snap-mandatory auto-cols-[80%] grid-flow-col gap-3 overflow-x-auto scroll-px-3 px-3 [scrollbar-width:none] sm:mx-0 sm:grid-flow-row sm:grid-cols-2 sm:gap-gutter sm:overflow-visible sm:px-0 lg:grid-cols-4">
                {landmarks.map((landmark, index) => (
                  <LandmarkCard key={landmark.slug} landmark={landmark} photo={landmarkPhoto(landmark.tags, index)} areaName={area.name} />
                ))}
              </div>
            </Section>
          )}

          {listings.length > 0 && (
            <TripAddProvider>
              <Section
                id="listings"
                surface="paper"
                title="What to book"
                intro="Tours, rides, gear and stays from local partners. Saving to a trip is free, and there's nothing to pay yet."
              >
                <TripStartedBanner name={area.name} show={starting} />
                <ListingBrowser
                  dates={<TripDatesBar key={`${dates.from}-${dates.to}-${dates.guests}`} dates={dates} rail />}
                  empty={<p className="text-muted">Nothing here yet.</p>}
                  groups={needs.map((need) => ({
                    id: need.id,
                    title: need.title,
                    icon: need.icon,
                    items: need.listings.map((listing, index) => {
                      const cover = listingCover(listing, index);
                      const photos = listing.photos.length > 0
                        ? listing.photos.map((photo) => ({ src: photo.card_url, alt: listing.title }))
                        : [cover];
                      const features = listingFeatures(listing);
                      const priceUnit = listing.price_from_cents ? priceUnitText(listing.price_unit) : null;
                      return {
                        id: listing.id,
                        priceCents: listing.price_from_cents ?? null,
                        priceUnit,
                        features,
                        content: (
                          <ListingRow
                            listingId={listing.id}
                            href={`/listings/${listing.id}${datesQuery}`}
                            title={listing.title}
                            category={listing.category}
                            by={[`by ${listing.business.name}`, listing.units_label].filter(Boolean).join(" · ")}
                            summary={listing.summary}
                            photos={photos}
                            samplePhoto={listing.photos.length === 0 && !listing.cover_photo_url}
                            features={features}
                            price={
                              listing.price_from_cents
                                ? { prefix: "from", amount: formatPeso(listing.price_from_cents), unit: priceUnit ?? undefined }
                                : undefined
                            }
                            action={<AddToTripButton listing={listing} dates={dates} />}
                          />
                        ),
                      };
                    }),
                  }))}
                />
              </Section>
            </TripAddProvider>
          )}

          {areas.length > 0 && (
            <Section id="inside" surface="photo" title={`Destinations in ${area.name}`}>
              {/* One place inside gets the whole row, as a shorter card, rather than half a row. */}
              <ul className={cn("grid gap-gutter", areas.length > 1 && "sm:grid-cols-2")}>
                {areas.map((child) => {
                  const childCount = counts?.children.get(child.slug);
                  const photo = areaPhoto(child.slug, child.kind);
                  return (
                    <li key={child.slug}>
                      <Link
                        href={`/${child.slug}`}
                        className={cn("group flex items-end p-3", areas.length > 1 ? "min-h-48" : "min-h-40", PHOTO_CARD)}
                      >
                        <Image
                          src={photo.src}
                          alt={photo.alt}
                          fill
                          sizes={areas.length > 1 ? "(min-width: 640px) 50vw, 100vw" : "(min-width: 72rem) 72rem, 100vw"}
                          className={PHOTO_CARD_IMAGE}
                        />
                        <span aria-hidden className="absolute inset-0 -z-10 bg-linear-to-b from-transparent to-scrim/55" />
                        <GlassPanel tone="card" className={cn("flex items-center gap-3 rounded-control p-3", areas.length > 1 ? "w-full" : "w-full sm:w-auto sm:pr-6")}>
                          <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-control border border-glass-edge bg-glass-fill text-lg">
                            {areaIcon(child.kind)}
                          </span>
                          <span className="min-w-0">
                            <span className="block font-semibold">{child.name}</span>
                            {childCount && <span className="block text-sm text-sky-mist">{childCount}</span>}
                          </span>
                        </GlassPanel>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Section>
          )}

          {nearby && <ExploreSections explore={nearby} name={area.name} />}

          {areas.length === 0 && landmarks.length === 0 && listings.length === 0 && !hasNearby && (
            <p className="text-muted">Nothing here yet. Local partners are still being added.</p>
          )}
        </div>
      </PageSheet>
    </main>
  );
}

// A count in the banner's chips: the number in the display face, its words after it.
const STAT_CHIP = "flex min-h-11 items-center gap-1.5 rounded-control px-3.5 text-sm text-sky-mist";

function StatCount({ count }: { count: number }) {
  return <span className="font-display text-xl font-extrabold tabular-nums text-white">{count}</span>;
}

// The counts for the places inside this one (RAA-80): each card's own line, and the ones
// with things to book, which the hero links to as "20 more in Santa Fe" (RAA-85). A place's
// count includes the places inside it, as its home card's does.
function areaCounts(destinations: AreaCard[], slug: string) {
  const inside = destinations.filter((child) => child.parent_slug === slug);
  return {
    children: new Map(inside.map((child) => [child.slug, countLine(child)])),
    more: inside
      .map((child) => ({ area: child, listingCount: withSubAreas(child, descendants(destinations, child.slug)).listing_count }))
      .filter(({ listingCount }) => listingCount > 0),
  };
}

// Every listed place inside this one, however deep.
function descendants(destinations: AreaCard[], slug: string, seen = new Set([slug])): AreaCard[] {
  return destinations
    .filter((child) => child.parent_slug === slug && !seen.has(child.slug))
    .flatMap((child) => {
      seen.add(child.slug);
      return [child, ...descendants(destinations, child.slug, seen)];
    });
}
