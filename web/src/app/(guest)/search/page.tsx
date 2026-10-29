import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { getDestinations, getExplore, search, type AreaCard, type SearchResults } from "@/api/discovery";
import { ExploreSections } from "@/components/discovery/explore-sections";
import { listingNote } from "@/components/discovery/categories";
import { ListingCard } from "@/components/discovery/cards";
import { NoMatches } from "@/components/discovery/no-matches";
import { areaIcon, placeIcon, tagIcon } from "@/components/discovery/icons";
import { PageBanner } from "@/components/landing/page-banner";
import { PageSheet } from "@/components/landing/page-sheet";
import { LAUNCH_AREA } from "@/components/landing/launch-area";
import { readTripDates, tripDatesQuery, withDates } from "@/components/trips/trip-dates";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardLink } from "@/components/ui/card";
import { PillLink } from "@/components/ui/pill";
import { Section } from "@/components/ui/section";
import { DisplayTitle } from "@/components/ui/typography";

export const metadata: Metadata = { title: "Search" };

// Full search results, grouped like the autocomplete. An activity lists the destinations
// that have it, most matching places first.
export default async function SearchPage(props: PageProps<"/search">) {
  const searchParams = await props.searchParams;
  const { q } = searchParams;
  const query = typeof q === "string" ? q.trim() : "";
  // The trip dates and guests picked in the home hero's search, carried on to every destination.
  const dates = readTripDates(searchParams);
  const carry = tripDatesQuery(dates);
  // Characters, not UTF-16 units, to match the API's minimum (an emoji is one).
  const results = [...query].length >= 2 ? await search(query) : null;
  const top = results && topDestination(results);
  // Said in the title, so an empty search never reads as a list of results.
  const empty = results !== null && Object.values(results).every((group) => group.length === 0);
  const [explore, destinations] = await Promise.all([
    top ? getExplore(top.anchor) : null,
    // For the places a search that finds nothing offers; the page works without them.
    getDestinations().catch(() => undefined),
  ]);

  return (
    <main className="flex flex-1 flex-col">
      {/* The header's search is this page's search box (RAA-126). */}
      <PageBanner
        title={
          <DisplayTitle>
            {!query ? "Search" : empty ? <>Nothing found for “{query}”</> : <>Results for “{query}”</>}
          </DisplayTitle>
        }
      />
      <PageSheet tone="clear">
        <div className="page-sections mx-auto flex w-full max-w-page flex-col gap-section py-page-pad">
        {results === null ? (
          <Section surface="glass" title="Where to?" intro="Type at least two letters in the search: a destination, a landmark or an activity.">
            <NoMatches query={query} carry={carry} destinations={destinations} short />
          </Section>
        ) : (
          <>
            <Results results={results} carry={carry} query={query} destinations={destinations} />
            {top && explore && <ExploreSections explore={explore} name={top.name} />}
          </>
        )}
        </div>
      </PageSheet>
    </main>
  );
}

// The destination the search most likely means (RAA-58): the first area, else the first
// landmark. What is around it shows under the results.
function topDestination(results: SearchResults) {
  const area = results.areas[0];
  if (area) return { anchor: { area: area.slug }, name: area.name };
  const landmark = results.landmarks[0];
  if (landmark) return { anchor: { landmark: landmark.slug }, name: landmark.name };
  return null;
}

function Results({
  results,
  carry,
  query,
  destinations,
}: {
  results: SearchResults;
  carry: string;
  query: string;
  destinations?: AreaCard[];
}) {
  if (Object.values(results).every((group) => group.length === 0)) {
    return (
      <Section surface="glass" title="Try one of these instead">
        <NoMatches query={query} carry={carry} destinations={destinations} />
      </Section>
    );
  }

  return (
    <div data-testid="search-results" className="page-sections flex flex-col gap-section">
      {results.tags.length > 0 && (
        <Section title="Activities & interests">
          {results.tags.map((tag) => (
            <Card key={tag.slug}>
              <CardBody className="flex flex-col gap-3">
                <h3 className="font-semibold">
                  {tagIcon(tag.slug)} {tag.name}
                </h3>
                <ul className="flex flex-wrap gap-2">
                  {tag.areas.map((area) => (
                    <li key={area.slug}>
                      <PillLink href={`/${area.slug}${carry}`}>
                        <span className="text-primary">{area.name}</span>
                        <span className="text-xs">
                          {area.landmark_count} to see
                        </span>
                      </PillLink>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ))}
        </Section>
      )}

      <LinkGroup
        title="Destinations"
        items={results.areas.map((area) => ({
          key: area.slug,
          href: `/${area.slug}${carry}`,
          icon: areaIcon(area.kind),
          title: area.name,
          note: area.parent_name ?? "",
        }))}
      />
      <LinkGroup
        title="Landmarks"
        items={results.landmarks.map((landmark) => ({
          key: landmark.slug,
          href: `/${landmark.area.slug}${carry}#${landmark.slug}`,
          icon: placeIcon(),
          title: landmark.name,
          note: landmark.area.name,
        }))}
      />
      {/* Things to book by place, the launch area first: the same scooter from partners in two
          places reads as two places, and each place's group goes on to its own What to book with
          this search (`?q=`), where they can be compared and added. */}
      {byPlace(results.listings, destinations).map((place) => (
        <Section
          key={place.slug}
          title={`Things to book on ${place.name}`}
          action={
            <Link
              href={withDates(`/${place.slug}?q=${encodeURIComponent(query)}#listings`, carry)}
              className="flex min-h-11 items-center gap-1.5 font-semibold text-link underline-offset-4 hover:underline"
            >
              Compare them on {place.name}
              <span aria-hidden>→</span>
            </Link>
          }
        >
          <ul className="grid gap-gutter sm:grid-cols-2">
            {place.listings.map((listing) => (
              <li key={listing.id}>
                {/* Its own cover or none (the short row, led by its icon), never a stand-in. */}
                <ListingCard
                  href={`/${listing.area_slug}${carry}#listing-${listing.id}`}
                  title={listing.title}
                  category={listing.category}
                  kind={listing.group}
                  note={listingNote(listing, results)}
                  photo={listing.cover_photo_url ? { src: listing.cover_photo_url, alt: listing.title } : undefined}
                  rowOnPhone
                  // White under its own photo, as the home page's partner cards: real listings
                  // read apart from the dark page (the critique, 2026-10-29).
                  stacked
                  instantBook={listing.instant_book}
                />
              </li>
            ))}
          </ul>
        </Section>
      ))}
    </div>
  );
}

// The listings by the top-most destination they're in (Santa Fe's under Bantayan Island), the
// launch area first, then the place with the most. Without the destinations, by their own place.
function byPlace(listings: SearchResults["listings"], destinations?: AreaCard[]) {
  const bySlug = new Map((destinations ?? []).map((area) => [area.slug, area]));
  const root = (slug: string) => {
    let top = bySlug.get(slug);
    const seen = new Set([slug]);
    while (top?.parent_slug && bySlug.has(top.parent_slug) && !seen.has(top.parent_slug)) {
      seen.add(top.parent_slug);
      top = bySlug.get(top.parent_slug);
    }
    return top ? { slug: top.slug, name: top.name } : { slug, name: slug };
  };
  const places = new Map<string, { slug: string; name: string; listings: SearchResults["listings"] }>();
  for (const listing of listings) {
    const place = root(listing.area_slug);
    const entry = places.get(place.slug) ?? { ...place, listings: [] };
    entry.listings.push(listing);
    places.set(place.slug, entry);
  }
  return [...places.values()].sort(
    (a, b) => Number(b.slug === LAUNCH_AREA.slug) - Number(a.slug === LAUNCH_AREA.slug) || b.listings.length - a.listings.length,
  );
}

type Item = { key: string; href: string; icon: ReactNode; title: string; note: string };

function LinkGroup({ title, items }: { title: string; items: Item[] }) {
  if (items.length === 0) return null;
  return (
    <Section title={title}>
      <ul className="grid gap-gutter sm:grid-cols-2">
        {items.map((item) => (
          <li key={item.key}>
            <CardLink href={item.href} className="flex items-center gap-3 p-3">
              <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-control bg-mist text-xl text-primary">
                {item.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{item.title}</span>
                {item.note && <span className="block truncate text-sm text-muted">{item.note}</span>}
              </span>
              <Badge tone="mist">View</Badge>
            </CardLink>
          </li>
        ))}
      </ul>
    </Section>
  );
}
