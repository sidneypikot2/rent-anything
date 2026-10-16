import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getExplore, search, type SearchResults } from "@/api/discovery";
import { ExploreSections } from "@/components/discovery/explore-sections";
import { listingNote } from "@/components/discovery/categories";
import { ListingCard } from "@/components/discovery/cards";
import { areaIcon, placeIcon, tagIcon } from "@/components/discovery/icons";
import { PageBanner } from "@/components/landing/page-banner";
import { PageSheet } from "@/components/landing/page-sheet";
import { listingCover } from "@/components/landing/sample-photos";
import { SearchBox } from "@/components/discovery/search-box";
import { readTripDates, tripDatesQuery } from "@/components/trips/trip-dates";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardLink } from "@/components/ui/card";
import { GlassPanel } from "@/components/ui/glass";
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
  const explore = top ? await getExplore(top.anchor) : null;

  return (
    <main className="flex flex-1 flex-col">
      <PageBanner title={<DisplayTitle>{query ? <>Results for “{query}”</> : "Search"}</DisplayTitle>}>
        <GlassPanel className="relative z-10 w-full max-w-2xl rounded-card p-2 shadow-float">
          <SearchBox key={query} initialQuery={query} initialDates={dates} />
        </GlassPanel>
      </PageBanner>
      <PageSheet tone="clear">
        <div className="page-sections mx-auto flex w-full max-w-page flex-col gap-section py-page-pad">
        {results === null ? (
          <p className="text-muted">Type at least two letters: a destination, a landmark or an activity.</p>
        ) : (
          <>
            <Results results={results} carry={carry} />
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

function Results({ results, carry }: { results: SearchResults; carry: string }) {
  if (Object.values(results).every((group) => group.length === 0)) {
    return (
      <p data-testid="search-empty" className="text-muted">
        Nothing matches yet. Try an island, a city or an activity like snorkelling.
      </p>
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
      {results.listings.length > 0 && (
        <Section title="Things to book">
          <ul className="grid gap-gutter sm:grid-cols-2">
            {results.listings.map((listing, index) => (
              <li key={listing.id}>
                <ListingCard
                  href={`/${listing.area_slug}${carry}#listing-${listing.id}`}
                  title={listing.title}
                  category={listing.category}
                  note={listingNote(listing, results)}
                  photo={listingCover(listing, index)}
                />
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
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
