import Image from "next/image";
import { getDestinations, type AreaCard, type BusinessDetail } from "@/api/discovery";
import { BookJumpBar } from "@/components/discovery/book-jump-bar";
import { descendants, offerOf, vehicleShop } from "@/components/discovery/browse-offers";
import { BusinessOptions } from "@/components/discovery/business-row";
import { TRIP_ORDER_GROUPS } from "@/components/discovery/categories";
import { ListingPhotos } from "@/components/discovery/listing-photos";
import { PlaceGlyph } from "@/components/discovery/tag-glyphs";
import { isApiPhoto } from "@/components/landing/sample-photos";
import { TripAddProvider } from "@/components/trips/trip-add-provider";
import { AdoptTrip, TripLinkProvider } from "@/components/trips/trip-link";
import { readTripDates, tripDatesQuery, tripParam } from "@/components/trips/trip-dates";
import { cn } from "@/components/ui/cn";
import { Section } from "@/components/ui/section";
import { Price } from "@/components/ui/typography";
import { formatPeso } from "@/lib/money";
import { priceUnitText } from "@/lib/pricing";

type SearchParams = Record<string, string | string[] | undefined>;

// Only a positive integer can be a business id; anything else is a 404 without asking the API.
export function businessId(param: string): number | null {
  return /^[1-9]\d{0,14}$/.test(param) ? Number(param) : null;
}

// Only for the way back's name and the trip's places, so the page still renders without them.
export async function destinationsOrNone() {
  return getDestinations().catch((error: unknown) => {
    console.error(error);
    return [] as AreaCard[];
  });
}

// What a business's page shows, from its search params: the place it came from (`?place=`, else
// the place most of its listings are in) and the places inside it, the group it was opened from
// first (`?show=`), the trip (`?trip=`), and the way back. Opened from a plan step (`?plan=1`) it
// shows only that step's group and its way back returns to the plan.
export function businessView(detail: BusinessDetail, destinations: AreaCard[], searchParams: SearchParams) {
  const { business, area, listings } = detail;
  const dates = readTripDates(searchParams);
  const asked = typeof searchParams.place === "string" ? destinations.find((each) => each.slug === searchParams.place) : undefined;
  const from = asked ? { slug: asked.slug, name: asked.name } : { slug: area.slug, name: area.name };
  const places = [from.slug, ...descendants(destinations, from.slug).map((each) => each.slug)];
  const show = typeof searchParams.show === "string" ? searchParams.show : undefined;
  const tripId = tripParam(searchParams.trip);

  // Its options by group, in What to book's order, the group it was opened from first; a plan
  // step's group alone (all of them if it has none in that group).
  const all = TRIP_ORDER_GROUPS.map((group) => ({ ...group, listings: listings.filter((each) => each.group === group.group) }))
    .filter((group) => group.listings.length > 0)
    .sort((a, b) => Number(b.id === show) - Number(a.id === show));
  const fromPlan = searchParams.plan === "1" && Boolean(tripId);
  const groups = fromPlan && all.some((group) => group.id === show) ? all.filter((group) => group.id === show) : all;

  let backHref: string;
  let backLabel: string;
  if (fromPlan) {
    backHref = `/plan/${from.slug}?trip=${tripId}`;
    backLabel = "Your plan";
  } else {
    const back = new URLSearchParams(tripDatesQuery(dates).replace(/^\?/, ""));
    if (show) back.set("show", show);
    if (tripId) back.set("trip", String(tripId));
    backHref = `/${from.slug}${back.size ? `?${back}` : ""}#listings`;
    backLabel = from.name;
  }
  const shown = groups.flatMap((group) => group.listings);
  const town = [business.city, business.province].filter(Boolean).join(", ");
  return { business, area, dates, from, places, tripId, groups, shown, backHref, backLabel, town };
}

export type BusinessViewData = ReturnType<typeof businessView>;

// A business's page under its banner (or in the plan's phone modal, `inModal`): its photos, what
// it says about itself, its options by group, each with its price and Add to trip and its details
// in the side panel, and where it is. Adds go to the trip the place's banner shows, as they would
// there (TripAddProvider `places`).
export function BusinessBody({ view, inModal = false }: { view: BusinessViewData; inModal?: boolean }) {
  const { business, area, dates, from, places, tripId, groups, shown, town } = view;
  const photos = shown.flatMap((listing) => listing.photos.map((photo) => ({ ...photo, alt: listing.title })));
  // The foot's price is the leading group's (the one it was opened from), never a gear item's
  // beside a stay.
  const cheapest = groups[0].listings
    .filter((listing) => listing.price_from_cents)
    .sort((a, b) => (a.price_from_cents ?? 0) - (b.price_from_cents ?? 0))[0];

  return (
    <>
      {tripId && <AdoptTrip id={tripId} />}
      <TripLinkProvider place={from.slug} places={places}>
        <TripAddProvider places={places}>
          <div className={cn("mx-auto flex w-full max-w-page flex-col gap-section px-gutter py-page-pad max-sm:px-0", inModal && "max-sm:pt-0")}>
            {photos.length > 0 && (
              <section aria-label={`${business.name}: photos`} data-testid="business-photos">
                {/* A swipe on a phone; from sm, one large photo beside four (Booking.com's mosaic). */}
                <ListingPhotos
                  photos={photos.map((photo) => ({ src: photo.card_url, alt: photo.alt }))}
                  label={business.name}
                  category={shown[0].category}
                  className={cn("aspect-[4/3] sm:hidden", inModal ? "rounded-none" : "rounded-card")}
                />
                <ul className="grid grid-cols-4 grid-rows-2 gap-2 max-sm:hidden sm:aspect-[5/2]">
                  {photos.slice(0, 5).map((photo, index) => (
                    <li
                      key={photo.large_url}
                      className={cn(
                        "relative overflow-hidden rounded-control bg-mist",
                        index === 0 && "col-span-2 row-span-2 rounded-l-card",
                        photos.length === 1 && "col-span-4",
                        index === 2 && "rounded-tr-card",
                        index === 4 && "rounded-br-card",
                      )}
                    >
                      <Image
                        src={index === 0 ? photo.large_url : photo.card_url}
                        alt={photo.alt}
                        fill
                        sizes={index === 0 ? "(min-width: 80rem) 640px, 50vw" : "(min-width: 80rem) 320px, 25vw"}
                        unoptimized={isApiPhoto(photo.large_url)}
                        priority={index === 0}
                        className="object-cover"
                      />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {business.description.trim() && (
              <Section title="About" className="max-sm:px-3">
                <p className="max-w-prose break-words whitespace-pre-line">{business.description}</p>
              </Section>
            )}

            <div id="options" className="flex flex-col gap-section" data-testid="business-options-list">
              {groups.map((group) => {
                const offers = group.listings.map((listing) =>
                  offerOf(listing, { dates, pageSlug: from.slug, groupTitle: group.title }),
                );
                return (
                  <Section key={group.id} id={group.id} title={group.title} className="max-sm:px-3">
                    <BusinessOptions
                      name={business.name}
                      groupTitle={group.title}
                      offers={offers}
                      dates={dates}
                      shop={vehicleShop(group.listings)}
                    />
                  </Section>
                );
              })}
            </div>

            <Section title="Where it is" className="max-sm:px-3">
              <p className="flex items-center gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-mist text-primary">
                  <PlaceGlyph className="size-5" />
                </span>
                <span>
                  {[town, area.name !== business.city ? area.name : null].filter(Boolean).join(" · ") || area.name}
                </span>
              </p>
            </Section>
          </div>

          {/* A phone's foot, down to the options while they are out of view (the page only). */}
          {!inModal && (
            <BookJumpBar target="options" watch="options" label="See options">
              {cheapest?.price_from_cents && (
                <Price
                  prefix="from"
                  amount={formatPeso(cheapest.price_from_cents)}
                  unit={priceUnitText(cheapest.price_unit) ?? undefined}
                />
              )}
            </BookJumpBar>
          )}
        </TripAddProvider>
      </TripLinkProvider>
    </>
  );
}

// "Stays · Gear", "2 options": the groups shown and how many.
export function businessCount(view: BusinessViewData) {
  return `${view.shown.length} ${view.shown.length === 1 ? "option" : "options"}`;
}
