import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getArea, getDestinations, getExplore, type AreaCard, type AreaDetail } from "@/api/discovery";
import { countLine, groupDestinations, withSubAreas } from "@/components/discovery/cards";
import { ExploreSections } from "@/components/discovery/explore-sections";
import { areaIcon, categoryIcon, tagIcon } from "@/components/discovery/icons";
import { AddToTripButton } from "@/components/trips/add-to-trip-button";
import { TripAddProvider } from "@/components/trips/trip-add-provider";
import { readTripDates } from "@/components/trips/trip-dates";
import { TripDatesBar } from "@/components/trips/trip-dates-bar";
import { Badge } from "@/components/ui/badge";
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

  return (
    <main className="flex flex-1 flex-col">
      <section className="border-b border-line bg-linear-to-br from-mist to-sage px-4 py-12">
        <div className="mx-auto flex max-w-5xl flex-col gap-3">
          <Eyebrow>{area.parent_name ? `${area.parent_name}, Philippines` : "Philippines"}</Eyebrow>
          <DisplayTitle>
            <span aria-hidden>{areaIcon(area.kind)}</span> {area.name}
          </DisplayTitle>
          <p className="text-muted">
            {counts?.across
              ? `${counts.across} (${listings.length} here)`
              : `${landmarks.length} places to see · ${listings.length} things to book`}
          </p>
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-5xl flex-col gap-12 px-4 py-10">
        {areas.length > 0 && (
          <section className="flex flex-col gap-3">
            <SectionTitle>Destinations in {area.name}</SectionTitle>
            <ul className="grid gap-2 sm:grid-cols-2">
              {areas.map((child) => (
                <li key={child.slug}>
                  <CardLink href={`/${child.slug}`} className="flex items-center gap-3 p-4">
                    <span aria-hidden className="text-2xl">
                      {areaIcon(child.kind)}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-semibold">{child.name}</span>
                      {counts?.children.get(child.slug) && (
                        <span className="block text-sm text-muted">{counts.children.get(child.slug)}</span>
                      )}
                    </span>
                  </CardLink>
                </li>
              ))}
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
                    <h3 className="font-semibold">📍 {landmark.name}</h3>
                    <p className="text-sm text-muted">{landmark.description}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {landmark.tags.map((tag) => (
                        <Badge key={tag.slug} tone="mist">
                          {tagIcon(tag.slug)} {tag.name}
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
              {starting && <TripStartedBanner name={area.name} />}
              <SectionTitle>What to book</SectionTitle>
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
                                <span className="block font-semibold">{listing.title}</span>
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

        {explore && <ExploreSections explore={explore} name={area.name} />}

        {areas.length === 0 && landmarks.length === 0 && listings.length === 0 && (
          <p className="text-muted">Nothing here yet. Local partners are still being added.</p>
        )}
      </div>
    </main>
  );
}

// The page's counts as the home page's destination card has them (RAA-80): everything to
// book here and in the places inside this one, and each of those places' own counts. `across`
// is null for an area with no places inside it, whose own counts are the page's.
function areaCounts(destinations: AreaCard[], slug: string) {
  const group = groupDestinations(destinations).find(({ area }) => area.slug === slug);
  const children = new Map(destinations.map((child) => [child.slug, countLine(child)]));
  const across =
    group && group.subAreas.length > 0 ? countLine(withSubAreas(group.area, group.subAreas), group.area.name) : null;
  return { across, children };
}

// Where "Start your trip" lands: the trip begins with the first thing added to it.
function TripStartedBanner({ name }: { name: string }) {
  return (
    <div data-testid="trip-started" className="rounded-2xl border border-line bg-mist p-4">
      <p className="font-display text-2xl font-bold italic leading-tight">Your {name} trip — add your first thing</p>
      <p className="mt-1 text-sm text-pretty text-muted">
        Set your dates, then add a ride, a tour or a stay below. Saving is free, and there&apos;s nothing to pay yet.
      </p>
    </div>
  );
}
