import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDestinations, getListing, getQuote, type AreaCard } from "@/api/discovery";
import { descendants } from "@/components/discovery/browse-offers";
import { categoryIcon } from "@/components/discovery/icons";
import { listingFeatures } from "@/components/discovery/listing-features";
import { FeatureGlyph } from "@/components/discovery/tag-glyphs";
import { InstantBookBadge } from "@/components/discovery/instant-book-badge";
import { BookingTerms } from "@/components/discovery/booking-terms";
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
import { AdoptTrip } from "@/components/trips/trip-link";
import { readTripDates, tripDatesQuery, tripParam } from "@/components/trips/trip-dates";
import { InTripBadge } from "@/components/trips/in-trip-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { DisplayTitle, SectionTitle } from "@/components/ui/typography";
import { formatPeso } from "@/lib/money";
import { plural, pricedByText } from "@/lib/pricing";

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
// a vehicle its rates, confirmed with the partner (RAA-150); a rental or transfer without one
// says how it is priced, as its row does. Under the add card, everything its details say (the
// row's chips, all of them here: seats, bags, route, engine, helmets), so the page never shows
// less than the row that led to it.
const FREE_TO_SAVE = "Saving to a trip is free, and there's nothing to pay yet.";

export default async function ListingPage(props: PageProps<"/listings/[id]">) {
  const id = listingId((await props.params).id);
  if (!id) notFound();
  const searchParams = await props.searchParams;
  const dates = readTripDates(searchParams);
  const [listing, destinations] = await Promise.all([
    getListing(id),
    // Only for the searched place's name and the trip's places, so the page still renders without them.
    getDestinations().catch((error: unknown) => {
      console.error(error);
      return [] as AreaCard[];
    }),
  ]);
  if (!listing) notFound();
  const { area, category } = listing;
  // The place it was opened from (`?place=`, a place's page): the header names it, the way back
  // returns to it, and an add goes to the trip it shows (`?trip=`, else as there), as on the
  // business page; with none, the listing's own place.
  const asked = typeof searchParams.place === "string" ? destinations.find((each) => each.slug === searchParams.place) : undefined;
  const from = asked ? { slug: asked.slug, name: asked.name } : { slug: area.slug, name: area.name };
  const places = [from.slug, ...descendants(destinations, from.slug).map((each) => each.slug)];
  const tripId = tripParam(searchParams.trip);
  const back = new URLSearchParams(tripDatesQuery(dates).replace(/^\?/, ""));
  if (tripId) back.set("trip", String(tripId));
  const backHref = `/${from.slug}${back.size ? `?${back}` : ""}#listing-${listing.id}`;
  const rate = listing.stay_rate;
  const tour = listing.tour;
  const vehicleRate = listing.vehicle_rate;
  // A rental vehicle with seats books as many as its people need, from its own card (RAA-191);
  // gear has the same card, by the count (RAA-255).
  const vehicleSeats = vehicleRate && typeof listing.details.seats === "number" ? listing.details.seats : null;
  const rentalCard = Boolean(vehicleRate && (vehicleSeats || listing.group === "gear"));
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
        : vehicleRate
          ? vehiclePriceLine(vehicleRate)
          : pricedByText(listing.booking_type);
  // The cancellation policy has its own line by the price (BookingTerms), so it makes no chip here.
  // A motorcycle shop's child helmets (RAA-205) are on its rate, not its details.
  const helmetFee = vehicleRate?.child_helmet_fee_cents;
  const features = [
    ...listingFeatures({ details: listing.details, cancellation_policy: "" }),
    ...(helmetFee !== null && helmetFee !== undefined
      ? [{ icon: "helmet", label: helmetFee === 0 ? "Child helmets included" : `Child helmets, ${formatPeso(helmetFee)} a helmet a day` }]
      : []),
  ];

  // A stay's or a vehicle's own card holds its price and Add to trip, so the page prices it once.
  const booker = Boolean(rate || rentalCard);
  const addAside = (
    <div id="book-add" className="flex flex-col items-start gap-1">
      <p className="text-sm text-muted">{FREE_TO_SAVE}</p>
      <InTripBadge listingId={listing.id} />
      <BookingTerms listing={listing} className="mt-2" />
    </div>
  );

  return (
    <main className="flex flex-1 flex-col">
      <CurrentPlace name={from.name} slug={from.slug} />
      {tripId && <AdoptTrip id={tripId} />}
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
              {/* A tour's "1 unit" means nothing to a traveller: its facts say how many it takes. */}
              by {listing.business.name}
              {listing.booking_type !== "activity" && ` · ${listing.units_label}`}
            </p>
            {listing.instant_book && <InstantBookBadge className="w-fit" />}
          </>
        }
      >
        <Link
          href={backHref}
          className="tap-target self-start rounded-full border border-glass-edge bg-glass-fill px-4 py-2 text-sm font-semibold text-white hover:bg-glass-hover"
        >
          <span aria-hidden>←</span> {from.name}
        </Link>
      </PageBanner>

      <PageSheet>
        <div className="mx-auto flex w-full max-w-narrow flex-col gap-block px-gutter py-page-pad">
        {/* Opened from a place's page, an add goes to its trip, as there; from anywhere else (the
            cart, search, the home page) the add sheet still asks which trip. */}
        <TripAddProvider places={asked || tripId ? places : undefined}>
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
                  rentalCard && (
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
                {/* Its terms come with the price, as Klook's do (a stay's or vehicle's card has
                    them in addAside). The phone's sticky card stays one row: its own card below. */}
                <BookingTerms listing={listing} className="basis-full border-t border-line pt-3 max-sm:hidden" />
              </CardBody>
            </Card>
          )}

          {!booker && (
            <Card className="sm:hidden">
              <CardBody>
                <BookingTerms listing={listing} />
              </CardBody>
            </Card>
          )}

          {tour && <TourFacts listing={listing} tour={tour} />}
        </TripAddProvider>

        {vehicleRate && <VehiclePrice listing={listing} rate={vehicleRate} />}

        {features.length > 0 && (
          <section data-testid="listing-features" className="flex flex-col gap-3">
            <SectionTitle>What you get</SectionTitle>
            <ul aria-label="Includes" className="flex flex-wrap gap-2">
              {features.map((feature) => (
                <li key={feature.label}>
                  <Badge tone="fact">
                    <FeatureGlyph name={feature.icon} className="size-4 text-primary" />
                    {feature.label}
                  </Badge>
                </li>
              ))}
            </ul>
          </section>
        )}

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
