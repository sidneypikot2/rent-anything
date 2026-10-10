import { Suspense } from "react";
import { getActivities, getDestinations, type Activity } from "@/api/discovery";
import { ActivityCard, DestinationCard, groupDestinations } from "@/components/discovery/cards";
import { CATEGORIES, categoryHref } from "@/components/discovery/categories";
import { LoadFailed } from "@/components/discovery/load-failed";
import { SearchBox } from "@/components/discovery/search-box";
import { ShowMore } from "@/components/discovery/show-more";
import { ExampleTripCard, HowItWorks } from "@/components/landing/example-trip";
import { PlanCta } from "@/components/landing/plan-cta";
import { PillLink } from "@/components/ui/pill";
import { DisplayTitle, SectionTitle } from "@/components/ui/typography";

// The guest home: the trip builder first (RAA-75) — where we launch, a search, the kinds of
// things to book and an example trip — then destinations and activities to browse. A guest who
// hasn't chosen where to go starts here; picking a destination leads to its area page.
// The hero needs no data, so it renders at once; each browse section streams in behind its
// own skeleton and fails on its own, so a sleeping API never blanks the page.
export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <section className="border-b border-line bg-linear-to-br from-mist via-surface to-sage pb-14 pt-10 sm:pt-16">
        <div className="mx-auto grid max-w-5xl items-center px-4 gap-10 lg:grid-cols-[1.15fr_1fr]">
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
                <PillLink key={category.label} href={categoryHref(category.query)}>
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
          <Suspense fallback={<DestinationsSkeleton />}>
            <Destinations />
          </Suspense>
        </section>

        <section id="activities" className="flex scroll-mt-6 flex-col gap-4">
          <SectionTitle>Browse by activity</SectionTitle>
          <Suspense fallback={<ActivitiesSkeleton />}>
            <Activities />
          </Suspense>
        </section>

        <HowItWorks />

        <PlanCta />
      </div>
    </main>
  );
}


async function Destinations() {
  const destinations = await getDestinations().catch((error: unknown) => {
    console.error(error);
    return null;
  });
  if (!destinations) return <LoadFailed what="destinations" />;
  const groups = groupDestinations(destinations);
  if (groups.length === 0) {
    return <p className="text-muted">Destinations appear here as partners list them. Try the search above.</p>;
  }
  return (
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
  );
}

async function Activities() {
  const activities = await getActivities().catch((error: unknown) => {
    console.error(error);
    return null;
  });
  if (!activities) return <LoadFailed what="activities" />;
  if (activities.length === 0) {
    return <p className="text-muted">Activities appear here once destinations have things to book.</p>;
  }
  // The API lists the most to book first (RAA-77). The first four show; the rest wait
  // behind "More activities", so the section offers one row of choices rather than a wall
  // of near-identical cards.
  const top = activities.slice(0, ACTIVITIES_SHOWN);
  const more = activities.slice(ACTIVITIES_SHOWN);
  return (
    <div className="flex flex-col gap-3">
      <ActivityGrid activities={top} />
      {more.length > 0 && (
        <ShowMore more={`More activities (${more.length})`} less="Fewer activities">
          <ActivityGrid activities={more} />
        </ShowMore>
      )}
    </div>
  );
}

const ACTIVITIES_SHOWN = 4;

function ActivityGrid({ activities }: { activities: Activity[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {activities.map((activity) => (
        <ActivityCard key={activity.slug} activity={activity} />
      ))}
    </div>
  );
}

const SKELETON = "rounded-2xl bg-surface-2 motion-safe:animate-pulse";

function DestinationsSkeleton() {
  return (
    <div aria-busy className="grid gap-4 sm:grid-cols-2">
      <span className="sr-only">Loading destinations…</span>
      <div className={`${SKELETON} h-80`} />
      <div className={`${SKELETON} h-80`} />
    </div>
  );
}

function ActivitiesSkeleton() {
  return (
    <div aria-busy className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <span className="sr-only">Loading activities…</span>
      {[0, 1, 2, 3].map((index) => (
        <div key={index} className={`${SKELETON} h-36`} />
      ))}
    </div>
  );
}
