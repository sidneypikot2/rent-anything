import { getBookCards, getBookCounts, type AreaDetail } from "@/api/discovery";
import { countText } from "@/components/area/area-guide";
import { placeKey, type LandmarkInfo, type PlacePin } from "@/components/discovery/area-map-pins";
import { firstQuery, LIST_PAGE, ROW_SIZE, type BookSeed } from "@/components/discovery/book-query";
import { TRIP_ORDER_GROUPS } from "@/components/discovery/categories";
import { ListingBrowser, RowCardSkeleton, type BookSection } from "@/components/discovery/listing-browser";
import { BOOKING_STATE, GETTING_HERE } from "@/components/landing/launch-area";
import { landmarkPhotos } from "@/components/landing/sample-photos";
import { tripDatesQuery, type TripDates } from "@/components/trips/trip-dates";
import { cn } from "@/components/ui/cn";
import { Section } from "@/components/ui/section";

// What a place's page and its What to book page (`/<area>/book`) build alike from the area
// response: its places to see, What to book's rows and its map.

// The places to see, the ones most tours go to first: they are the ones a trip can reach.
export function placesToSee(detail: AreaDetail) {
  return [...detail.landmarks].sort((a, b) => b.visited_by.length - a.visited_by.length);
}

// What to book's map (2026-11-11): its places to see as pins, each with its card's details and the
// listings that go there (named by the API), and where the map starts. Its listings it fetches
// itself for the part in view (useMapPins), so the page never loads them all.
export function bookMapData({
  detail,
  slug,
  dates,
  datesQuery,
  bannerPhoto,
}: {
  detail: AreaDetail;
  slug: string;
  dates: TripDates;
  datesQuery: string;
  bannerPhoto: string;
}) {
  const landmarks = placesToSee(detail);
  const photos = landmarkPhotos(landmarks, [bannerPhoto]);
  const landmarkInfo = new Map<string, LandmarkInfo>(
    landmarks.map((landmark, index) => [
      landmark.slug,
      {
        description: landmark.description,
        tags: landmark.tags,
        photo: photos[index],
        visits: landmark.visits.map((visit) => ({ ...visit, href: `/listings/${visit.id}${datesQuery}` })),
      },
    ]),
  );
  const pins: PlacePin[] = landmarks.map((landmark) => ({
    key: placeKey(landmark.slug),
    kind: "place",
    slug: landmark.slug,
    title: landmark.name,
    areaSlug: slug,
    lat: landmark.location.lat,
    lng: landmark.location.lng,
    photo: landmarkInfo.get(landmark.slug)?.photo ?? null,
    landmark: landmarkInfo.get(landmark.slug),
  }));
  return {
    slug,
    pins,
    center: detail.center,
    dates,
    datesQuery,
    areaName: detail.area.name,
    landmarks: Object.fromEntries(landmarkInfo),
  };
}

// What to book's lead line under the page's banner title: the partners the cards come from.
export function bookIntro(partners: number) {
  return `Tours, transfers, rentals and stays from ${countText(partners, "local partner")}. Add them to a trip for free: ${BOOKING_STATE.unpaid}.`;
}

// What to book: every card here by trip need, under a row of section chips, in rows of white
// cards (ListingBrowser), on its own page since 2026-11-10 (the place's page has the card rows).
// Room at the top of the listings for the dates bar across the seam above them (BookDatesSeam):
// its lower half lies on the sheet, and on a phone the chips' background reaches up past them.
const SEAM_ROOM = "pt-14 max-sm:pt-15";

export function WhatToBook({
  detail,
  seed,
  slug,
  dates,
  datesQuery,
  show,
  q,
  places,
  island,
}: {
  detail: AreaDetail;
  // The first view's pages, fetched on the server (bookSeed).
  seed: BookSeed;
  slug: string;
  dates: TripDates;
  datesQuery: string;
  show?: string;
  q?: string;
  places: string[];
  island: string | null;
}) {
  const { area } = detail;
  // No heading: the banner's title says it, with bookIntro under it.
  return (
    <Section id="listings" surface="paper" label="What to book" className={SEAM_ROOM}>
      <ListingBrowser
        slug={slug}
        sections={BOOK_SECTIONS}
        seed={seed}
        dates={dates}
        initial={show}
        query={q}
        placeName={area.name}
        clearHref={`/${slug}/book${datesQuery}`}
        gettingHere={GETTING_HERE[slug]}
        tripPlaces={places}
        tripIsland={island}
        empty={<p className="text-muted">Nothing here yet.</p>}
      />
    </Section>
  );
}

// What to book while its cards load for new dates or words: the dates search keeps the old page up
// until the server answers, so the pages wrap the list in a Suspense keyed on them and show this,
// the chips and cards in grey, at once. `list`: a Show all page's grid.
export function WhatToBookSkeleton({ list = false }: { list?: boolean }) {
  const bar = "rounded-full bg-mist motion-safe:animate-pulse";
  return (
    <Section id="listings" surface="paper" label="What to book" className={SEAM_ROOM}>
      <div role="status" aria-busy className="flex flex-col gap-6">
        <span className="sr-only">Loading what to book…</span>
        {!list && (
          <div aria-hidden className="flex gap-2 overflow-hidden">
            {[20, 28, 36, 32, 24, 24].map((width, index) => (
              <div key={index} className={cn(bar, "h-11 shrink-0")} style={{ width: `${width * 0.25}rem` }} />
            ))}
          </div>
        )}
        <div aria-hidden className={cn(bar, "h-8 w-48")} />
        {list ? (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {Array.from({ length: 5 }, (_, index) => (
              <RowCardSkeleton key={index} grid />
            ))}
          </ul>
        ) : (
          // Sized like a real row's cards, which take their width from the row (@container).
          <div className="@container">
            <ul className="flex gap-3 overflow-hidden">
              {Array.from({ length: 3 }, (_, index) => (
                <RowCardSkeleton key={index} />
              ))}
            </ul>
          </div>
        )}
      </div>
    </Section>
  );
}

// A section's Show all page (`/<area>/book/<group>`): the same browser on that one section, a grid
// 10 a page.
export function WhatToBookList({
  detail,
  seed,
  slug,
  dates,
  section,
  q,
  places,
  island,
}: {
  detail: AreaDetail;
  seed: BookSeed;
  slug: string;
  dates: TripDates;
  section: BookSection;
  q?: string;
  places: string[];
  island: string | null;
}) {
  return (
    <Section id="listings" surface="paper" title="Every option" className={SEAM_ROOM}>
      <ListingBrowser
        mode="list"
        slug={slug}
        sections={[section]}
        seed={seed}
        dates={dates}
        initial={section.id}
        query={q}
        placeName={detail.area.name}
        clearHref={`/${slug}/book/${section.group}${tripDatesQuery(dates)}`}
        gettingHere={GETTING_HERE[slug]}
        tripPlaces={places}
        tripIsland={island}
        empty={<p className="text-muted">Nothing here yet.</p>}
      />
    </Section>
  );
}

// What to book's sections, in the order the trip's needs come (TRIP_ORDER_GROUPS).
export const BOOK_SECTIONS: BookSection[] = TRIP_ORDER_GROUPS.map(({ group, id, title, icon }) => ({ group, id, title, icon }));

// The pages What to book opens on, fetched on the server for the first paint: every section's
// first row of cards, or on a section's Show all page (`list`) that section's page.
export async function bookSeed(
  slug: string,
  q: string | undefined,
  dates: TripDates,
  list?: { section: BookSection; page: number },
) {
  const wanted = list
    ? [{ section: list.section, perPage: LIST_PAGE, page: list.page }]
    : BOOK_SECTIONS.map((section) => ({ section, perPage: ROW_SIZE, page: 1 }));
  const search = { q, ...(dates.from && dates.to ? { from: dates.from, to: dates.to } : {}) };
  const [pages, counts] = await Promise.all([
    Promise.all(
      wanted.map(async ({ section, perPage, page }) => {
        const data = await getBookCards(slug, section.group, perPage, q, dates.from, dates.to, page);
        return data && { query: firstQuery(section.group, perPage, q, dates, page), data };
      }),
    ),
    // The section chips' counts, once for the page: without them the browser asks again.
    getBookCounts(slug, q, search.from, search.to).catch((error: unknown) => {
      console.error(error);
      return null;
    }),
  ]);
  return { pages: pages.filter((page) => page !== null), counts, search } satisfies BookSeed;
}
