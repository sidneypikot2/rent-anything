"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useSyncExternalStore, type ComponentProps, type ReactNode } from "react";
import { isApiPhoto } from "@/components/landing/sample-photos";
import { handoverLabel, sharedFees } from "@/components/trips/delivery-options";
import { InTripBadge, InTripCount } from "@/components/trips/in-trip-badge";
import type { TripDates } from "@/components/trips/trip-dates";
import { useTripHref } from "@/components/trips/trip-link";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { Price } from "@/components/ui/typography";
import { TO_BE_AGREED } from "@/lib/pricing";
import { InstantBookBadge } from "./instant-book-badge";
import type { Feature } from "./listing-features";
import { ListingPhotos } from "./listing-photos";
import { TourStops } from "./landmark-tours";
import { ListingRowDetails } from "./listing-row-details";
import type { Photo } from "./photo-card";
import { markLeaving } from "./back-link";
import { useShopModels } from "./shop-models";
import { StayMixPicker, type MixOffer } from "./stay-mix-picker";
import { ArrowGlyph, CategoryGlyph, MapGlyph, PlaceGlyph } from "./tag-glyphs";

// One of a business's listings in a What to book group, as its card and panel show it.
export type Offer = {
  listingId: number;
  href: string;
  title: string;
  category: string;
  by: string;
  summary?: string | null;
  photos: Photo[];
  features: Feature[];
  // Its "from" price in centavos, which the card compares; `price` says it.
  priceCents: number | null;
  price?: ComponentProps<typeof Price>;
  // How it is priced while it has no price (pricedByText): the panel says it in full, the row
  // says "Price to be agreed" and its section's note says what that means.
  unpriced?: string;
  instantBook: boolean;
  // Its own place ("Santa Fe"), where a rental vehicle is collected when the shop doesn't bring it.
  place?: string;
  // A rental vehicle's delivery and pick-up fees (RAA-205), each null when the shop doesn't;
  // left out for anything else.
  handover?: { delivery_fee_cents: number | null; return_pickup_fee_cents: number | null } | null;
  // Add to trip on its row.
  action: ReactNode;
  // The places to see it goes to (a tour's stops), so its option can name the ones saved to the trip.
  goesTo?: { slug: string; name: string }[];
  // A stay, as the mix picker takes it (RAA-188), so a partner's room types can be booked together.
  stay?: MixOffer;
};

// Photos a card shows: each listing's first, then the rest, so a swipe meets every listing.
const CARD_PHOTOS = 6;

// A laptop or desktop: a business's page opens in a new tab there, so What to book stays where
// the guest left it, as Booking.com's do; a phone or tablet goes there in the same tab, and its
// page's back button returns.
const NEW_TAB = "(min-width: 64rem) and (pointer: fine)";
function subscribeWide(onChange: () => void) {
  const query = window.matchMedia(NEW_TAB);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
export function useOpensInNewTab() {
  return useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia(NEW_TAB).matches,
    () => false,
  );
}
// A link's target for a business's page. `rel="opener"` keeps the tab's sessionStorage (the
// chosen trip, a trip link's session) in the new one, which an implied noopener would drop.
export function newTabProps(newTab: boolean) {
  return newTab ? { target: "_blank", rel: "opener" } : {};
}

// A card in a What to book group. A stay's is its business (Booking.com's way): its name leads,
// what it offers in the group is its by-line ("Sea view room + 2 more"). Any other is one listing
// title of a business (`title`): the title leads, "by <business>" under it, with "2 options" when
// the business lists it more than once. Then from what price, and the chips all of those share. Its name and its See details open the business's
// own page (`href`), where its options are listed and added to a trip (BusinessOptions): in a
// new tab on a laptop, in the same tab on a phone. Every card ends in the same See details,
// whatever it offers. `tall` (What to book's sideways rows, 2026-11-11): the same card stacked,
// its photos on top and the price and See details at its foot, filling its row's height.
export function BusinessRow({
  name,
  title,
  href,
  place,
  groupTitle,
  offers,
  sharedChips = [],
  tall = false,
}: {
  name: string;
  // The listing title a title card stands for (every group but stays).
  title?: string;
  // The business's page, with the trip's dates and this group (businessHref).
  href: string;
  // "in Santa Fe", for a business in a place inside this one.
  place?: string;
  groupTitle: string;
  offers: Offer[];
  // Chips every card in its group has, which the group's note says once instead (its page
  // still lists them).
  sharedChips?: string[];
  tall?: boolean;
}) {
  // With the trip here, so the page it opens adds to it without asking (useTripHref).
  const pageHref = useTripHref()(href);
  const newTab = useOpensInNewTab();
  if (offers.length === 0) return null;

  const single = offers.length === 1 ? offers[0] : null;
  const photos = [
    ...offers.flatMap((offer) => offer.photos.slice(0, 1)),
    ...offers.flatMap((offer) => offer.photos.slice(1)),
  ].slice(0, CARD_PHOTOS);
  const categories = [...new Set(offers.map((offer) => offer.category))];
  const priced = offers.filter((offer) => offer.price);
  const cheapest = [...priced].sort((a, b) => (a.priceCents ?? 0) - (b.priceCents ?? 0))[0]?.price;
  const units = new Set(priced.map((offer) => offer.price?.unit));
  const price = cheapest && { ...cheapest, prefix: "from", unit: units.size === 1 ? cheapest.unit : undefined };
  // Chips every one of its listings here has, so the card promises nothing one of them lacks.
  const common = offers[0].features.filter(
    (feature) =>
      !sharedChips.includes(feature.label) &&
      offers.every((offer) => offer.features.some((each) => each.label === feature.label)),
  );
  // What is for sale, under the name: the one option, or the first with the rest counted
  // ("DJI Osmo Action 4 + 5 more"); the page lists them all.
  const forSale = single ? single.title : `${offers[0].title} + ${offers.length - 1} more`;
  const heading = title ?? name;
  const label = title
    ? `${title} by ${name}${single ? "" : `, ${offers.length} options`}`
    : `${name}: ${forSale}`;
  const instant = offers.every((offer) => offer.instantBook);
  // How its vehicles reach the guest (RAA-205): what every one of them here offers.
  const rates = offers.map((offer) => offer.handover ?? null);
  const handover = rates.every((rate) => rate) ? sharedFees(rates) : null;
  const target = newTabProps(newTab);

  return (
    <div
      className={cn(
        "relative",
        tall
          ? "flex h-full flex-col gap-3"
          : "grid grid-cols-[minmax(0,1fr)] gap-4 @sm:grid-cols-[10rem_minmax(0,1fr)] @2xl:grid-cols-[19rem_minmax(0,1fr)_auto] @2xl:items-start @2xl:gap-5",
      )}
    >
      <ListingPhotos
        photos={photos}
        label={heading}
        category={categories[0]}
        inset
        className={cn("z-10", tall ? "aspect-[4/3]" : "aspect-[2/1] @sm:aspect-square @2xl:aspect-[4/3]")}
      />
      <div className={cn("flex min-w-0 flex-col gap-2.5", tall ? "flex-1 px-1" : "px-1 @sm:px-0")}>
        <div className="flex min-w-0 flex-col gap-0.5">
          <h4 className="line-clamp-2 text-lg leading-snug font-semibold text-balance">
            {/* The whole card is this link (its ::after), under the photos and the action. */}
            <Link
              href={pageHref}
              {...target}
              onClick={() => !newTab && markLeaving()}
              data-testid="business-open"
              // A business can be in several groups: its label says which, for a screen reader's list.
              aria-label={`${label}, ${groupTitle}${newTab ? " (opens in a new tab)" : ""}`}
              className="cursor-pointer text-left underline-offset-4 outline-none after:absolute after:inset-0 after:rounded-card after:content-[''] hover:underline focus-visible:after:outline-2 focus-visible:after:outline-offset-4 focus-visible:after:outline-(--focus)"
            >
              {heading}
            </Link>
          </h4>
          <p className="line-clamp-1 text-sm font-medium text-foreground" data-testid="business-for-sale">
            {title ? (
              <>
                by {name}
                {!single && <span className="whitespace-nowrap text-muted"> · {offers.length} options</span>}
              </>
            ) : single ? (
              forSale
            ) : (
              <>
                {offers[0].title} <span className="whitespace-nowrap text-muted">+ {offers.length - 1} more</span>
              </>
            )}
            {place && <span className="text-muted"> · {place}</span>}
          </p>
        </div>
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
          {/* One badge for the card: an option's own, or a count of those in the trip. */}
          {single ? (
            <InTripBadge listingId={single.listingId} />
          ) : (
            <InTripCount listingIds={offers.map((offer) => offer.listingId)} />
          )}
          {/* One category on a phone-wide row, two from @sm. */}
          {categories.slice(0, 2).map((category, index) => (
            <Badge key={category} tone="kind" className={cn("min-h-6 px-2.5 text-xs", index > 0 && "@max-sm:hidden")}>
              <CategoryGlyph name={category} className="size-3.5" />
              {category}
            </Badge>
          ))}
          {instant && <InstantBookBadge small />}
          {handover && (
            <Badge
              tone={handover.delivery !== null || handover.returnPickup !== null ? "aqua" : "mist"}
              className="min-h-6 px-2.5 text-xs"
              data-testid="handover-badge"
            >
              {handover.delivery !== null ? <MapGlyph className="size-3.5" /> : <PlaceGlyph className="size-3.5" />}
              {handoverLabel(handover)}
            </Badge>
          )}
        </p>
        <ListingRowDetails summary={single?.summary} features={common} />
      </div>
      <div
        className={cn(
          "relative z-10 flex flex-wrap items-center justify-between gap-3 px-1",
          tall
            ? "border-t border-line pt-3"
            : "@sm:col-span-2 @2xl:col-span-1 @2xl:flex-col @2xl:items-end @2xl:justify-start @2xl:px-0 @2xl:pt-1",
        )}
      >
        {price ? (
          <Price {...price} />
        ) : (
          offers[0].unpriced && (
            <span className={cn("text-sm text-pretty text-muted", !tall && "@2xl:max-w-36 @2xl:text-right")}>{TO_BE_AGREED}</span>
          )
        )}
        {/* Every card ends in the same action. The name's link already opens the page for the
            keyboard and a screen reader. */}
        <ButtonLink
          href={pageHref}
          {...target}
          onClick={() => !newTab && markLeaving()}
          variant="soft"
          size="touch"
          arrow
          tabIndex={-1}
          aria-hidden
          data-testid="business-details"
          className="max-w-full shrink-0"
        >
          See details
        </ButtonLink>
      </div>
    </div>
  );
}

// What tells a business's options apart ("Sleeps 4 · 2 beds"): their details not every one shares.
function apartOf(offers: Offer[]) {
  return (offer: Offer) =>
    offer.features
      .filter((feature) => !offers.every((other) => other.features.some((each) => each.label === feature.label)))
      .slice(0, 2)
      .map((feature) => feature.label)
      .join(" · ");
}

// A business's options in one group, on its own page (Booking.com's room table): each with its
// photo, what sets it apart, its price and Add to trip; its title opens the listing's own page in
// a new tab on a laptop (as the card did this page), in the same tab on a phone. A stay with several room types and the trip's
// dates offers rooms for the whole party first (StayMixPicker, RAA-188); a rental shop picks its
// models together (`shop`, RAA-191). Opened from a title card, its `items` (the card's listings,
// already first) are scrolled to and lit briefly on arrival.
export function BusinessOptions({
  name,
  groupTitle,
  offers,
  dates,
  shop,
  items = [],
}: {
  name: string;
  groupTitle: string;
  offers: Offer[];
  dates: TripDates;
  shop?: { businessId: number; counted: boolean };
  items?: number[];
}) {
  const router = useRouter();
  const newTab = useOpensInNewTab();
  const apart = apartOf(offers);
  const tripHref = useTripHref();
  const listRef = useRef<HTMLDivElement>(null);
  const first = offers.find((offer) => items.includes(offer.listingId))?.listingId;
  useEffect(() => {
    if (first === undefined) return;
    const target = listRef.current?.querySelector(`[data-option="${first}"]`) ?? listRef.current;
    target?.scrollIntoView({ block: "center" });
  }, [first]);
  if (shop)
    return (
      <div ref={listRef}>
        <ShopOptions name={name} businessId={shop.businessId} counted={shop.counted} offers={offers} dates={dates} first={items} />
      </div>
    );

  const stays = offers.flatMap((offer) =>
    offer.stay
      ? [{ ...offer.stay, thumb: <Thumb offer={offer} />, apart: apart(offer), open: () => {
            if (newTab) window.open(tripHref(offer.href), "_blank", "opener");
            else {
              markLeaving();
              router.push(tripHref(offer.href));
            }
          } }]
      : [],
  );
  const mixing = stays.length >= 2 && Boolean(dates.from && dates.to);
  const list = (
    <ul aria-label={`${name}: ${groupTitle}`} className="flex flex-col gap-3" data-testid="business-offers">
      {offers.map((offer) => (
        <li
          key={offer.listingId}
          data-option={offer.listingId}
          className={cn("@container scroll-mt-(--chrome)", items.includes(offer.listingId) && "just-added")}
        >
          <Card edge="line" className="group relative transition-colors duration-300 ease-calm hover:border-line-strong">
            <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-start gap-3 p-3 @md:grid-cols-[9rem_minmax(0,1fr)_auto] @md:gap-4">
              <Thumb offer={offer} large />
              <div className="flex min-w-0 flex-col gap-1.5">
                <a
                  href={tripHref(offer.href)}
                  data-testid="business-offer"
                  {...newTabProps(newTab)}
                  aria-label={newTab ? `${offer.title} (opens in a new tab)` : undefined}
                  onClick={() => !newTab && markLeaving()}
                  className="flex items-start gap-2 text-lg leading-snug font-semibold text-link underline-offset-4 after:absolute after:inset-0 after:rounded-card after:content-[''] hover:underline"
                >
                  {offer.title}
                  <ArrowGlyph className="mt-1 size-4 shrink-0 transition-transform duration-500 ease-calm motion-safe:group-hover:translate-x-0.5" />
                </a>
                {apart(offer) && <span className="text-sm text-foreground">{apart(offer)}</span>}
                {offer.summary && <p className="line-clamp-2 text-sm text-muted @max-md:hidden">{offer.summary}</p>}
                <ListingRowDetails features={offer.features} />
                {offer.goesTo && <TourStops stops={offer.goesTo} />}
                <InTripBadge listingId={offer.listingId} />
              </div>
              {/* The price and the one action: under the details on a narrow row, on the right from @md. */}
              <div className="relative z-10 col-span-2 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3 @md:col-span-1 @md:flex-col @md:items-end @md:border-0 @md:pt-0">
                <span className="text-sm text-pretty text-muted @md:text-right">
                  {offer.price ? <Price {...offer.price} prefix="from" /> : offer.unpriced && TO_BE_AGREED}
                </span>
                {offer.action}
              </div>
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
  return (
    <div ref={listRef}>
      {mixing ? <StayMixPicker offers={stays} dates={dates} fallback={list} /> : list}
    </div>
  );
}

// A rental shop's models (RAA-191, the plan's mock 2), each with a counter, the seats they make
// for the trip's people (not gear's, which is `counted`), the total and one Add for them all, in a
// card on its page.
function ShopOptions({
  name,
  businessId,
  counted,
  offers,
  dates,
  first,
}: {
  name: string;
  businessId: number;
  counted: boolean;
  offers: Offer[];
  dates: TripDates;
  first: number[];
}) {
  const { body, summary, action } = useShopModels({
    business: { id: businessId, name },
    category: { name: offers[0].category },
    group: counted ? "gear" : "rental",
    dates,
    people: dates.guests,
    listingIds: offers.map((offer) => offer.listingId),
    first,
    place: offers[0].place,
  });
  return (
    <Card edge="line" clip={false} data-testid="shop-options">
      <CardBody className="flex flex-col gap-4">
        {body}
        <div className="flex w-full flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <div className="min-w-0 flex-1">{summary}</div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      </CardBody>
    </Card>
  );
}

// A listing's first photo, small (or larger on its business's page), or its category icon.
function Thumb({ offer, large = false }: { offer: Offer; large?: boolean }) {
  const photo = offer.photos[0];
  return (
    <span
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden rounded-control bg-mist text-primary",
        large ? "aspect-square w-full @md:aspect-[4/3]" : "size-16",
      )}
    >
      {photo ? (
        <Image
          src={photo.src}
          alt=""
          fill
          sizes={large ? "(min-width: 48rem) 144px, 72px" : "64px"}
          unoptimized={isApiPhoto(photo.src)}
          className="object-cover"
        />
      ) : (
        <CategoryGlyph name={offer.category} className="size-6" />
      )}
    </span>
  );
}
