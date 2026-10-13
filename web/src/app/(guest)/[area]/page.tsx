import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getArea, getDestinations, getExplore, type AreaCard, type AreaDetail } from "@/api/discovery";
import { countLine, LandmarkCard, ListingCard, PHOTO_CARD, PHOTO_CARD_IMAGE, withSubAreas } from "@/components/discovery/cards";
import { ExploreSections, withoutShown } from "@/components/discovery/explore-sections";
import { areaIcon } from "@/components/discovery/icons";
import { PageBanner } from "@/components/landing/page-banner";
import { areaPhoto, landmarkPhoto, listingPhoto } from "@/components/landing/sample-photos";
import { AddToTripButton } from "@/components/trips/add-to-trip-button";
import { TripAddProvider } from "@/components/trips/trip-add-provider";
import { readTripDates, tripDatesQuery } from "@/components/trips/trip-dates";
import { TripDatesBar } from "@/components/trips/trip-dates-bar";
import { TripStartedBanner } from "@/components/trips/trip-started-banner";
import { ButtonLink } from "@/components/ui/button";
import { GlassPanel } from "@/components/ui/glass";
import { cn } from "@/components/ui/cn";
import { Section } from "@/components/ui/section";
import { DisplayTitle } from "@/components/ui/typography";

type Listing = AreaDetail["listings"][number];

// Listings grouped by what the trip needs (SPEC: the area home groups by trip need).
const TRIP_NEEDS: { title: string; bookingTypes: Listing["booking_type"][] }[] = [
  { title: "Tours & activities", bookingTypes: ["activity"] },
  { title: "Getting there & around", bookingTypes: ["transfer"] },
  { title: "Rentals & gear", bookingTypes: ["rental"] },
  { title: "Stays", bookingTypes: ["stay"] },
];

export async function generateMetadata(props: PageProps<"/[area]">): Promise<Metadata> {
  const detail = await getArea((await props.params).area);
  return { title: detail ? detail.area.name : "Not found" };
}

// A destination: the places to see there, everything to book, and the destinations around
// it and often visited with it (RAA-58). Listings go into the guest's trips (RAA-66), with
// the trip dates and guests from the URL; booking comes later (M3).
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

  return (
    <main className="flex flex-1 flex-col">
      <PageBanner
        photo={areaPhoto(area.slug).src}
        preload
        eyebrow={area.parent_name ? `${area.parent_name}, Philippines` : "Philippines"}
        title={
          <DisplayTitle className="flex items-center gap-3">
            <span aria-hidden className="text-sky-pale">
              {areaIcon(area.kind)}
            </span>
            {area.name}
          </DisplayTitle>
        }
      >
          <p className="max-w-prose text-sky-mist empty:hidden">
            {[
              landmarks.length > 0 && `${landmarks.length} ${landmarks.length === 1 ? "place" : "places"} to see`,
              listings.length > 0 && `${listings.length} to book${counts && counts.more.length > 0 ? " here" : ""}`,
            ]
              .filter(Boolean)
              .join(" · ")}
            {/* What the places inside this one add, linked, so the island's total isn't a promise
                this page can't show (RAA-85). */}
            {counts?.more.map((child, index) => (
              <span key={child.area.slug}>
                {index > 0 || landmarks.length > 0 || listings.length > 0 ? " · " : ""}
                <Link href={`/${child.area.slug}`} className="font-semibold text-sky-pale underline-offset-4 hover:underline">
                  {listings.length > 0 ? `${child.listingCount} more` : `${child.listingCount} to book`} in {child.area.name}
                </Link>
              </span>
            ))}
          </p>
          {listings.length > 0 && (
            <ButtonLink href="#listings" className="self-start">
              See what to book <span aria-hidden>↓</span>
            </ButtonLink>
          )}
      </PageBanner>

      <div className="mx-auto flex w-full max-w-page flex-col gap-section px-gutter py-page-pad">
        {areas.length > 0 && (
          <Section eyebrow="Inside" title={`Destinations in ${area.name}`}>
            <ul className="grid gap-gutter sm:grid-cols-2">
              {areas.map((child) => {
                const childCount = counts?.children.get(child.slug);
                const photo = areaPhoto(child.slug);
                return (
                  <li key={child.slug}>
                    <Link
                      href={`/${child.slug}`}
                      className={cn("group flex min-h-48 items-end p-3", PHOTO_CARD)}
                    >
                      <Image
                        src={photo.src}
                        alt={photo.alt}
                        fill
                        sizes="(min-width: 640px) 50vw, 100vw"
                        className={PHOTO_CARD_IMAGE}
                      />
                      <span aria-hidden className="absolute inset-0 -z-10 bg-linear-to-b from-transparent to-scrim/55" />
                      <GlassPanel className="flex w-full items-center gap-3 rounded-control p-3">
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

        {landmarks.length > 0 && (
          <Section eyebrow="Around the island" title="Places to see">
            <div className="grid gap-gutter sm:grid-cols-2">
              {landmarks.map((landmark, index) => (
                <LandmarkCard key={landmark.slug} landmark={landmark} photo={landmarkPhoto(landmark.tags, index)} />
              ))}
            </div>
          </Section>
        )}

        {listings.length > 0 && (
          <TripAddProvider>
            <Section
              id="listings"
              eyebrow="From local partners"
              title="What to book"
              intro="Saving to a trip is free, and there's nothing to pay yet."
            >
              <TripStartedBanner name={area.name} show={starting} />
              <TripDatesBar key={`${dates.from}-${dates.to}-${dates.guests}`} dates={dates} />
              {TRIP_NEEDS.map((need) => {
                const group = listings.filter((listing) => need.bookingTypes.includes(listing.booking_type));
                if (group.length === 0) return null;
                return (
                  <div key={need.title} className="flex flex-col gap-4">
                    <h3 className="text-lg font-semibold">{need.title}</h3>
                    <ul className="grid gap-gutter sm:grid-cols-2">
                      {group.map((listing, index) => (
                        // A search suggestion links straight to its card (#listing-<id>).
                        <li key={listing.id} id={`listing-${listing.id}`} className="scroll-mt-24">
                          <ListingCard
                            href={`/listings/${listing.id}${datesQuery}`}
                            title={listing.title}
                            category={listing.category}
                            note={`${listing.category} · by ${listing.business.name} · ${listing.units_label}`}
                            summary={listing.summary}
                            photo={listingPhoto(listing.category, index)}
                            action={<AddToTripButton listing={listing} dates={dates} />}
                          />
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </Section>
          </TripAddProvider>
        )}

        {nearby && <ExploreSections explore={nearby} name={area.name} />}

        {areas.length === 0 && landmarks.length === 0 && listings.length === 0 && !hasNearby && (
          <p className="text-muted">Nothing here yet. Local partners are still being added.</p>
        )}
      </div>
    </main>
  );
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
