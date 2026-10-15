import Link from "next/link";
import { Suspense } from "react";
import { getActivities, getDestinations, type Activity } from "@/api/discovery";
import { ActivityCard, DESTINATION_HEIGHTS, DestinationCard, groupDestinations } from "@/components/discovery/cards";
import { CATEGORIES, categoryHref } from "@/components/discovery/categories";
import { LoadFailed } from "@/components/discovery/load-failed";
import { SearchBox } from "@/components/discovery/search-box";
import { CategoryGlyph, CheckGlyph } from "@/components/discovery/tag-glyphs";
import { ShowMore } from "@/components/discovery/show-more";
import { HowItWorks, TRUST } from "@/components/landing/how-it-works";
import { PageBanner } from "@/components/landing/page-banner";
import { PageSheet } from "@/components/landing/page-sheet";
import { activityPhoto, destinationPhoto } from "@/components/landing/sample-photos";
import { PlanCta } from "@/components/landing/plan-cta";
import { BACKDROP_PHOTO } from "@/components/landing/site-backdrop";
import { TripStart } from "@/components/landing/trip-start";
import { cn } from "@/components/ui/cn";
import { glassClasses } from "@/components/ui/glass";
import { Section } from "@/components/ui/section";
import { DisplayTitle } from "@/components/ui/typography";

// The guest home, as the Sky & Forest landing page (RAA-102): a photo hero holding, on glass,
// where we launch, a search, the way in (RAA-80) and the kinds of things to book; then
// destinations and activities on photo cards, how a trip comes together, and the closing band.
// A guest who hasn't chosen where to go starts here; picking a destination leads to its area
// page. The hero needs no data, so it renders at once; each browse section streams in behind
// its own skeleton and fails on its own, so a sleeping API never blanks the page.
// Since RAA-108 the way in is a line under the search rather than a second panel, and the
// kinds of things to book are one row of pills, grouped with the trust points under it.
export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <PageBanner
        hero
        photo={HERO_PHOTO}
        eyebrow="Now on Bantayan Island"
        title={
          <>
            <DisplayTitle size="hero" className="text-balance">
              Your whole Bantayan Island trip, <span className="font-semibold text-sky-pale italic sm:whitespace-nowrap motion-safe:animate-unveil">
                in one cart.
              </span>
            </DisplayTitle>
            <p className="max-w-lede text-base text-pretty text-sky-mist max-sm:short:text-sm sm:text-lg landscape-phone:text-sm">
              Island hopping, a scooter for the week, a cottage in Santa Fe: pick them from local partners and
              keep every stop together in one trip, from the Cebu City transfer to the last boat out.
            </p>
          </>
        }
      >
        {/* The banner's entrance animation makes each of its children a stacking context, so
            the suggestions would open under the pills below; z-10 lifts this whole group, and
            the search above Start your trip, which the open list covers. */}
        <div className="relative z-10 flex w-full max-w-3xl flex-col gap-4 sm:gap-5">
          <div className="relative z-10">
            <SearchBox hero />
          </div>
          {/* The way in, on a phone's first screen too (RAA-80). */}
          <TripStart />
        </div>
        {/* The kinds of things to book and why book here, as one group under the search. */}
        <div className="flex flex-col gap-3">
          {/* One row: it wraps from sm up and scrolls sideways on a phone (on its side too), so the row stays one
              line on the first screen. The negative margin lets the pills scroll to the frame's edge,
              and the matching scroll padding keeps the first one snapped in line with the text. A
              scroller clips both ways, so the row has room above and below for the focus ring.
              The pills come in one after another, from the left. */}
          <nav
            aria-label="Things to book"
            className="cascade -mx-5 -my-1 flex snap-x scroll-px-5 gap-2 [--cascade:slide-in] overflow-x-auto px-5 py-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 landscape-phone:mx-0 landscape-phone:flex-nowrap landscape-phone:overflow-x-auto landscape-phone:px-0"
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
            {HERO_TRUST.map((point) => (
              <li key={point} className="flex items-center gap-1.5">
                <CheckGlyph className="size-4 shrink-0 text-sky-pale" />
                {point}
              </li>
            ))}
          </ul>
        </div>
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

// The guest backdrop's photo (SiteBackdrop), which the hero shows at full colour, at the
// backdrop's sizes so the two share one download. Mirrored, its open water is on the left under
// the text and the boats on the right. Decorative.
const HERO_PHOTO = { ...BACKDROP_PHOTO, alt: "", mirror: true };

// The short form of HowItWorks' trust points, from the same list so the two never disagree.
// "Free to save" is TripStart's note, just above, so it isn't repeated here.
const HERO_TRUST = TRUST.flatMap((point) => (point.short ? [point.short] : []));

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
  // The one with the most to book leads (RAA-108), on the larger card; the rest share its grid,
  // so no destination gets a row to itself. They ease in over the skeleton, in reading order.
  return (
    <div className="cascade grid gap-gutter sm:grid-cols-2 lg:grid-cols-6">
      {groups.map(({ area, subAreas }, index) => (
        <DestinationCard
          key={area.slug}
          feature={index === 0}
          area={area}
          subAreas={subAreas}
          photo={destinationPhoto(index, area.kind)}
          className={destinationSpan(index, groups.length)}
        />
      ))}
    </div>
  );
}

// Where each destination card sits, so every row is full. From `sm` there are two columns: the
// lead spans both when the rest pair off, otherwise it shares its row. From `lg` the grid has six:
// the lead takes four and, with three or more, two rows, with the next two stacked beside it;
// the rest go three to a row, the last row two wider ones when three won't divide them. Four
// in all are two rows of two.
function destinationSpan(index: number, count: number) {
  const sm = index === 0 && count % 2 === 1 && "sm:col-span-2";
  if (count === 1) return cn(sm, "lg:col-span-6");
  if (count === 4) return cn(sm, "lg:col-span-3");
  if (index === 0) return cn(sm, "lg:col-span-4", count >= 3 && "lg:row-span-2");
  if (index <= 2) return "lg:col-span-2";
  const tail = count - 3;
  const fromEnd = count - index;
  const wide = (tail % 3 === 2 && fromEnd <= 2) || (tail % 3 === 1 && fromEnd <= 4);
  return wide ? "lg:col-span-3" : "lg:col-span-2";
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
// The cards ease in one after another, over the skeleton and again when "More activities" opens.
function ActivityGrid({ activities, from = 0 }: { activities: Activity[]; from?: number }) {
  return (
    <div className="cascade grid grid-cols-2 gap-gutter lg:grid-cols-4">
      {activities.map((activity, index) => (
        <ActivityCard key={activity.slug} activity={activity} photo={activityPhoto(activity.slug, from + index)} />
      ))}
    </div>
  );
}

// Faint glass, as the partner pages' skeletons: a white block would flash on the dark page.
const SKELETON = "rounded-card bg-glass-fill motion-safe:animate-pulse";

function DestinationsSkeleton() {
  return (
    <div role="status" aria-busy className="grid gap-gutter sm:grid-cols-2 lg:grid-cols-6">
      <span className="sr-only">Loading destinations…</span>
      <div className={cn(SKELETON, DESTINATION_HEIGHTS.feature, "sm:col-span-2 lg:col-span-4 lg:row-span-2")} />
      <div className={cn(SKELETON, DESTINATION_HEIGHTS.other, "hidden sm:block lg:col-span-2")} />
      <div className={cn(SKELETON, DESTINATION_HEIGHTS.other, "hidden sm:block lg:col-span-2")} />
    </div>
  );
}

function ActivitiesSkeleton() {
  return (
    <div role="status" aria-busy className="grid grid-cols-2 gap-gutter lg:grid-cols-4">
      <span className="sr-only">Loading activities…</span>
      {[0, 1, 2, 3].map((index) => (
        <div key={index} className={`${SKELETON} aspect-[4/5]`} />
      ))}
    </div>
  );
}
