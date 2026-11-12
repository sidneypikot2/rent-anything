import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getAreaPlaces, getDestinations } from "@/api/discovery";
import { planHref } from "@/components/area/area-guide";
import { bookIntro, bookMapData, bookSeed, WhatToBook, WhatToBookSkeleton } from "@/components/area/area-listings";
import { BackLink } from "@/components/discovery/back-link";
import { BookDatesPending, BookDatesSeam } from "@/components/discovery/book-dates";
import { AreaMapProvider } from "@/components/discovery/area-map-context";
import { AreaMapLayout } from "@/components/discovery/area-map-layout";
import { descendants, islandOf } from "@/components/discovery/browse-offers";
import { CurrentPlace } from "@/components/landing/current-place";
import { PageBanner } from "@/components/landing/page-banner";
import { PageSheet } from "@/components/landing/page-sheet";
import { areaPhoto } from "@/components/landing/sample-photos";
import { AreaTripBand } from "@/components/trips/area-trip-band";
import { TripAddProvider } from "@/components/trips/trip-add-provider";
import { AdoptTrip, TripLinkProvider } from "@/components/trips/trip-link";
import { readTripDates, tripDatesQuery, tripParam } from "@/components/trips/trip-dates";
import { cn } from "@/components/ui/cn";
import { DisplayTitle } from "@/components/ui/typography";
import { canonical } from "@/lib/seo";

export async function generateMetadata(props: PageProps<"/[area]/book">): Promise<Metadata> {
  const detail = await getAreaPlaces((await props.params).area);
  if (!detail) return { title: "Not found" };
  const { area } = detail;
  return {
    title: `What to book on ${area.name}`,
    description: `Stays, tours, transfers, vehicle rental and gear on ${area.name} from local partners: compare them on the map, pick your dates and book in one cart.`,
    // Without the dates, the search or the page (RAA-238).
    alternates: canonical(`/${area.slug}/book`),
  };
}

// A place's What to book on a page of its own (2026-11-10): every business there by trip need,
// in ListingBrowser's row of section chips over rows of cards, a page at a time from the API
// (book_cards: the first view's pages fetched here, the rest in the browser), with the map,
// whose pins it fetches for the part in view (useMapPins, 2026-11-11). The place's page
// (`/<area>`) is the guide, with a few cards per kind; its What to book tab, its See all links,
// the home's kinds, the search and a business page's way back come here. `?show=` opens a group,
// `?q=` narrows to words, `?trip=` picks the trip, as on the place's page.
export default async function AreaBookPage(props: PageProps<"/[area]/book">) {
  const slug = (await props.params).area;
  const searchParams = await props.searchParams;
  const dates = readTripDates(searchParams);
  const datesQuery = tripDatesQuery(dates);
  const tripId = tripParam(searchParams.trip);
  const show = typeof searchParams.show === "string" ? searchParams.show : undefined;
  const q = typeof searchParams.q === "string" && searchParams.q.trim() ? searchParams.q.trim() : undefined;
  // The place without its listings (the cards page through book_cards, the map fetches what is in
  // view), so a place with tens of thousands of them loads as fast as one with ten.
  // The cards stream in behind a skeleton (below), so new dates or words show it at once rather
  // than the old cards until the server answers; fetched alongside the place all the same.
  const seed = bookSeed(slug, q, dates);
  seed.catch(() => {}); // Unawaited when the place is missing; awaited below otherwise.
  const [detail, destinations] = await Promise.all([
    getAreaPlaces(slug),
    // Only for the places inside this one and its island.
    getDestinations().catch((error: unknown) => {
      console.error(error);
      return null;
    }),
  ]);
  if (!detail) notFound();
  const { area, areas, partner_count: partners } = detail;
  // This place and every place inside it: what the trip has "here".
  const places = [
    ...new Set([
      slug,
      ...areas.map((child) => child.slug),
      ...(destinations ? descendants(destinations, slug).map((child) => child.slug) : []),
    ]),
  ];
  const island = destinations ? islandOf(destinations, slug) : null;
  // Plan a trip plans the island a town is on, as on the place's page.
  const planPlace = island ? (destinations?.find((each) => each.slug === island) ?? null) : null;
  const banner = detail.photos[0]?.large_url ?? areaPhoto(slug, area.kind).src;
  const map = partners > 0 ? bookMapData({ detail, slug, dates, datesQuery, bannerPhoto: banner }) : null;
  const backHref = `/${slug}${datesQuery}`;
  const backPill =
    "tap-target self-start rounded-full border whitespace-nowrap border-glass-edge bg-glass-fill px-4 py-2 text-sm font-semibold text-white hover:bg-glass-hover";

  return (
    <main className="flex flex-1 flex-col">
      <CurrentPlace name={area.name} slug={area.slug} />
      {tripId && <AdoptTrip id={tripId} />}
      <PageBanner
        compact
        frameClass="max-sm:px-5! max-sm:pb-14 sm:pb-12"
        dim
        search={false}
        eyebrow={area.parent_name ? `${area.parent_name}, Philippines` : "Philippines"}
        title={
          <>
            <BackLink href={backHref} className={cn(backPill, "-order-1 sm:hidden")}>
              <span aria-hidden>←</span> {area.name}
            </BackLink>
            {/* The lead sits close under the title, a step further from the eyebrow above. */}
            <div className="flex min-w-0 flex-col gap-2 sm:gap-3">
              <DisplayTitle className="min-w-0 break-words text-balance">What to book on {area.name}</DisplayTitle>
              <p className="text-on-photo max-w-lede text-lg font-medium text-pretty text-white max-sm:text-base">
                {bookIntro(partners)}
              </p>
            </div>
          </>
        }
      >
        {/* Beside the title from sm; above it on a phone, where beside it squeezed the title. */}
        <BackLink href={backHref} className={cn(backPill, "max-sm:hidden")}>
          <span aria-hidden>←</span> {area.name}
        </BackLink>
      </PageBanner>

      {/* The dates, across the seam between the banner and the listings. */}
      <BookDatesSeam slug={slug} dates={dates} />

      <PageSheet tone="clear">
        <AreaMapProvider>
          {/* Listing and business links carry this place and the trip here (useTripHref). */}
          <TripLinkProvider place={area.slug} places={places}>
            <TripAddProvider places={places}>
              <AreaMapLayout map={map}>
                <div className="page-sections flex min-w-0 flex-col gap-section pb-page-pad" data-testid="area-book">
                  <BookDatesPending fallback={<WhatToBookSkeleton />}>
                    <Suspense key={`${dates.from}|${dates.to}|${q}`} fallback={<WhatToBookSkeleton />}>
                      <SeededWhatToBook
                        detail={detail}
                        seed={seed}
                        slug={slug}
                        dates={dates}
                        datesQuery={datesQuery}
                        show={show}
                        q={q}
                        places={places}
                        island={island}
                      />
                    </Suspense>
                  </BookDatesPending>
                  {/* The page ends on the trip; with nothing in it yet, Plan a trip (booking one thing is this page). */}
                  {partners > 0 && (
                    <AreaTripBand
                      places={places}
                      place={planPlace?.name ?? area.name}
                      planHref={planHref(planPlace?.slug ?? slug, datesQuery)}
                    />
                  )}
                </div>
              </AreaMapLayout>
            </TripAddProvider>
          </TripLinkProvider>
        </AreaMapProvider>
      </PageSheet>
    </main>
  );
}

// What to book once its first pages are in.
async function SeededWhatToBook({
  seed,
  ...props
}: Omit<Parameters<typeof WhatToBook>[0], "seed"> & { seed: ReturnType<typeof bookSeed> }) {
  return <WhatToBook {...props} seed={await seed} />;
}
