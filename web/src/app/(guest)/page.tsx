import { Suspense } from "react";
import { getActivities, getDestinations, getExplore, type Activity, type ExploreListing } from "@/api/discovery";
import { ActivityCard, DestinationCard, ListingCard, countLine, groupDestinations, withSubAreas } from "@/components/discovery/cards";
import { ArrowGlyph, PlaceGlyph } from "@/components/discovery/tag-glyphs";
import { slugWords } from "@/components/discovery/categories";
import { LoadFailed } from "@/components/discovery/load-failed";
import { ShowMore } from "@/components/discovery/show-more";
import { HeroAddToTrip } from "@/components/landing/hero-add-to-trip";
import { HeroAside } from "@/components/landing/hero-aside";
import { HeroCategories } from "@/components/landing/hero-categories";
import { HeroSearch } from "@/components/landing/hero-search";
import { HeroTrip, HeroTripLink } from "@/components/landing/hero-trip";
import { ExampleTrip, HowItWorks } from "@/components/landing/how-it-works";
import { LAUNCH_AREA } from "@/components/landing/launch-area";
import { PageBanner } from "@/components/landing/page-banner";
import { PageSheet } from "@/components/landing/page-sheet";
import { activityPhoto, destinationPhoto } from "@/components/landing/sample-photos";
import { PlanCta } from "@/components/landing/plan-cta";
import { BACKDROP_PHOTO } from "@/components/landing/site-backdrop";
import { TripStart } from "@/components/landing/trip-start";
import { TripAddProvider } from "@/components/trips/trip-add-provider";
import { cn } from "@/components/ui/cn";
import { glassClasses } from "@/components/ui/glass";
import { Section } from "@/components/ui/section";
import { DisplayTitle } from "@/components/ui/typography";
import { formatPeso } from "@/lib/money";
import { pricedByText, priceUnitText, TO_BE_AGREED } from "@/lib/pricing";

// The guest home, as the Sky & Forest landing page (RAA-102): a photo hero whose title names
// where we launch, holding the way in (RAA-80) — a trip there, with dates and guests, or a
// search for anywhere else — and the kinds of things to book, with an example trip beside it
// from xl; then real listings from the launch area's partners, one of each kind, as the proof
// before the explanation (a phone would otherwise scroll through How it works first); then how
// a trip comes together, destinations and activities on photo cards, and the closing band. The
// trip comes first: it is what the cart is for.
// A guest who hasn't chosen where to go starts here; picking a destination leads to its area
// page. The hero needs no data, so it renders at once; each browse section streams in behind
// its own skeleton and fails on its own, so a sleeping API never blanks the page.
export default function Home() {
  return (
    // The hero's search tells the pills its dates, guests and destination, the note under it
    // whether its button starts a trip, and the cards below their dates (HeroTrip).
    <HeroTrip>
      {/* The partner listings' Add to trip, with the sign-in sheet it may open. */}
      <TripAddProvider>
        <main className="flex flex-1 flex-col">
          <PageBanner
            hero
            photo={HERO_PHOTO}
            aside={
              <HeroAside>
                <ExampleTrip compact />
              </HeroAside>
            }
            title={
              <>
                <DisplayTitle size="hero" className="text-balance">
                  Your whole {LAUNCH_AREA.name} trip{" "}
                  {/* Free to wrap: with large text the phrase is wider than a phone. */}
                  <span className="font-semibold text-sky-pale italic motion-safe:animate-unveil">
                    in one cart.
                  </span>
                </DisplayTitle>
                <p className="max-w-lede text-base text-pretty sm:max-w-prose text-sky-mist max-sm:short:text-sm sm:text-lg landscape-phone:text-sm">
                  {/* Only what the launch area's partners list (PRODUCT.md). A phone skips the van, so
                    the lede stays three lines and the search and the way in keep the first screen. */}
                  Island hopping, a scooter for the week, a cottage in Santa Fe
                  <span className="max-sm:hidden">, the van from Hagnaya port</span>: all from local partners.
                </p>
              </>
            }
          >
            {/* The banner's entrance animation makes each of its children a stacking context, so
                the suggestions would open under the pills below; z-10 lifts this whole group, and
                the search above the note under it, which the open list covers. */}
            <div className="relative z-10 flex w-full max-w-3xl flex-col gap-3">
              <div className="relative z-10">
                <HeroSearch />
              </div>
              {/* What starting a trip costs, or a partner's or admin's own way in (RAA-80). */}
              <TripStart />
            </div>
            <HeroCategories />
          </PageBanner>

          <PageSheet tone="clear">
            <div className="page-sections photo-flush mx-auto flex w-full max-w-page flex-col gap-section py-page-pad">
              <Section
                id="from-partners"
                surface="glass"
                title={`From partners on ${LAUNCH_AREA.name}`}
                intro={`Real listings, one of each kind a trip needs. “${TO_BE_AGREED}” means you settle the price with the partner when you book.`}
              >
                <Suspense fallback={<PartnerListingsSkeleton />}>
                  <PartnerListings />
                </Suspense>
              </Section>

              <HowItWorks />

              <Section
                id="destinations"
                surface="photo"
                title={`Beyond ${LAUNCH_AREA.name}`}
                intro="Other places where local partners list what you can book."
              >
                <Suspense fallback={<DestinationsSkeleton />}>
                  <Destinations />
                </Suspense>
              </Section>

              <Section
                id="activities"
                surface="glass"
                title="Browse by activity"
                intro="Start from something you love doing, and see where you can do it."
              >
                <div className="flex flex-col gap-3">
                  <Suspense fallback={<ActivitiesSkeleton />}>
                    <Activities />
                  </Suspense>
                  {/* A caption, not the intro: the intro says what the section is for. */}
                  <p className="text-sm text-sky-mist">Activity photos are samples for now.</p>
                </div>
              </Section>

              <PlanCta />
            </div>
          </PageSheet>
        </main>
      </TripAddProvider>
    </HeroTrip>
  );
}

// The guest backdrop's photo (SiteBackdrop), which the hero shows at full colour, at the
// backdrop's sizes so the two share one download. Mirrored, its open water is on the left under
// the text and the boats on the right. Decorative.
const HERO_PHOTO = { ...BACKDROP_PHOTO, alt: "", mirror: true };

async function Destinations() {
  const destinations = await getDestinations().catch((error: unknown) => {
    console.error(error);
    return null;
  });
  if (!destinations) return <LoadFailed what="destinations" />;
  // The page is the launch area's already (its hero, its partners' listings), so this section is
  // the places beyond it (RAA-130 critique): depth in one area first.
  const groups = groupDestinations(destinations).filter(({ area }) => area.slug !== LAUNCH_AREA.slug);
  if (groups.length === 0) {
    return <p className="text-muted">More destinations appear here as partners list them. Try the search above.</p>;
  }
  // A few are a row of links, each with what it has to book: photo cards for one or two would be
  // the page's largest block, on sample photos, for its least important choice.
  if (groups.length <= COMPACT_DESTINATIONS) {
    return (
      <ul className="cascade flex flex-wrap gap-3">
        {groups.map(({ area, subAreas }) => (
          <li key={area.slug} className="max-w-full min-w-0">
            <HeroTripLink
              href={`/${area.slug}`}
              data-testid="destination-link"
              className={cn(
                glassClasses("dark"),
                "group flex min-h-11 max-w-full items-center gap-2 rounded-full py-2 pr-4 pl-3 hover:bg-navy/60",
              )}
            >
              <PlaceGlyph className="size-4.5 shrink-0 text-sky-pale" />
              <span className="font-semibold text-white">{area.name}</span>
              <span className="min-w-0 truncate text-sm text-sky-mist tabular-nums">{countLine(withSubAreas(area, subAreas))}</span>
              <ArrowGlyph className="size-4 shrink-0 text-sky-pale transition-transform duration-500 ease-calm motion-safe:group-hover:translate-x-0.5" />
            </HeroTripLink>
          </li>
        ))}
      </ul>
    );
  }
  // The one with the most to book leads (RAA-108), on the larger card; the rest share its grid,
  // so no destination gets a row to itself. They ease in over the skeleton, in reading order.
  return (
    <div className="flex flex-col gap-3">
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
      <p className="text-sm text-sky-mist">Destination photos are samples for now.</p>
    </div>
  );
}

const COMPACT_DESTINATIONS = 3;

// Where each destination card sits (more than COMPACT_DESTINATIONS of them), so every row is
// full. From `sm` there are two columns: the lead spans both when the rest pair off, otherwise it
// shares its row. The `lg` grid has six: the lead takes four and two rows, with the next two
// stacked beside it; the rest go three to a row, the last row two wider ones when three won't
// divide them. Four in all are rows of two equal halves. A card sharing the lead's row takes the
// lead's height, so the row leaves no hole under it; from `lg`, the two beside the lead keep theirs.
function destinationSpan(index: number, count: number) {
  const sm = index === 0 && count % 2 === 1 && "sm:col-span-2";
  if (index === 1 && count % 2 === 0) return cn("sm:h-auto", count <= 4 ? "lg:col-span-3" : "lg:col-span-2 lg:h-80");
  if (count <= 4 && count % 2 === 0) return cn(sm, "lg:col-span-3");
  if (index === 0) return cn(sm, "lg:col-span-4 lg:row-span-2");
  if (index <= 2) return "lg:col-span-2";
  const tail = count - 3;
  const fromEnd = count - index;
  const wide = (tail % 3 === 2 && fromEnd <= 2) || (tail % 3 === 1 && fromEnd <= 4);
  return wide ? "lg:col-span-3" : "lg:col-span-2";
}

// The page's proof that real partners list real things (RAA-130): one listing per kind of thing
// a trip needs, in the hero's order (getting there first), each the launch area's nearest that
// tells the lede's story (PREFERRED), with a photo of its own and no title twice. Two to a row
// from sm, wide enough for a title and where it is. Four across from xl, so the proof is one row,
// not a wall; each opens its listing page and adds to a trip with the hero's dates. A kind with
// nothing listed is left out. A phone lists them as rows, the photo beside the text, so the whole
// set shows in about a screen rather than one card at a time in a swipe.
// The API gives only a stay's and a tour's price yet, so a rental or a transfer says "Price to be
// agreed" (the area page's words), the section's intro says once what that means, and never a
// number it doesn't have.
async function PartnerListings() {
  const [explore, areas] = await Promise.all([
    getExplore({ area: LAUNCH_AREA.slug }).catch((error: unknown) => {
      console.error(error);
      return undefined;
    }),
    getDestinations().catch(() => []),
  ]);
  if (explore === undefined) return <LoadFailed what="listings" />;
  const listings = pickOnePerKind(explore?.listings ?? []);
  if (listings.length === 0) {
    return <p className="text-muted">Listings appear here as partners on {LAUNCH_AREA.name} add them.</p>;
  }
  const names = new Map(areas.map((area) => [area.slug, area.name]));
  return (
    <ul className="cascade grid gap-3 sm:grid-cols-2 sm:gap-gutter xl:grid-cols-4">
      {listings.map((listing) => {
        const unit = listing.price_from_cents ? priceUnitText(listing.price_unit) : undefined;
        return (
          <li key={listing.id} className="@container">
            <ListingCard
              href={`/listings/${listing.id}`}
              title={listing.title}
              category={listing.category}
              kind={listing.booking_type}
              // Where it is: the icon and the title say what it is. A transfer's area isn't where
              // it runs (its title names the route), so it names the kind of ride instead.
              note={
                listing.booking_type === "transfer"
                  ? listing.category
                  : (names.get(listing.area_slug) ?? slugWords(listing.area_slug))
              }
              photo={listing.cover_photo_url ? { src: listing.cover_photo_url, alt: listing.title } : undefined}
              sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 7rem"
              price={
                listing.price_from_cents
                  ? { prefix: "from", amount: formatPeso(listing.price_from_cents), unit }
                  : undefined
              }
              unpriced={pricedByText(listing.booking_type) && TO_BE_AGREED}
              action={<HeroAddToTrip listing={listing} />}
              instantBook={listing.instant_book}
              rowOnPhone
              stacked
            />
          </li>
        );
      })}
    </ul>
  );
}

const HERO_ORDER = ["transfer", "stay", "rental", "activity"] as const;

// What the hero's lede and the example trip promise for each kind, so the proof tells the same
// story: the van from the port, a cottage, a scooter. The nearest one that matches leads; a kind
// with no match falls back to its nearest listing.
const PREFERRED: Partial<Record<(typeof HERO_ORDER)[number], (listing: ExploreListing) => boolean>> = {
  transfer: (l) => /\bport\b/i.test(l.title),
  stay: (l) => l.category === "Cottage or bungalow",
  rental: (l) => l.category === "Motorcycle",
};

function pickOnePerKind(listings: ExploreListing[]) {
  const seen = new Set<string>();
  return HERO_ORDER.flatMap((kind) => {
    const candidates = listings.filter((l) => l.booking_type === kind && !seen.has(l.title));
    const preferred = PREFERRED[kind];
    const pick =
      (preferred && candidates.find((l) => preferred(l) && l.cover_photo_url)) ??
      candidates.find((l) => l.cover_photo_url) ??
      candidates[0];
    if (!pick) return [];
    seen.add(pick.title);
    return [pick];
  });
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
  // behind "Show N more activities", so the section offers one row of choices rather than a wall
  // of near-identical cards.
  const top = activities.slice(0, ACTIVITIES_SHOWN);
  const more = activities.slice(ACTIVITIES_SHOWN);
  return (
    <div className="flex flex-col gap-gutter">
      <ActivityGrid activities={top} />
      {more.length > 0 && (
        <ShowMore glass more={`Show ${more.length} more activities`} less="Show fewer activities">
          <ActivityGrid activities={more} from={ACTIVITIES_SHOWN} />
        </ShowMore>
      )}
    </div>
  );
}

const ACTIVITIES_SHOWN = 4;

// `from` is the first card's place in the whole list, so the sample photos keep their turn.
// The cards ease in one after another, over the skeleton and again when that opens.
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

// As the few destinations' row of links, the usual case while partners list in few places.
function DestinationsSkeleton() {
  return (
    <div role="status" aria-busy className="flex flex-wrap gap-3">
      <span className="sr-only">Loading destinations…</span>
      <div className={cn(SKELETON, "h-11 w-64 rounded-full")} />
    </div>
  );
}

function PartnerListingsSkeleton() {
  return (
    <div role="status" aria-busy className="grid gap-3 sm:grid-cols-2 sm:gap-gutter xl:grid-cols-4">
      <span className="sr-only">Loading listings…</span>
      {[0, 1, 2, 3].map((index) => (
        <div key={index} className={cn(SKELETON, "h-36 sm:h-80")} />
      ))}
    </div>
  );
}

function ActivitiesSkeleton() {
  return (
    <div role="status" aria-busy className="grid grid-cols-2 gap-gutter lg:grid-cols-4">
      <span className="sr-only">Loading activities…</span>
      {[0, 1, 2, 3].map((index) => (
        <div key={index} className={`${SKELETON} aspect-[4/5] lg:aspect-[4/3.6]`} />
      ))}
    </div>
  );
}
