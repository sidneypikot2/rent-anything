import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getAreaPlaces, getDestinations } from "@/api/discovery";
import { BOOK_SECTIONS, bookSeed, WhatToBookList, WhatToBookSkeleton } from "@/components/area/area-listings";
import { BackLink } from "@/components/discovery/back-link";
import { BookDatesPending, BookDatesSeam } from "@/components/discovery/book-dates";
import { descendants, islandOf } from "@/components/discovery/browse-offers";
import { CurrentPlace } from "@/components/landing/current-place";
import { PageBanner } from "@/components/landing/page-banner";
import { PageSheet } from "@/components/landing/page-sheet";
import { TripAddProvider } from "@/components/trips/trip-add-provider";
import { TripLinkProvider } from "@/components/trips/trip-link";
import { readTripDates, tripDatesQuery } from "@/components/trips/trip-dates";
import { cn } from "@/components/ui/cn";
import { DisplayTitle } from "@/components/ui/typography";

const sectionOf = (group: string) => BOOK_SECTIONS.find((section) => section.group === group);

export async function generateMetadata(props: PageProps<"/[area]/book/[group]">): Promise<Metadata> {
  const { area: slug, group } = await props.params;
  const [detail, section] = [await getAreaPlaces(slug), sectionOf(group)];
  if (!detail || !section) return { title: "Not found" };
  return {
    title: `${section.title} on ${detail.area.name}`,
    description: `Every ${section.title.toLowerCase()} option on ${detail.area.name} from local partners, booked in one cart.`,
  };
}

// A What to book section's Show all page (2026-11-11), opened in a new tab from its row on
// `/<area>/book`: the section alone, its cards in a grid 10 a page with the pager, its filters and
// the same dates (BookDates: only what is free on them). `?q=` narrows it as on What to book.
export default async function AreaBookGroupPage(props: PageProps<"/[area]/book/[group]">) {
  const { area: slug, group } = await props.params;
  const section = sectionOf(group);
  if (!section) notFound();
  const searchParams = await props.searchParams;
  const dates = readTripDates(searchParams);
  const datesQuery = tripDatesQuery(dates);
  const q = typeof searchParams.q === "string" && searchParams.q.trim() ? searchParams.q.trim() : undefined;
  // The cards stream in behind a skeleton, so new dates show it at once (as on What to book).
  const seed = bookSeed(slug, q, dates, { section, page: 1 });
  seed.catch(() => {}); // Unawaited when the place is missing; awaited below otherwise.
  const [detail, destinations] = await Promise.all([
    getAreaPlaces(slug),
    getDestinations().catch((error: unknown) => {
      console.error(error);
      return null;
    }),
  ]);
  if (!detail) notFound();
  const { area, areas } = detail;
  const places = [
    ...new Set([
      slug,
      ...areas.map((child) => child.slug),
      ...(destinations ? descendants(destinations, slug).map((child) => child.slug) : []),
    ]),
  ];
  const island = destinations ? islandOf(destinations, slug) : null;
  const backHref = `/${slug}/book${datesQuery}`;
  const backPill =
    "tap-target self-start rounded-full border whitespace-nowrap border-glass-edge bg-glass-fill px-4 py-2 text-sm font-semibold text-white hover:bg-glass-hover";

  return (
    <main className="flex flex-1 flex-col">
      <CurrentPlace name={area.name} slug={area.slug} />
      <PageBanner
        compact
        frameClass="max-sm:px-5! max-sm:pb-14 sm:pb-12"
        search={false}
        eyebrow={`What to book on ${area.name}`}
        title={
          <>
            <BackLink href={backHref} className={cn(backPill, "-order-1 sm:hidden")}>
              <span aria-hidden>←</span> What to book
            </BackLink>
            <DisplayTitle className="min-w-0 break-words text-balance">
              {section.title} on {area.name}
            </DisplayTitle>
          </>
        }
      >
        <BackLink href={backHref} className={cn(backPill, "max-sm:hidden")}>
          <span aria-hidden>←</span> What to book
        </BackLink>
      </PageBanner>

      {/* The dates, across the seam between the banner and the listings. */}
      <BookDatesSeam slug={slug} dates={dates} />

      <PageSheet tone="clear">
        <TripLinkProvider place={area.slug} places={places}>
          <TripAddProvider places={places}>
            <div
              className="page-sections flex min-w-0 flex-col gap-section pt-block pb-page-pad"
              data-testid="area-book-group"
            >
              <BookDatesPending fallback={<WhatToBookSkeleton list />}>
                <Suspense key={`${dates.from}|${dates.to}|${q}`} fallback={<WhatToBookSkeleton list />}>
                  <SeededList
                    detail={detail}
                    seed={seed}
                    slug={slug}
                    dates={dates}
                    section={section}
                    q={q}
                    places={places}
                    island={island}
                  />
                </Suspense>
              </BookDatesPending>
            </div>
          </TripAddProvider>
        </TripLinkProvider>
      </PageSheet>
    </main>
  );
}

// The Show all list once its first page is in.
async function SeededList({
  seed,
  ...props
}: Omit<Parameters<typeof WhatToBookList>[0], "seed"> & { seed: ReturnType<typeof bookSeed> }) {
  return <WhatToBookList {...props} seed={await seed} />;
}
