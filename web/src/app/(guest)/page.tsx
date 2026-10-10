import { getActivities, getDestinations } from "@/api/discovery";
import { ActivityCard, DestinationCard, groupDestinations } from "@/components/discovery/cards";
import { LoadFailed } from "@/components/discovery/load-failed";
import { SearchBox } from "@/components/discovery/search-box";
import { ExampleTripCard, HowItWorks } from "@/components/landing/example-trip";
import { PlanCta } from "@/components/landing/plan-cta";
import { PillLink } from "@/components/ui/pill";
import { DisplayTitle, SectionTitle } from "@/components/ui/typography";

// The kinds of things partners list, each searched by a category name the search matches.
const CATEGORIES = [
  { label: "Tours", query: "Tour" },
  { label: "Scooters", query: "Scooter" },
  { label: "Stays", query: "Hotel" },
  { label: "Snorkel gear", query: "Snorkel gear" },
  { label: "Transfers", query: "Van transfer" },
];

// The guest home: the trip builder first (RAA-75) — where we launch, a search, the kinds of
// things to book and an example trip — then destinations and activities to browse. A guest who
// hasn't chosen where to go starts here; picking a destination leads to its area page.
export default async function Home() {
  // Each section loads on its own: if one fetch fails, the hero, the search and the other
  // section still show, with a note where the failed one would be.
  const [destinationsResult, activitiesResult] = await Promise.allSettled([getDestinations(), getActivities()]);
  // Both failing is the API being down or waking up: the guest error page says so and retries.
  if (destinationsResult.status === "rejected" && activitiesResult.status === "rejected") {
    throw destinationsResult.reason;
  }
  for (const result of [destinationsResult, activitiesResult]) {
    if (result.status === "rejected") console.error(result.reason);
  }
  const destinations = destinationsResult.status === "fulfilled" ? destinationsResult.value : null;
  const activities = activitiesResult.status === "fulfilled" ? activitiesResult.value : null;
  const groups = destinations && groupDestinations(destinations);

  return (
    <main className="flex flex-1 flex-col">
      <section className="border-b border-line bg-linear-to-br from-mist via-surface to-sage px-4 pb-14 pt-10 sm:pt-16">
        <div className="mx-auto grid max-w-5xl items-center gap-10 lg:grid-cols-[1.15fr_1fr]">
          <div className="flex flex-col items-start gap-5">
            <DisplayTitle size="hero" className="text-balance">
              Plan your Bantayan Island trip
            </DisplayTitle>
            <p className="max-w-lg text-lg text-pretty text-muted">
              Island hopping, a scooter for the week, a cottage in Santa Fe: pick them from local partners and
              keep every stop together in one trip, from the Cebu City transfer to the last boat out.
            </p>
            <SearchBox />
            <nav aria-label="Things to book" className="flex flex-wrap gap-2">
              {CATEGORIES.map((category) => (
                <PillLink key={category.label} href={`/search?q=${encodeURIComponent(category.query)}`}>
                  {category.label}
                </PillLink>
              ))}
            </nav>
          </div>
          <ExampleTripCard className="shadow-xl shadow-primary/10" />
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-5xl flex-col gap-14 px-4 py-12">
        <section id="destinations" className="flex scroll-mt-6 flex-col gap-4">
          <SectionTitle>Destinations</SectionTitle>
          {!groups ? (
            <LoadFailed what="destinations" />
          ) : groups.length === 0 ? (
            <p className="text-muted">No destinations yet.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {groups.map(({ area, subAreas }, index) => {
                // A card left alone on the last row takes the whole row, laid out side by side.
                const wide = index === groups.length - 1 && groups.length % 2 === 1;
                return (
                  <DestinationCard
                    key={area.slug}
                    area={area}
                    subAreas={subAreas}
                    wide={wide}
                    className={wide ? "sm:col-span-2" : undefined}
                  />
                );
              })}
            </div>
          )}
        </section>

        <section id="activities" className="flex scroll-mt-6 flex-col gap-4">
          <SectionTitle>Browse by activity</SectionTitle>
          {!activities ? (
            <LoadFailed what="activities" />
          ) : activities.length === 0 ? (
            <p className="text-muted">Activities appear here once destinations have things to book.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {activities.map((activity) => (
                <ActivityCard key={activity.slug} activity={activity} />
              ))}
            </div>
          )}
        </section>

        <HowItWorks />

        <PlanCta />
      </div>
    </main>
  );
}

