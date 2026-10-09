import { getActivities, getDestinations } from "@/api/discovery";
import { ActivityCard, DestinationCard, groupDestinations } from "@/components/discovery/cards";
import { tagIcon } from "@/components/discovery/icons";
import { SearchBox } from "@/components/discovery/search-box";
import { ExampleTrip } from "@/components/landing/example-trip";
import { ButtonLink } from "@/components/ui/button";
import { PillLink } from "@/components/ui/pill";
import { DisplayTitle, Eyebrow, SectionTitle } from "@/components/ui/typography";
import { TAGLINE } from "@/lib/brand";


// The guest home: search first, then destinations and activities to browse. A guest who
// hasn't chosen where to go starts here; picking a destination leads to its area page.
export default async function Home() {
  const [destinations, activities] = await Promise.all([getDestinations(), getActivities()]);
  const groups = groupDestinations(destinations);

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
          {activities.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2">
              {activities.slice(0, 3).map((activity) => (
                <PillLink key={activity.slug} href={`/search?q=${encodeURIComponent(activity.name)}`}>
                  {tagIcon(activity.slug)} {activity.name}
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
          {groups.length === 0 ? (
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
          {activities.length === 0 ? (
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

        <section className="flex flex-col items-start gap-4 rounded-3xl bg-navy p-8 text-white sm:flex-row sm:items-center sm:justify-between">
          <div>
            <SectionTitle>Start planning your trip</SectionTitle>
            <p className="mt-1 text-on-dark">
              Save tours, rides, gear and stays from local partners to trips that span every place you visit. A free account keeps them all in one cart.
            </p>
          </div>
          <ButtonLink href="/register" variant="accent" className="shrink-0 whitespace-nowrap">
            Create an account
          </ButtonLink>
        </section>
      </div>
    </main>
  );
}
