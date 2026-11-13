import Image from "next/image";
import { getDestinations, type AreaCard, type BusinessDetail } from "@/api/discovery";
import { BookJumpBar } from "@/components/discovery/book-jump-bar";
import { descendants, offerOf, rentalShop } from "@/components/discovery/browse-offers";
import { BusinessOptions } from "@/components/discovery/business-row";
import { BusinessMapLoader } from "@/components/discovery/business-map-loader";
import { BusinessGoodToKnow, BusinessIncluded, BusinessTrust, closedText, hoursText, shopFacts } from "@/components/discovery/business-shop";
import { TRIP_ORDER_GROUPS } from "@/components/discovery/categories";
import { ListingPhotos } from "@/components/discovery/listing-photos";
import { PlaceGlyph } from "@/components/discovery/tag-glyphs";
import { isApiPhoto } from "@/components/landing/sample-photos";
import { TripAddProvider } from "@/components/trips/trip-add-provider";
import { AdoptTrip, TripLinkProvider } from "@/components/trips/trip-link";
import { readTripDates, tripDatesQuery, tripParam } from "@/components/trips/trip-dates";
import { cn } from "@/components/ui/cn";
import { Badge } from "@/components/ui/badge";
import { Section } from "@/components/ui/section";
import { DisplayTitle, Price } from "@/components/ui/typography";
import type { ReactNode } from "react";
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
// first (`?show=`) and, opened from a title card (`?item=`), that listing's title first in its
// group, the trip (`?trip=`), and the way back. Opened from a plan step (`?plan=1`) it
// shows only that step's group and its way back returns to the plan.
export function businessView(detail: BusinessDetail, destinations: AreaCard[], searchParams: SearchParams) {
  const { business, area, listings } = detail;
  const dates = readTripDates(searchParams);
  const asked = typeof searchParams.place === "string" ? destinations.find((each) => each.slug === searchParams.place) : undefined;
  const from = asked ? { slug: asked.slug, name: asked.name } : { slug: area.slug, name: area.name };
  const places = [from.slug, ...descendants(destinations, from.slug).map((each) => each.slug)];
  const show = typeof searchParams.show === "string" ? searchParams.show : undefined;
  const tripId = tripParam(searchParams.trip);
  // The listing a title card ("Mio 125 by …") stands for, and every one of its title here.
  const itemId = typeof searchParams.item === "string" ? Number(searchParams.item) : NaN;
  const item = listings.find((each) => each.id === itemId);
  const titleOf = (listing: { title: string }) => listing.title.trim().toLowerCase();
  const isItem = (listing: (typeof listings)[number]) =>
    Boolean(item) && listing.group === item!.group && titleOf(listing) === titleOf(item!);
  const items = listings.filter(isItem).map((each) => each.id);

  // Its options by group, in What to book's order, the group it was opened from first, and in it
  // the card's title first; a plan step's group alone (all of them if it has none in that group).
  const all = TRIP_ORDER_GROUPS.map((group) => ({
    ...group,
    listings: listings
      .filter((each) => each.group === group.group)
      .sort((a, b) => Number(isItem(b)) - Number(isItem(a))),
  }))
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
    backHref = `/${from.slug}/book${back.size ? `?${back}` : ""}`;
    backLabel = from.name;
  }
  const shown = groups.flatMap((group) => group.listings);
  const town = [business.city, business.province].filter(Boolean).join(", ");
  return { business, area, dates, from, places, tripId, groups, shown, items, backHref, backLabel, town };
}

export type BusinessViewData = ReturnType<typeof businessView>;

// A business's page under its banner (or in the planner's frame, `inPlan`, under the plan's bar
// and stepper), as a shop page (RAA-281): its photos (its own covers first), the facts a guest
// weighs first, what it says about itself, its options by group, each with its price and Add to
// trip and its details in the side panel, what comes with them, where it is and Good to know.
// Adds go to the trip the place's banner shows, as they would there (TripAddProvider `places`).
export function BusinessBody({ view, inPlan = false }: { view: BusinessViewData; inPlan?: boolean }) {
  const { business, area, dates, from, places, tripId, groups, shown, items, town } = view;
  // Its own cover photos lead (RAA-281), then its listings'.
  const photos = [
    ...business.cover_photos.map((photo) => ({ ...photo, alt: business.name })),
    ...shown.flatMap((listing) => listing.photos.map((photo) => ({ ...photo, alt: listing.title }))),
  ];
  const facts = shopFacts(business, shown, groups[0].group);
  const onlyStays = shown.every((listing) => listing.group === "stay");
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
          <div
            className={cn(
              "flex w-full flex-col gap-section",
              inPlan ? "pt-2 pb-page-pad" : "mx-auto max-w-page px-gutter py-page-pad max-sm:px-0",
            )}
          >
            {/* Its photos, its name close under them (RAA-314). */}
            <div className="flex flex-col gap-5">
              {photos.length > 0 && (
                <ShopPhotos photos={photos} label={business.name} category={shown[0].category} testId="business-photos" />
              )}

              <ShopHeading
                title={business.name}
                as={inPlan ? "h2" : "h1"}
                mark={
                  // Its logo beside its name (RAA-281), else its initials.
                  business.logo ? (
                    <Image src={business.logo.card_url} alt={`${business.name} logo`} fill sizes="56px" unoptimized className="object-cover" />
                  ) : (
                    initials(business.name)
                  )
                }
                meta={
                  <>
                    <span className="inline-flex items-center gap-1.5">
                      <PlaceGlyph className="size-4 text-primary" />
                      {[town || area.name, businessCount(view)].join(" · ")}
                    </span>
                    <span>{groups.map((group) => group.short).join(" · ")}</span>
                    {business.verified && <VerifiedBadge testId="business-verified" />}
                  </>
                }
              />
            </div>

            <BusinessTrust facts={facts} />

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
                      shop={rentalShop(group.listings)}
                      items={items}
                    />
                  </Section>
                );
              })}
            </div>

            <BusinessIncluded listings={shown} />

            <BusinessWhere business={business} area={area} town={town} onlyStays={onlyStays} />

            <BusinessGoodToKnow business={business} />
          </div>

          {/* A phone's foot, down to the options while they are out of view. */}
          <BookJumpBar target="options" watch="options" label="See options">
            {cheapest?.price_from_cents && (
              <Price
                prefix="from"
                amount={formatPeso(cheapest.price_from_cents)}
                unit={priceUnitText(cheapest.price_unit) ?? undefined}
              />
            )}
          </BookJumpBar>
        </TripAddProvider>
      </TripLinkProvider>
    </>
  );
}

type ShopPhoto = { card_url: string; large_url: string; alt: string };

// A shop's or a listing's photos under its banner: a swipe on a phone; from sm, one large photo
// beside four (Booking.com's mosaic).
export function ShopPhotos({
  photos,
  label,
  category,
  testId,
  className,
}: {
  photos: ShopPhoto[];
  label: string;
  category: string;
  testId?: string;
  className?: string;
}) {
  // The first photo is the page's largest paint (RAA-231): a phone shows the swipe's card-sized
  // one, a wider window the mosaic's large one, and the other is display:none. So each width
  // preloads only its own, by media query, and the hidden one stays lazy and is never fetched;
  // next/image's `preload` can't take a media query, and would fetch both everywhere. Rendered
  // as <link>s (React hoists them into the head), not react-dom's preload(), which from here
  // reached the browser only as a hint in the RSC payload, once the page's JavaScript ran.
  const lead = photos[0];
  const preloads = lead && isApiPhoto(lead.card_url) && (
    <>
      <link rel="preload" as="image" href={lead.card_url} media="(width < 40rem)" fetchPriority="high" />
      <link rel="preload" as="image" href={lead.large_url} media="(width >= 40rem)" fetchPriority="high" />
    </>
  );
  return (
    <section aria-label={`${label}: photos`} data-testid={testId}>
      {preloads}
      <ListingPhotos
        photos={photos.map((photo) => ({ src: photo.card_url, alt: photo.alt }))}
        lead
        label={label}
        category={category}
        className={cn("aspect-[4/3] rounded-card sm:hidden", className)}
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
              fetchPriority={index === 0 ? "high" : undefined}
              className="object-cover"
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

// Where a business is: its door on a map when it shows one (`map`); a
// business that only offers stays shows its town, the street coming with a booking (RAA-281).
export function BusinessWhere({
  business,
  area,
  town,
  onlyStays,
  map = true,
  className = "max-sm:px-3",
}: {
  business: BusinessDetail["business"];
  area: BusinessDetail["area"];
  town: string;
  onlyStays: boolean;
  map?: boolean;
  className?: string;
}) {
  return (
    <Section title="Where it is" className={className} testId="business-where">
      {business.location && map && <BusinessMapLoader point={business.location} name={business.name} />}
      <p className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-mist text-primary">
          <PlaceGlyph className="size-5" />
        </span>
        <span className="flex flex-col">
          <span>
            {[business.street, town, area.name !== business.city ? area.name : null].filter(Boolean).join(" · ") || area.name}
          </span>
          {onlyStays && <span className="text-sm text-muted">The exact address comes with your booking.</span>}
          {business.hours && (
            <span className="text-sm text-muted">
              Open {hoursText(business.hours)} · {closedText(business.hours.closed_days)}
            </span>
          )}
        </span>
      </p>
    </Section>
  );
}

// "Stays · Gear", "2 options": the groups shown and how many.
export function businessCount(view: BusinessViewData) {
  return `${view.shown.length} ${view.shown.length === 1 ? "option" : "options"}`;
}

// "Kuya Jun Moto Rentals" → "KJ".
export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("");
}

export function VerifiedBadge({ testId }: { testId?: string }) {
  return (
    <Badge tone="emerald" data-testid={testId}>
      <span aria-hidden>✓</span> Verified partner
    </Badge>
  );
}

// A shop's or a listing's name under its photos (RAA-314), as Klook and Booking.com show it: its
// mark (a logo or initials) beside the name, then a line of what, where and who. The page's h1;
// an h2 in the planner's frame, under the plan's own heading.
export function ShopHeading({ title, as = "h1", mark, meta }: { title: string; as?: "h1" | "h2"; mark?: ReactNode; meta: ReactNode }) {
  return (
    <header className="flex flex-col gap-2 max-sm:px-3">
      <div className="flex items-center gap-3">
        {mark && (
          <span className="relative grid size-14 shrink-0 place-items-center overflow-hidden rounded-control bg-trip-band font-display text-lg font-extrabold text-white max-sm:size-12">
            {mark}
          </span>
        )}
        {as === "h1" ? (
          <DisplayTitle className="min-w-0 break-words text-balance text-navy">{title}</DisplayTitle>
        ) : (
          <h2 className="min-w-0 font-display text-2xl font-extrabold tracking-tight text-balance break-words text-navy">{title}</h2>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-muted">{meta}</div>
    </header>
  );
}
