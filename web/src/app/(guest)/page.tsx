import Link from "next/link";
import { getActivities, getDestinations } from "@/api/discovery";
import { ActivityCard, DestinationCard, groupDestinations } from "@/components/discovery/cards";
import { tagIcon } from "@/components/discovery/icons";
import { SearchBox } from "@/components/discovery/search-box";
import { ExampleTrip } from "@/components/landing/example-trip";
import { PlanCta } from "@/components/landing/plan-cta";
import { PillLink } from "@/components/ui/pill";
import { DisplayTitle, Eyebrow, SectionTitle } from "@/components/ui/typography";
import { TAGLINE } from "@/lib/brand";


// The guest home: search first, then destinations and activities to browse. A guest who
// hasn't chosen where to go starts here; picking a destination leads to its area page.
export default async function Home() {
  // Each section loads on its own: if one fetch fails, the hero, the search and the other
  // section still show, with a note where the failed one would be.
  const [destinationsResult, activitiesResult] = await Promise.allSettled([getDestinations(), getActivities()]);
  const destinations = destinationsResult.status === "fulfilled" ? destinationsResult.value : null;
  const activities = activitiesResult.status === "fulfilled" ? activitiesResult.value : null;
  const groups = destinations && groupDestinations(destinations);

  return (
    <main className="flex flex-1 flex-col">
      <section className="border-b border-line bg-linear-to-br from-mist via-surface to-sage px-4 pb-16 pt-14 text-center sm:pt-20">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-5">
          <span className="rounded-full border-[1.5px] border-line bg-surface px-4 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
            ✦ {TAGLINE}
          </span>
          <DisplayTitle size="hero">
            Find your next <span className="not-italic text-primary">escape</span>
          </DisplayTitle>
          <p className="max-w-md text-lg text-muted">
            Beach or summit, city or village: search a place, a landmark or something you love doing.
            We&apos;ll show you where to go and plan the rest in one cart.
          </p>
          <SearchBox />
          {activities && activities.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2">
              {activities.slice(0, 3).map((activity) => (
                <PillLink key={activity.slug} href={`/search?q=${encodeURIComponent(activity.name)}`}>
                  <span aria-hidden>{tagIcon(activity.slug)}</span> {activity.name}
                </PillLink>
              ))}
            </div>
          )}
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-5xl flex-col gap-14 px-4 py-12">
        <section id="destinations" className="flex scroll-mt-6 flex-col gap-4">
          <div>
            <Eyebrow>Where to go</Eyebrow>
            <SectionTitle>Destinations</SectionTitle>
          </div>
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
          <div>
            <Eyebrow>What do you want to do?</Eyebrow>
            <SectionTitle>Browse by activity</SectionTitle>
          </div>
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

        <ExampleTrip />

        <PlanCta />
      </div>
    </main>
  );
}

// Where a section would be when its fetch failed. Following a link to this page renders it
// on the server again, which retries both fetches.
function LoadFailed({ what }: { what: string }) {
  return (
    <p className="text-muted">
      Couldn&apos;t load {what} right now.{" "}
      <Link href="/" prefetch={false} className="font-semibold text-link underline underline-offset-2">
        Try again
      </Link>
    </p>
  );
}
