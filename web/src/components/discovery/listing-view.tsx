import { getBusiness, getDestinations, getListing, getQuote, type AreaCard } from "@/api/discovery";
import { descendants, offerOf, rentalShop } from "@/components/discovery/browse-offers";
import { BusinessGoodToKnow, BusinessIncluded, BusinessTrust, shopFacts } from "@/components/discovery/business-shop";
import { BusinessWhere, ShopPhotos } from "@/components/discovery/business-view";
import { TRIP_ORDER_GROUPS } from "@/components/discovery/categories";
import { MoreFromBusiness, type MoreGroup } from "@/components/discovery/more-from-business";
import { listingFeatures } from "@/components/discovery/listing-features";
import { FeatureGlyph } from "@/components/discovery/tag-glyphs";
import { BookingTerms } from "@/components/discovery/booking-terms";
import { StayPrice } from "@/components/discovery/stay-price";
import { startingArrangement, stayPriceLine, stayQuoteQuery } from "@/components/discovery/stay-quote";
import { TourFacts, tourPriceLine } from "@/components/discovery/tour-facts";
import { VehicleBookingCard } from "@/components/discovery/vehicle-booking-card";
import { VehiclePrice, vehiclePriceLine } from "@/components/discovery/vehicle-price";
import { BookJumpBar } from "@/components/discovery/book-jump-bar";
import { AddToTripButton } from "@/components/trips/add-to-trip-button";
import { TripAddProvider } from "@/components/trips/trip-add-provider";
import { TripLinkProvider } from "@/components/trips/trip-link";
import { readTripDates, tripDatesQuery, tripParam } from "@/components/trips/trip-dates";
import { InTripBadge } from "@/components/trips/in-trip-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { Section } from "@/components/ui/section";
import { formatPeso } from "@/lib/money";
import { plural, pricedByText } from "@/lib/pricing";

type SearchParams = Record<string, string | string[] | undefined>;

const FREE_TO_SAVE = "Saving to a trip is free, and there's nothing to pay yet.";

// Only a positive integer can be a listing id; anything else is a 404 without asking the API.
export function listingId(param: string): number | null {
  return /^[1-9]\d{0,14}$/.test(param) ? Number(param) : null;
}

// What a listing's page shows, from its search params (RAA-90, RAA-281): the listing, its
// business's shop (trust facts, hours, Good to know, its other listings; the page still renders
// without it), the place it was opened from (`?place=`: the header names it, the way back returns
// to it, and an add goes to the trip it shows, `?trip=`; with none, the listing's own place), the
// way back (from a plan, `?plan=1`, the plan; from a place page's card row, `?from=place`, that
// place's page) and a stay's quote for the page's dates. Null when there is no such listing.
export async function loadListingView(id: number, searchParams: SearchParams) {
  const dates = readTripDates(searchParams);
  const [listing, destinations] = await Promise.all([
    getListing(id),
    // Only for the searched place's name and the trip's places, so the page still renders without them.
    getDestinations().catch((error: unknown) => {
      console.error(error);
      return [] as AreaCard[];
    }),
  ]);
  if (!listing) return null;
  const shop = await getBusiness(listing.business.id).catch((error: unknown) => {
    console.error(error);
    return null;
  });
  const { area } = listing;
  const asked = typeof searchParams.place === "string" ? destinations.find((each) => each.slug === searchParams.place) : undefined;
  const from = asked ? { slug: asked.slug, name: asked.name } : { slug: area.slug, name: area.name };
  const places = [from.slug, ...descendants(destinations, from.slug).map((each) => each.slug)];
  const tripId = tripParam(searchParams.trip);
  const fromPlan = searchParams.plan === "1" && Boolean(tripId);
  const back = new URLSearchParams(tripDatesQuery(dates).replace(/^\?/, ""));
  if (tripId) back.set("trip", String(tripId));
  const fromPlace = searchParams.from === "place" && Boolean(asked);
  const backHref = fromPlan
    ? `/plan/${from.slug}?trip=${tripId}`
    : `/${from.slug}${fromPlace ? "" : "/book"}${back.size ? `?${back}` : ""}${fromPlace ? "" : `#listing-${listing.id}`}`;
  const backLabel = fromPlan ? "Your plan" : from.name;

  const rate = listing.stay_rate;
  const nightsSet = Boolean(dates.from && dates.to && dates.from < dates.to);
  // The party in the fewest rooms, as the price card starts from (RAA-184).
  const start = startingArrangement(listing, dates);
  const quote =
    rate && nightsSet && dates.from && dates.to
      ? await getQuote(stayQuoteQuery(listing, dates.from, dates.to, start.rooms, start.pets))
      : undefined;
  const business = shop?.business;
  const businessHref = `/businesses/${listing.business.id}?place=${from.slug}${tripId ? `&trip=${tripId}` : ""}${tripDatesQuery(dates).replace(/^\?/, "&")}`;
  return { listing, shop, business, dates, from, places, tripId, asked, backHref, backLabel, businessHref, quote };
}

export type ListingViewData = NonNullable<Awaited<ReturnType<typeof loadListingView>>>;

// A listing under its banner, or in the planner's frame (`inPlan`, under the plan's bar and
// stepper): its photos, then from lg its details on the left beside a booking card that sticks on
// the right (under the stepper in the planner); on a phone the card (a stay's rooms, a vehicle's
// party) follows the trust strip, and a simple listing's price and Add to trip stick to the
// window's foot. Then the rest of its business ("More from"). It never shows the location. A
// priced stay shows its nightly price and, with the trip's dates, what the stay costs from
// /quotes (RAA-105); a tour its facts and price (RAA-111); a vehicle its rates (RAA-150); a rental
// or transfer without one says how it is priced. Its chips are all of them, so the page never
// shows less than the row that led to it.
export function ListingBody({ view, inPlan = false }: { view: ListingViewData; inPlan?: boolean }) {
  const { listing, shop, business, dates, from, places, tripId, asked, businessHref, quote } = view;
  const { category } = listing;
  const rate = listing.stay_rate;
  const tour = listing.tour;
  const vehicleRate = listing.vehicle_rate;
  // A rental vehicle with seats books as many as its people need, from its own card (RAA-191);
  // gear has the same card, by the count (RAA-255).
  const vehicleSeats = vehicleRate && typeof listing.details.seats === "number" ? listing.details.seats : null;
  const rentalCard = Boolean(vehicleRate && (vehicleSeats || listing.group === "gear"));
  // The add card's one line: a stay's total for the page's dates, or what it costs.
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

  // The shop's view of this listing (the shape its trust strip and What's included take), and
  // the rest of what it offers, by group in What to book's order.
  const own = shop?.listings.find((each) => each.id === listing.id);
  const facts = business && own ? shopFacts(business, [own], own.group) : [];
  const town = business ? [business.city, business.province].filter(Boolean).join(", ") : "";
  const more: MoreGroup[] = shop
    ? TRIP_ORDER_GROUPS.flatMap((group) => {
        const listings = shop.listings.filter((each) => each.group === group.group && each.id !== listing.id);
        if (listings.length === 0) return [];
        return [
          {
            id: group.id,
            title: group.title,
            short: group.short,
            offers: listings.map((each) => offerOf(each, { dates, pageSlug: from.slug, groupTitle: group.title })),
            shop: rentalShop(listings),
          },
        ];
      })
    : [];

  // A stay's or a vehicle's own card holds its price and Add to trip, so the page prices it once.
  const booker = Boolean(rate || rentalCard);
  const addAside = (
    <div id="book-add" className="flex flex-col items-start gap-1">
      <p className="text-sm text-muted">{FREE_TO_SAVE}</p>
      <InTripBadge listingId={listing.id} />
      <BookingTerms listing={listing} className="mt-2" />
    </div>
  );
  const price = priceLine && (
    <p data-testid="listing-price" className="font-semibold text-pretty">
      {priceLine}
    </p>
  );
  const photos = listing.photos.map((photo) => ({ ...photo, alt: listing.title }));

  return (
    <TripLinkProvider place={from.slug} places={places}>
      {/* Opened from a place's page or a plan, an add goes to its trip, as there; from anywhere
          else (the cart, search, the home page) the add sheet still asks which trip. */}
      <TripAddProvider places={asked || tripId ? places : undefined}>
        <div
          className={cn(
            "flex w-full flex-col gap-section",
            inPlan ? "pt-2 pb-page-pad" : "mx-auto max-w-page px-gutter py-page-pad max-sm:px-0",
          )}
        >
          {photos.length > 0 && <ShopPhotos photos={photos} label={listing.title} category={category.name} testId="listing-photos" />}

          {/* The booking rail from lg: details on the left, the card sticking on the right
              over both rows; below lg one column, the card after the trust strip. */}
          <div className="grid grid-cols-[minmax(0,1fr)] gap-section lg:grid-cols-[minmax(0,1fr)_22.5rem] lg:gap-x-10">
            {facts.length > 0 && (
              <div className="lg:col-start-1 lg:row-start-1">
                <BusinessTrust facts={facts} />
              </div>
            )}

            <aside
              id="book"
              aria-label="Book"
              data-testid="listing-book"
              className={cn(
                "flex flex-col gap-3 lg:sticky lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start",
                inPlan ? "lg:top-(--plan-chrome)" : "lg:top-(--chrome)",
                booker ? "max-sm:px-3" : "max-lg:hidden",
              )}
            >
              {booker ? (
                rate ? (
                  <StayPrice key={tripDatesQuery(dates)} listing={listing} rate={rate} dates={dates} initialQuote={quote} add aside={addAside} />
                ) : (
                  vehicleRate && (
                    <VehicleBookingCard key={tripDatesQuery(dates)} listing={listing} rate={vehicleRate} dates={dates} seats={vehicleSeats} aside={addAside} />
                  )
                )
              ) : (
                <Card edge="line" data-testid="listing-add" className="shadow-soft">
                  <CardBody className="flex flex-col items-start gap-3">
                    {price}
                    <InTripBadge listingId={listing.id} />
                    <AddToTripButton listing={listing} dates={dates} />
                    <p className="text-sm text-muted">{FREE_TO_SAVE}</p>
                    <BookingTerms listing={listing} className="w-full border-t border-line pt-3" />
                  </CardBody>
                </Card>
              )}
            </aside>

            <div className="flex min-w-0 flex-col gap-section lg:col-start-1 lg:row-start-2">
              {/* Below lg a simple listing's terms have no card to sit in: their own, first. */}
              {!booker && (
                <Card edge="line" className="lg:hidden max-sm:mx-3">
                  <CardBody>
                    <BookingTerms listing={listing} />
                  </CardBody>
                </Card>
              )}

              {(listing.description.trim() || features.length > 0) && (
                <Section title="About this" className="max-sm:px-3" testId="listing-about">
                  {listing.description.trim() && <p className="max-w-prose break-words whitespace-pre-line">{listing.description}</p>}
                  {features.length > 0 && (
                    <ul aria-label="Includes" data-testid="listing-features" className="flex flex-wrap gap-2">
                      {features.map((feature) => (
                        <li key={feature.label}>
                          <Badge tone="fact">
                            <FeatureGlyph name={feature.icon} className="size-4 text-primary" />
                            {feature.label}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </Section>
              )}

              {tour && (
                <div className="max-sm:px-3">
                  <TourFacts listing={listing} tour={tour} />
                </div>
              )}
              {vehicleRate && (
                <div className="max-sm:px-3">
                  <VehiclePrice listing={listing} rate={vehicleRate} />
                </div>
              )}
              {/* A tour's facts already list what it includes. */}
              {own && !tour && <BusinessIncluded listings={[own]} />}
              {business && shop && <BusinessWhere business={business} area={shop.area} town={town} onlyStays={listing.group === "stay"} />}
              {business && <BusinessGoodToKnow business={business} />}
            </div>
          </div>

          {shop && <MoreFromBusiness name={listing.business.name} href={businessHref} groups={more} dates={dates} />}
        </div>

        {/* A phone's and tablet's foot: a stay or vehicle points down to its card; anything
            else adds from here, the price beside the button. */}
        {booker ? (
          <BookJumpBar target="book" watch="book-add" label={rate ? "Choose rooms" : "Choose vehicles"}>
            {priceLine && (
              <p data-testid="listing-price" className="text-sm font-semibold text-pretty">
                {priceLine}
              </p>
            )}
          </BookJumpBar>
        ) : (
          <Card data-testid="listing-foot" className="sticky bottom-[calc(0.5rem+env(safe-area-inset-bottom))] z-20 mx-2 mb-2 shadow-float lg:hidden">
            <CardBody className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex min-w-0 flex-col items-start gap-1">
                {priceLine && <p className="text-sm font-semibold text-pretty">{priceLine}</p>}
                <InTripBadge listingId={listing.id} />
              </div>
              <AddToTripButton listing={listing} dates={dates} />
            </CardBody>
          </Card>
        )}
      </TripAddProvider>
    </TripLinkProvider>
  );
}
