import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getArea, getDestinations, getExplore, type AreaCard, type AreaDetail } from "@/api/discovery";
import { countLine, withSubAreas } from "@/components/discovery/cards";
import { ExploreSections, withoutShown } from "@/components/discovery/explore-sections";
import { areaIcon, categoryIcon, tagIcon } from "@/components/discovery/icons";
import { AddToTripButton } from "@/components/trips/add-to-trip-button";
import { TripAddProvider } from "@/components/trips/trip-add-provider";
import { readTripDates } from "@/components/trips/trip-dates";
import { TripDatesBar } from "@/components/trips/trip-dates-bar";
import { TripStartedBanner } from "@/components/trips/trip-started-banner";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardLink } from "@/components/ui/card";
import { DisplayTitle, Eyebrow, SectionTitle } from "@/components/ui/typography";

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
      <section className="border-b border-line bg-linear-to-br from-mist to-sage px-4 py-12">
        <div className="mx-auto flex max-w-5xl flex-col gap-3">
          <Eyebrow>{area.parent_name ? `${area.parent_name}, Philippines` : "Philippines"}</Eyebrow>
          <DisplayTitle>
            <span aria-hidden>{areaIcon(area.kind)}</span> {area.name}
          </DisplayTitle>
          <p className="text-muted empty:hidden">
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
                <Link href={`/${child.area.slug}`} className="font-semibold text-link underline-offset-4 hover:underline">
                  {listings.length > 0 ? `${child.listingCount} more` : `${child.listingCount} to book`} in {child.area.name}
                </Link>
              </span>
            ))}
          </p>
          {listings.length > 0 && (
            <ButtonLink href="#listings" className="mt-2 self-start">
              See what to book <span aria-hidden>↓</span>
            </ButtonLink>
          )}
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-5xl flex-col gap-12 px-4 py-10">
        {areas.length > 0 && (
          <section className="flex flex-col gap-3">
            <SectionTitle>Destinations in {area.name}</SectionTitle>
            <ul className="grid gap-2 sm:grid-cols-2">
              {areas.map((child) => {
                const childCount = counts?.children.get(child.slug);
                return (
                  <li key={child.slug}>
                    <CardLink href={`/${child.slug}`} className="flex items-center gap-3 p-4">
                      <span aria-hidden className="text-2xl">
                        {areaIcon(child.kind)}
                      </span>
                      <span className="min-w-0">
                        <span className="block font-semibold">{child.name}</span>
                        {childCount && <span className="block text-sm text-muted">{childCount}</span>}
                      </span>
                    </CardLink>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {landmarks.length > 0 && (
          <section className="flex flex-col gap-3">
            <SectionTitle>Places to see</SectionTitle>
            <div className="grid gap-3 sm:grid-cols-2">
              {landmarks.map((landmark) => (
                <Card key={landmark.slug} id={landmark.slug} data-testid="landmark" className="scroll-mt-6">
                  <CardBody className="flex flex-col gap-2">
                    <h3 className="font-semibold">
                      <span aria-hidden>📍</span> {landmark.name}
                    </h3>
                    {/* Short on a phone, so what there is to book isn't screens away (RAA-85). */}
                    <p className="line-clamp-3 text-sm text-muted sm:line-clamp-none">{landmark.description}</p>
                    <div className="hidden flex-wrap gap-1.5 sm:flex">
                      {landmark.tags.map((tag) => (
                        <Badge key={tag.slug} tone="mist">
                          <span aria-hidden>{tagIcon(tag.slug)}</span> {tag.name}
                        </Badge>
                      ))}
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          </section>
        )}

        {listings.length > 0 && (
          <TripAddProvider>
            <section id="listings" className="flex scroll-mt-6 flex-col gap-6">
              <TripStartedBanner name={area.name} show={starting} />
              <div className="flex flex-col gap-1">
                <SectionTitle>What to book</SectionTitle>
                <p className="text-sm text-muted">Saving to a trip is free, and there&apos;s nothing to pay yet.</p>
              </div>
              <TripDatesBar key={`${dates.from}-${dates.to}-${dates.guests}`} dates={dates} />
              {TRIP_NEEDS.map((need) => {
                const group = listings.filter((listing) => need.bookingTypes.includes(listing.booking_type));
                if (group.length === 0) return null;
                return (
                  <div key={need.title} className="flex flex-col gap-2">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-muted">{need.title}</h3>
                    <ul className="grid gap-2 sm:grid-cols-2">
                      {group.map((listing) => (
                        // A search suggestion links straight to its row (#listing-<id>).
                        <li key={listing.id} id={`listing-${listing.id}`} className="scroll-mt-6">
                          <Card>
                            <CardBody className="flex items-center gap-3">
                              <span aria-hidden className="text-2xl">
                                {categoryIcon(listing.category)}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block font-semibold break-words">{listing.title}</span>
                                <span className="block text-sm text-muted">{listing.category}</span>
                              </span>
                              <AddToTripButton listing={listing} dates={dates} />
                            </CardBody>
                          </Card>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </section>
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
