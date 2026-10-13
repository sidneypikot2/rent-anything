import Link from "next/link";
import { Suspense } from "react";
import { getActivities, getDestinations, type Activity } from "@/api/discovery";
import { ActivityCard, DestinationCard, groupDestinations } from "@/components/discovery/cards";
import { CATEGORIES, categoryHref } from "@/components/discovery/categories";
import { LoadFailed } from "@/components/discovery/load-failed";
import { SearchBox } from "@/components/discovery/search-box";
import { CategoryGlyph, CheckGlyph } from "@/components/discovery/tag-glyphs";
import { ShowMore } from "@/components/discovery/show-more";
import { HowItWorks } from "@/components/landing/how-it-works";
import { PageBanner } from "@/components/landing/page-banner";
import { PageSheet } from "@/components/landing/page-sheet";
import { activityPhoto, destinationPhoto } from "@/components/landing/sample-photos";
import { PlanCta } from "@/components/landing/plan-cta";
import { TripStart } from "@/components/landing/trip-start";
import { cn } from "@/components/ui/cn";
import { GlassPanel, glassClasses } from "@/components/ui/glass";
import { Section } from "@/components/ui/section";
import { DisplayTitle } from "@/components/ui/typography";

// The guest home, as the Sky & Forest landing page (RAA-102): a photo hero holding, on glass,
// where we launch, a search, the way in (RAA-80) and the kinds of things to book; then
// destinations and activities on photo cards, how a trip comes together, and the closing band.
// A guest who hasn't chosen where to go starts here; picking a destination leads to its area
// page. The hero needs no data, so it renders at once; each browse section streams in behind
// its own skeleton and fails on its own, so a sleeping API never blanks the page.
// Since RAA-108 the way in is a line under the search rather than a second panel, and the
// kinds of things to book are one row of pills.
export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <PageBanner
        hero
        eyebrow="Now on Bantayan Island"
        title={
          <>
            <DisplayTitle size="hero" className="text-balance">
              Your whole Bantayan Island trip, <span className="font-semibold text-sky-pale italic">in one cart.</span>
            </DisplayTitle>
            <p className="max-w-prose text-base text-pretty text-sky-mist sm:text-lg">
              Island hopping, a scooter for the week, a cottage in Santa Fe: pick them from local partners and
              keep every stop together in one trip, from the Cebu City transfer to the last boat out.
            </p>
          </>
        }
      >
        <div className="flex w-full max-w-2xl flex-col gap-3">
          {/* Glass makes its own stacking context, so the suggestions would sit under the
              panel below it; z-10 lifts the whole search above its neighbours. */}
          <GlassPanel className="relative z-10 rounded-card p-2 shadow-float">
            <SearchBox />
          </GlassPanel>
          {/* The way in, on a phone's first screen too (RAA-80). */}
          <TripStart />
        </div>
        {/* One row: it wraps from sm up and scrolls sideways on a phone, so the row stays one
            line on the first screen. The negative margin lets the pills scroll to the frame's edge. */}
        <nav
          aria-label="Things to book"
          className="-mx-5 flex snap-x gap-2 overflow-x-auto px-5 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
        >
          {CATEGORIES.map((category) => (
            <Link
              key={category.label}
              href={categoryHref(category.query)}
              className={cn(
                glassClasses("dark"),
                "flex min-h-11 shrink-0 snap-start items-center gap-2 rounded-full px-4 text-sm font-bold whitespace-nowrap hover:bg-glass-hover",
              )}
            >
              <CategoryGlyph name={category.icon} className="size-4.5 shrink-0 text-sky-pale" />
              {category.label}
            </Link>
          ))}
        </nav>
        {/* The short form of HowItWorks' trust points (RAA-80). */}
        <ul aria-label="Why book here" className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-sky-mist">
          {TRUST.map((point) => (
            <li key={point} className="flex items-center gap-1.5">
              <CheckGlyph className="size-4 shrink-0 text-sky-pale" />
              {point}
            </li>
          ))}
        </ul>
      </PageBanner>

      <PageSheet tone="clear">
        <div className="page-sections mx-auto flex w-full max-w-page flex-col gap-section px-gutter py-page-pad">
          <Section
            id="destinations"
            eyebrow="Where to"
            title="Destinations"
            intro="Islands, towns and cities with local partners, the most to book first."
          >
            <Suspense fallback={<DestinationsSkeleton />}>
              <Destinations />
            </Suspense>
          </Section>

          <Section
            id="activities"
            eyebrow="What to do"
            title="Browse by activity"
            intro="Start from something you love doing, and see where you can do it."
          >
            <Suspense fallback={<ActivitiesSkeleton />}>
              <Activities />
            </Suspense>
          </Section>

          <HowItWorks />

          <PlanCta />
        </div>
      </PageSheet>
    </main>
  );
}

const TRUST = ["ID-checked local partners", "Free to save", "Nothing to pay yet"];

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
  // The one with the most to book leads, on a card of its own (RAA-108); the rest follow in rows.
  const [lead, ...rest] = groups;
  return (
    <div className="flex flex-col gap-gutter">
      <DestinationCard feature area={lead.area} subAreas={lead.subAreas} photo={destinationPhoto(0)} />
      {rest.length > 0 && (
        // As many columns as there are cards, up to three, so one or two never leave a gap.
        <div className={cn("grid gap-gutter", rest.length > 1 && "sm:grid-cols-2", rest.length > 2 && "lg:grid-cols-3")}>
          {rest.map(({ area, subAreas }, index) => (
            <DestinationCard key={area.slug} area={area} subAreas={subAreas} photo={destinationPhoto(index + 1)} />
          ))}
        </div>
      )}
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
    <div className="flex flex-col gap-gutter">
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
    <div className="grid grid-cols-2 gap-gutter lg:grid-cols-4">
      {activities.map((activity, index) => (
        <ActivityCard key={activity.slug} activity={activity} photo={activityPhoto(activity.slug, from + index)} />
      ))}
    </div>
  );
}

const SKELETON = "rounded-card bg-surface-2 motion-safe:animate-pulse";

function DestinationsSkeleton() {
  return (
    <div aria-busy className="flex flex-col gap-gutter">
      <span className="sr-only">Loading destinations…</span>
      <div className={`${SKELETON} h-[26rem] sm:h-[28rem]`} />
      <div className="grid gap-gutter sm:grid-cols-2 lg:grid-cols-3">
        <div className={`${SKELETON} h-80`} />
        <div className={`${SKELETON} hidden h-80 sm:block`} />
      </div>
    </div>
  );
}

function ActivitiesSkeleton() {
  return (
    <div aria-busy className="grid grid-cols-2 gap-gutter lg:grid-cols-4">
      <span className="sr-only">Loading activities…</span>
      {[0, 1, 2, 3].map((index) => (
        <div key={index} className={`${SKELETON} aspect-[4/5]`} />
      ))}
    </div>
  );
}
