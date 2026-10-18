import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getListing, getQuote } from "@/api/discovery";
import { categoryIcon } from "@/components/discovery/icons";
import { InstantBookBadge } from "@/components/discovery/instant-book-badge";
import { StayPrice, stayPriceLine } from "@/components/discovery/stay-price";
import { TourFacts, tourPriceLine } from "@/components/discovery/tour-facts";
import { CurrentPlace } from "@/components/landing/current-place";
import { PageBanner } from "@/components/landing/page-banner";
import { PageSheet } from "@/components/landing/page-sheet";
import { ListingGallery } from "@/components/discovery/listing-gallery";
import { AddToTripButton } from "@/components/trips/add-to-trip-button";
import { TripAddProvider } from "@/components/trips/trip-add-provider";
import { readTripDates, tripDatesQuery } from "@/components/trips/trip-dates";
import { TripDatesBar } from "@/components/trips/trip-dates-bar";
import { Card, CardBody } from "@/components/ui/card";
import { DisplayTitle, SectionTitle } from "@/components/ui/typography";

// Only a positive integer can be a listing id; anything else is a 404 without asking the API.
function listingId(param: string): number | null {
  return /^[1-9]\d{0,14}$/.test(param) ? Number(param) : null;
}

export async function generateMetadata(props: PageProps<"/listings/[id]">): Promise<Metadata> {
  const id = listingId((await props.params).id);
  const listing = id ? await getListing(id) : null;
  if (!listing) return { title: "Not found" };
  return { title: listing.title, description: listing.summary || undefined };
}

// One listing, for a traveller deciding whether to add it to a trip (RAA-90). Active listings
// only; it never shows the location. A priced stay shows its nightly price and, with the trip's
// dates, what the stay costs from /quotes (RAA-105); a tour shows its facts and price (RAA-111);
// other categories have no price yet.
export default async function ListingPage(props: PageProps<"/listings/[id]">) {
  const id = listingId((await props.params).id);
  if (!id) notFound();
  const dates = readTripDates(await props.searchParams);
  const listing = await getListing(id);
  if (!listing) notFound();
  const { area, category } = listing;
  const rate = listing.stay_rate;
  const tour = listing.tour;
  const cover = listing.photos.at(0);
  const nightsSet = Boolean(dates.from && dates.to && dates.from < dates.to);
  const quote =
    rate && nightsSet && dates.from && dates.to
      ? await getQuote({ listing_id: listing.id, starts_on: dates.from, ends_on: dates.to, guests: dates.guests })
      : undefined;

  return (
    <main className="flex flex-1 flex-col">
      <CurrentPlace name={area.name} />
      <PageBanner
        // Its own cover (RAA-109); without one the banner stays on the backdrop (RAA-107).
        photo={cover && { src: cover.large_url, alt: listing.title }}
        eyebrow={
          <span className="flex items-center gap-2">
            <span aria-hidden className="text-sky-pale">
              {categoryIcon(category.name)}
            </span>
            {category.name} · {area.name}
          </span>
        }
        title={
          <>
            <DisplayTitle className="break-words">{listing.title}</DisplayTitle>
            <p className="text-sky-mist">
              by {listing.business.name} · {listing.units_label}
            </p>
            {listing.instant_book && <InstantBookBadge className="w-fit" />}
            {rate && (
              <p data-testid="listing-price" className="font-semibold text-white">
                {stayPriceLine(rate, listing.guests)}
              </p>
            )}
            {tour && (
              <p data-testid="listing-price" className="font-semibold text-white">
                {tourPriceLine(tour)}
              </p>
            )}
          </>
        }
      >
        <Link
          href={`/${area.slug}${tripDatesQuery(dates)}#listing-${listing.id}`}
          className="self-start rounded-full border border-glass-edge bg-glass-fill px-4 py-2 text-sm font-semibold text-white hover:bg-glass-hover"
        >
          <span aria-hidden>←</span> {area.name}
        </Link>
      </PageBanner>

      <PageSheet>
        <div className="mx-auto flex w-full max-w-narrow flex-col gap-block px-gutter py-page-pad">
        <TripAddProvider>
          {/* Unclipped: the dates calendar opens below the card's edge. */}
          <Card clip={false}>
            <CardBody pad="lg" className="flex flex-col gap-4">
              <TripDatesBar key={`${dates.from}-${dates.to}-${dates.guests}`} dates={dates} />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted">Saving to a trip is free, and there&apos;s nothing to pay yet.</p>
                <AddToTripButton listing={listing} dates={dates} />
              </div>
            </CardBody>
          </Card>
        </TripAddProvider>

        {tour && <TourFacts listing={listing} tour={tour} />}

        {rate && <StayPrice listing={listing} rate={rate} quote={quote} datesSet={Boolean(dates.from && dates.to)} />}

        {listing.photos.length > 1 && <ListingGallery title={listing.title} photos={listing.photos} />}

        {listing.description.trim() && (
          <section className="flex flex-col gap-2">
            <SectionTitle>About this</SectionTitle>
            <p className="max-w-prose break-words whitespace-pre-line">{listing.description}</p>
          </section>
        )}
        </div>
      </PageSheet>
    </main>
  );
}
