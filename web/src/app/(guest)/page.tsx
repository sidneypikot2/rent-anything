import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { getActivities, getDestinations, type Activity } from "@/api/discovery";
import { ActivityCard, DestinationCard, groupDestinations } from "@/components/discovery/cards";
import { CATEGORIES, categoryHref } from "@/components/discovery/categories";
import { LoadFailed } from "@/components/discovery/load-failed";
import { SearchBox } from "@/components/discovery/search-box";
import { ShowMore } from "@/components/discovery/show-more";
import { HowItWorks } from "@/components/landing/how-it-works";
import { activityPhoto, destinationPhoto } from "@/components/landing/sample-photos";
import { PlanCta } from "@/components/landing/plan-cta";
import { TripStart } from "@/components/landing/trip-start";
import { cn } from "@/components/ui/cn";
import { GlassPanel, glassClasses } from "@/components/ui/glass";
import { DisplayTitle, SectionTitle } from "@/components/ui/typography";

// The guest home, as the Sky & Forest landing page (RAA-102): a photo hero holding, on glass,
// where we launch, a search, the way in (RAA-80) and the kinds of things to book; then
// destinations and activities on photo cards, how a trip comes together, and the closing band.
// A guest who hasn't chosen where to go starts here; picking a destination leads to its area
// page. The hero needs no data, so it renders at once; each browse section streams in behind
// its own skeleton and fails on its own, so a sleeping API never blanks the page.
export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      {/* The photo is decorative, so it has no alt text; the scrim keeps white text readable. */}
      <section className="relative isolate flex overflow-hidden p-3 sm:p-6">
        <Image src="/images/hero.jpg" alt="" fill preload sizes="100vw" className="-z-20 object-cover" />
        <div aria-hidden className="absolute inset-0 -z-10 bg-linear-to-b from-scrim/45 via-scrim/30 via-40% to-scrim/80" />
        <GlassPanel tone="frame" className="mx-auto flex w-full max-w-6xl flex-col gap-7 rounded-[2rem] px-4 pb-6 pt-16 sm:px-10 sm:pb-10 sm:pt-28">
          <div className="flex max-w-3xl flex-col gap-4 text-white">
            <span className={cn(glassClasses("dark"), "self-start rounded-full px-3.5 py-1.5 text-sm font-semibold")}>
              Now on Bantayan Island
            </span>
            <DisplayTitle size="hero" className="text-balance">
              Your whole Bantayan Island trip, <span className="font-semibold text-sky-pale italic">in one cart.</span>
            </DisplayTitle>
            <p className="max-w-xl text-base text-pretty text-sky-mist sm:text-lg">
              Island hopping, a scooter for the week, a cottage in Santa Fe: pick them from local partners and
              keep every stop together in one trip, from the Cebu City transfer to the last boat out.
            </p>
          </div>
          <div className="flex w-full max-w-2xl flex-col gap-3">
            {/* Glass makes its own stacking context, so the suggestions would sit under the
                panel below it; z-10 lifts the whole search above its neighbours. */}
            <GlassPanel className="relative z-10 rounded-3xl p-2 shadow-2xl shadow-scrim/50">
              <SearchBox />
            </GlassPanel>
            {/* The way in, on a phone's first screen too (RAA-80). */}
            <GlassPanel tone="light" className="rounded-2xl px-4 py-1.5">
              <TripStart />
            </GlassPanel>
          </div>
          <nav aria-label="Things to book" className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
            {CATEGORIES.map((category) => (
              <Link
                key={category.label}
                href={categoryHref(category.query)}
                className={cn(
                  glassClasses("dark"),
                  "flex min-h-14 items-center rounded-2xl px-4 py-3 font-bold hover:bg-white/20",
                )}
              >
                {category.label}
              </Link>
            ))}
          </nav>
          {/* The short form of HowItWorks' trust points (RAA-80). */}
          <p className="text-sm text-sky-mist">ID-checked local partners · nothing to pay yet</p>
        </GlassPanel>
      </section>

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-14 px-4 py-12">
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
  // A card left alone on the last row takes the whole row.
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {groups.map(({ area, subAreas }, index) => (
        <DestinationCard
          key={area.slug}
          area={area}
          subAreas={subAreas}
          photo={destinationPhoto(index)}
          className={index === groups.length - 1 && groups.length % 2 === 1 ? "sm:col-span-2" : undefined}
        />
      ))}
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
          <ActivityGrid activities={more} from={ACTIVITIES_SHOWN} />
        </ShowMore>
      )}
    </div>
  );
}

const ACTIVITIES_SHOWN = 4;

// `from` is the first card's place in the whole list, so the sample photos keep their turn.
function ActivityGrid({ activities, from = 0 }: { activities: Activity[]; from?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {activities.map((activity, index) => (
        <ActivityCard key={activity.slug} activity={activity} photo={activityPhoto(activity.slug, from + index)} />
      ))}
    </div>
  );
}

const SKELETON = "rounded-2xl bg-surface-2 motion-safe:animate-pulse";

function DestinationsSkeleton() {
  return (
    <div aria-busy className="grid gap-4 sm:grid-cols-2">
      <span className="sr-only">Loading destinations…</span>
      <div className={`${SKELETON} h-[26rem]`} />
      <div className={`${SKELETON} h-[26rem]`} />
    </div>
  );
}

function ActivitiesSkeleton() {
  return (
    <div aria-busy className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <span className="sr-only">Loading activities…</span>
      {[0, 1, 2, 3].map((index) => (
        <div key={index} className={`${SKELETON} aspect-[4/5]`} />
      ))}
    </div>
  );
}
