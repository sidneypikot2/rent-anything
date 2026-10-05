import type { Metadata } from "next";
import { search, type SearchResults } from "@/api/discovery";
import { areaIcon, tagIcon } from "@/components/discovery/icons";
import { SearchBox } from "@/components/discovery/search-box";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardLink } from "@/components/ui/card";
import { PillLink } from "@/components/ui/pill";
import { DisplayTitle, SectionTitle } from "@/components/ui/typography";

export const metadata: Metadata = { title: "Search · Rent-Anything" };

// Full search results, grouped like the autocomplete. An activity lists the destinations
// that have it, most matching places first.
export default async function SearchPage(props: PageProps<"/search">) {
  const { q } = await props.searchParams;
  const query = typeof q === "string" ? q.trim() : "";
  // Characters, not UTF-16 units, to match the API's minimum (an emoji is one).
  const results = [...query].length >= 2 ? await search(query) : null;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-10">
      <div className="flex flex-col gap-4">
        <DisplayTitle>{query ? <>Results for “{query}”</> : "Search"}</DisplayTitle>
        <SearchBox key={query} initialQuery={query} />
      </div>
      {results === null ? (
        <p className="text-muted">Type at least two letters: a destination, a landmark or an activity.</p>
      ) : (
        <Results results={results} />
      )}
    </main>
  );
}

function Results({ results }: { results: SearchResults }) {
  if (Object.values(results).every((group) => group.length === 0)) {
    return (
      <p data-testid="search-empty" className="text-muted">
        Nothing matches yet. Try an island, a city or an activity like snorkelling.
      </p>
    );
  }

  return (
    <div data-testid="search-results" className="flex flex-col gap-8">
      {results.tags.length > 0 && (
        <section className="flex flex-col gap-3">
          <SectionTitle>Activities & interests</SectionTitle>
          {results.tags.map((tag) => (
            <Card key={tag.slug}>
              <CardBody className="flex flex-col gap-3">
                <h3 className="font-semibold">
                  {tagIcon(tag.slug)} {tag.name}
                </h3>
                <ul className="flex flex-wrap gap-2">
                  {tag.areas.map((area) => (
                    <li key={area.slug}>
                      <PillLink href={`/${area.slug}`}>
                        <span className="text-primary">{area.name}</span>
                        <span className="text-xs">
                          {area.landmark_count} {area.landmark_count === 1 ? "spot" : "spots"}
                        </span>
                      </PillLink>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ))}
        </section>
      )}

      <LinkGroup
        title="Destinations"
        items={results.areas.map((area) => ({
          key: area.slug,
          href: `/${area.slug}`,
          icon: areaIcon(area.kind),
          title: area.name,
          note: area.parent_name ?? "",
        }))}
      />
      <LinkGroup
        title="Landmarks"
        items={results.landmarks.map((landmark) => ({
          key: landmark.slug,
          href: `/${landmark.area.slug}#${landmark.slug}`,
          icon: "📍",
          title: landmark.name,
          note: landmark.area.name,
        }))}
      />
      <LinkGroup
        title="Things to book"
        items={results.listings.map((listing) => ({
          key: String(listing.id),
          href: `/${listing.area_slug}#listings`,
          icon: "🎟️",
          title: listing.title,
          note: listing.category,
        }))}
      />
    </div>
  );
}

type Item = { key: string; href: string; icon: string; title: string; note: string };

function LinkGroup({ title, items }: { title: string; items: Item[] }) {
  if (items.length === 0) return null;
  return (
    <section className="flex flex-col gap-3">
      <SectionTitle>{title}</SectionTitle>
      <ul className="grid gap-2 sm:grid-cols-2">
        {items.map((item) => (
          <li key={item.key}>
            <CardLink href={item.href} className="flex items-center gap-3 p-3">
              <span aria-hidden className="text-2xl">
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
    </section>
  );
}
