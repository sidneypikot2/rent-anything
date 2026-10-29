import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getListing, getQuote } from "@/api/discovery";
import { categoryIcon } from "@/components/discovery/icons";
import { InstantBookBadge } from "@/components/discovery/instant-book-badge";
import { StayPrice } from "@/components/discovery/stay-price";
import { startingArrangement, stayPriceLine, stayQuoteQuery } from "@/components/discovery/stay-quote";
import { TourFacts, tourPriceLine } from "@/components/discovery/tour-facts";
import { VehicleBookingCard } from "@/components/discovery/vehicle-booking-card";
import { VehiclePrice, vehiclePriceLine } from "@/components/discovery/vehicle-price";
import { BookJumpBar } from "@/components/discovery/book-jump-bar";
import { CurrentPlace } from "@/components/landing/current-place";
import { PageBanner } from "@/components/landing/page-banner";
import { PageSheet } from "@/components/landing/page-sheet";
import { ListingGallery } from "@/components/discovery/listing-gallery";
import { AddToTripButton } from "@/components/trips/add-to-trip-button";
import { TripAddProvider } from "@/components/trips/trip-add-provider";
import { readTripDates, tripDatesQuery } from "@/components/trips/trip-dates";
import { InTripBadge } from "@/components/trips/in-trip-badge";
import { Card, CardBody } from "@/components/ui/card";
import { DisplayTitle, SectionTitle } from "@/components/ui/typography";
import { formatPeso } from "@/lib/money";
import { plural } from "@/lib/pricing";

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
// a vehicle its rates, confirmed with the partner (RAA-150); other categories have no price yet.
const FREE_TO_SAVE = "Saving to a trip is free, and there's nothing to pay yet.";

export default async function ListingPage(props: PageProps<"/listings/[id]">) {
  const id = listingId((await props.params).id);
  if (!id) notFound();
  const dates = readTripDates(await props.searchParams);
  const listing = await getListing(id);
  if (!listing) notFound();
  const { area, category } = listing;
  const rate = listing.stay_rate;
  const tour = listing.tour;
  const vehicleRate = listing.vehicle_rate;
  // A rental vehicle with seats books as many as its people need, from its own card (RAA-191).
  const vehicleSeats = vehicleRate && typeof listing.details.seats === "number" ? listing.details.seats : null;
  const cover = listing.photos.at(0);
  const nightsSet = Boolean(dates.from && dates.to && dates.from < dates.to);
  // The party in the fewest rooms, as the price card starts from (RAA-184).
  const start = startingArrangement(listing, dates);
  const quote =
    rate && nightsSet && dates.from && dates.to
      ? await getQuote(stayQuoteQuery(listing, dates.from, dates.to, start.rooms, start.pets))
      : undefined;
  // The add bar's one line: a stay's total for the page's dates, or what the banner says it costs.
  const total = quote && "quote" in quote ? quote.quote : undefined;
  const priceLine = total
    ? `${formatPeso(total.total_cents)} for ${plural(total.nights_count, "night")}`
    : rate
      ? stayPriceLine(rate, listing.guests)
      : tour
        ? tourPriceLine(tour)
        : vehicleRate && vehiclePriceLine(vehicleRate);

  // A stay's or a vehicle's own card holds its price and Add to trip, so the page prices it once.
  const booker = Boolean(rate || (vehicleRate && vehicleSeats));
  const addAside = (
    <div id="book-add" className="flex flex-col items-start gap-1">
      <p className="text-sm text-muted">{FREE_TO_SAVE}</p>
      <InTripBadge listingId={listing.id} />
    </div>
  );

  return (
    <main className="flex flex-1 flex-col">
      <CurrentPlace name={area.name} slug={area.slug} />
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
            <DisplayTitle className="break-words text-balance">{listing.title}</DisplayTitle>
            <p className="text-sky-mist">
              by {listing.business.name} · {listing.units_label}
            </p>
            {listing.instant_book && <InstantBookBadge className="w-fit" />}
          </>
        }
      >
        <Link
          href={`/${area.slug}${tripDatesQuery(dates)}#listing-${listing.id}`}
          className="tap-target self-start rounded-full border border-glass-edge bg-glass-fill px-4 py-2 text-sm font-semibold text-white hover:bg-glass-hover"
        >
          <span aria-hidden>←</span> {area.name}
        </Link>
      </PageBanner>

      <PageSheet>
        <div className="mx-auto flex w-full max-w-narrow flex-col gap-block px-gutter py-page-pad">
        <TripAddProvider>
          {booker ? (
            <>
              {/* A stay picks its rooms and a vehicle its party in its own card, which holds Add to
                  trip and leads the sheet; on a phone the foot points down to it. */}
              <BookJumpBar target="book" watch="book-add" label={rate ? "Choose rooms" : "Choose vehicles"}>
                {priceLine && (
                  <p data-testid="listing-price" className="text-sm font-semibold text-pretty">
                    {priceLine}
                  </p>
                )}
              </BookJumpBar>
              <div id="book" className="flex flex-col">
                {rate ? (
                  <StayPrice
                    key={tripDatesQuery(dates)}
                    listing={listing}
                    rate={rate}
                    dates={dates}
                    initialQuote={quote}
                    add
                    aside={addAside}
                  />
                ) : (
                  vehicleRate &&
                  vehicleSeats && (
                    <VehicleBookingCard
                      key={tripDatesQuery(dates)}
                      listing={listing}
                      rate={vehicleRate}
                      dates={dates}
                      seats={vehicleSeats}
                      aside={addAside}
                    />
                  )
                )}
              </div>
            </>
          ) : (
            // The page's one action. On a phone it comes last and sticks to the window's foot, so
            // Add to trip is on the first screen and stays in reach while the guest reads; the
            // header's search owns the dates and guests, and the add sheet confirms them.
            <Card
              data-testid="listing-add"
              className="max-sm:sticky max-sm:bottom-[calc(0.5rem+env(safe-area-inset-bottom))] max-sm:z-20 max-sm:order-last max-sm:shadow-float"
            >
              <CardBody className="flex flex-wrap items-center justify-between gap-3 max-sm:flex-nowrap max-sm:px-4 max-sm:py-3">
                <div className="flex min-w-0 flex-col items-start gap-1">
                  {priceLine && (
                    <p data-testid="listing-price" className="font-semibold text-pretty max-sm:text-sm">
                      {priceLine}
                    </p>
                  )}
                  <p className="text-sm text-muted max-sm:hidden">{FREE_TO_SAVE}</p>
                  <InTripBadge listingId={listing.id} />
                </div>
                <AddToTripButton listing={listing} dates={dates} />
              </CardBody>
            </Card>
          )}

          {tour && <TourFacts listing={listing} tour={tour} />}
        </TripAddProvider>

        {vehicleRate && <VehiclePrice listing={listing} rate={vehicleRate} />}

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
