"use client";

import Image from "next/image";
import { createContext, useContext, useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { isApiPhoto } from "@/components/landing/sample-photos";
import { InTripBadge, InTripCount } from "@/components/trips/in-trip-badge";
import type { TripDates } from "@/components/trips/trip-dates";
import { vehicleNoun } from "@/components/trips/vehicle-party";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Dialog } from "@/components/ui/dialog";
import { Price } from "@/components/ui/typography";
import { TO_BE_AGREED } from "@/lib/pricing";
import { ListingPanel, PanelActions } from "./detail-panel";
import { InstantBookBadge } from "./instant-book-badge";
import type { Feature } from "./listing-features";
import { ListingPhotos } from "./listing-photos";
import { ListingRowDetails } from "./listing-row-details";
import type { Photo } from "./photo-card";
import { useShopModels } from "./shop-models";
import { StayMixPicker, type MixOffer } from "./stay-mix-picker";
import { ArrowGlyph, CategoryGlyph } from "./tag-glyphs";

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
  // Add to trip in the panel's list, and the prominent one in its details' foot.
  action: ReactNode;
  panelAction: ReactNode;
  // A stay, as the mix picker takes it (RAA-188), so a partner's room types can be booked together.
  stay?: MixOffer;
};

// The listings What to book's filters (and a distance search) leave, by id; null for all. Set by
// ListingBrowser around each business card, so the card and its panel show only those.
export const ShownOffersContext = createContext<Set<number> | null>(null);

// Photos a card shows: each listing's first, then the rest, so a swipe meets every listing.
const CARD_PHOTOS = 6;

// A business in a What to book group (the team's business-first list): its name, what it
// offers in the group and from what price, and the chips all of those share. A click opens a
// side panel listing them, each with Add to trip, whose titles open their details in the same
// panel ("← <business>" goes back), so the guest never leaves the page. A business with one
// listing here opens that listing's details at once, and its card keeps that listing's Add to
// trip; with more, See N options takes its place, as there is more than one thing to add. A shop
// of rental vehicles (`shop`) always opens on its models to pick from ("Choose motorbikes"), one
// model or several, rather than one model's details (RAA-195).
export function BusinessRow({
  name,
  place,
  groupTitle,
  offers: allOffers,
  dates,
  sharedChips = [],
  shop,
}: {
  name: string;
  // "in Santa Fe", for a business in a place inside this one.
  place?: string;
  groupTitle: string;
  offers: Offer[];
  dates?: TripDates;
  // Chips every card in its group has, which the group's note says once instead (the panel
  // still lists them).
  sharedChips?: string[];
  // A shop whose listings here are all rental vehicles (RAA-191): its panel picks how many of each.
  shop?: { businessId: number };
}) {
  const shown = useContext(ShownOffersContext);
  const offers = shown ? allOffers.filter((offer) => shown.has(offer.listingId)) : allOffers;
  const [open, setOpen] = useState(false);
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
  // What is for sale leads (a guest scans for a cottage or a van, not a company they don't know);
  // the business is its by-line. With several options the first is named and the rest counted
  // ("DJI Osmo Action 4 + 5 more"), as their titles in a row read as clutter; the panel lists them all.
  const title = single ? single.title : `${offers[0].title} + ${offers.length - 1} more`;
  const instant = offers.every((offer) => offer.instantBook);

  return (
    // A row of What to book's list, on its white sheet: no card of its own (the list divides the
    // rows), so the sheet isn't cards inside a card.
    <div className="relative grid grid-cols-[minmax(0,1fr)] gap-4 @sm:grid-cols-[10rem_minmax(0,1fr)] @2xl:grid-cols-[19rem_minmax(0,1fr)_auto] @2xl:items-start @2xl:gap-5">
      <ListingPhotos
        photos={photos}
        label={name}
        category={categories[0]}
        inset
        className="z-10 aspect-[2/1] @sm:aspect-square @2xl:aspect-[4/3]"
      />
      <div className="flex min-w-0 flex-col gap-2.5 px-1 @sm:px-0">
        <h4 className="line-clamp-2 text-lg leading-snug font-semibold text-balance">
          <button
            type="button"
            aria-haspopup="dialog"
            data-testid="business-open"
            // A business can be in several groups: its name says which, for a screen reader's list.
            aria-label={`${title}, by ${name}, ${groupTitle}`}
            onClick={() => setOpen(true)}
            className="cursor-pointer text-left underline-offset-4 outline-none after:absolute after:inset-0 after:rounded-card after:content-[''] hover:underline focus-visible:after:outline-2 focus-visible:after:outline-offset-4 focus-visible:after:outline-(--focus)"
          >
            {single ? (
              title
            ) : (
              // The count quieter than the name, so the card still reads as one thing for sale.
              <>
                {offers[0].title} <span className="font-medium whitespace-nowrap text-muted">+ {offers.length - 1} more</span>
              </>
            )}
          </button>
        </h4>
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
          <span>
            by <span className="font-medium text-foreground">{name}</span>
            {place && ` · ${place}`}
          </span>
        </p>
        <ListingRowDetails summary={single?.summary} features={common} />
      </div>
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 px-1 @sm:col-span-2 @2xl:col-span-1 @2xl:flex-col @2xl:items-end @2xl:justify-start @2xl:px-0 @2xl:pt-1">
        {price ? (
          <Price {...price} />
        ) : (
          offers[0].unpriced && <span className="text-sm text-pretty text-muted @2xl:max-w-36 @2xl:text-right">{TO_BE_AGREED}</span>
        )}
        {shop ? (
          <Button
            type="button"
            size="touch"
            arrow
            tabIndex={-1}
            aria-hidden
            onClick={() => setOpen(true)}
            data-testid="business-choose"
            className="max-w-full shrink-0"
          >
            Choose {vehicleNoun(categories[0], 2)}
          </Button>
        ) : (
          single?.action ?? (
          // The same slot as a listing's Add to trip, so every card ends in an action. The title's
          // button already opens the panel for the keyboard and a screen reader.
          <Button
            type="button"
            variant="soft"
            size="touch"
            arrow
            tabIndex={-1}
            aria-hidden
            onClick={() => setOpen(true)}
            data-testid="business-options"
            className="max-w-full shrink-0"
          >
            See {offers.length} options
          </Button>
          )
        )}
      </div>
      {open &&
        createPortal(
          <BusinessPanel
              name={name}
              place={place}
              groupTitle={groupTitle}
              offers={offers}
              dates={dates}
              shop={shop}
              onClose={() => setOpen(false)}
            />,
          document.body,
        )}
    </div>
  );
}

// The business's side panel: its listings in this group, then one's details in the same panel.
function BusinessPanel({
  name,
  place,
  groupTitle,
  offers,
  dates,
  shop,
  onClose,
}: {
  name: string;
  place?: string;
  groupTitle: string;
  offers: Offer[];
  dates?: TripDates;
  shop?: { businessId: number };
  onClose: () => void;
}) {
  const single = offers.length === 1;
  // A vehicle shop opens on its models, even just one; anything else with one listing on its details.
  const [pickedId, setPickedId] = useState<number | null>(single && !shop ? offers[0].listingId : null);
  const picked = offers.find((offer) => offer.listingId === pickedId) ?? null;
  // Each step opens at its top, wherever the last one was scrolled to.
  const body = useRef<HTMLDivElement>(null);
  useEffect(() => {
    body.current?.closest("[data-testid=detail-panel]")?.querySelector(".overflow-y-auto")?.scrollTo({ top: 0 });
  }, [pickedId]);
  // A link inside it to a row on the page (#listing-<id>) closes it, so the row is in view.
  useEffect(() => {
    window.addEventListener("hashchange", onClose);
    return () => window.removeEventListener("hashchange", onClose);
  }, [onClose]);

  if (picked)
    return (
      <Dialog
        open
        placement="side"
        title={picked.title}
        onClose={onClose}
        data-testid="detail-panel"
        media={
          <ListingPhotos
            photos={picked.photos}
            label={picked.title}
            category={picked.category}
            count="bottom"
            className="aspect-[4/3]"
          />
        }
        actions={<PanelActions price={picked.price} unpriced={picked.unpriced} action={picked.panelAction} listingId={picked.listingId} dates={dates} />}
      >
        <div ref={body} className="contents">
          {(!single || shop) && (
            <button
              type="button"
              data-testid="business-back"
              onClick={() => setPickedId(null)}
              className="flex min-h-11 w-fit items-center gap-1.5 text-sm font-semibold text-link underline-offset-4 hover:underline"
            >
              <ArrowGlyph direction="left" className="size-4" />
              {name}
            </button>
          )}
          <ListingPanel
            listingId={picked.listingId}
            href={picked.href}
            category={picked.category}
            by={picked.by}
            summary={picked.summary}
            features={picked.features}
            instantBook={picked.instantBook}
            dates={dates}
            unpriced={picked.price ? undefined : picked.unpriced}
          />
        </div>
      </Dialog>
    );

  const stays = offers.flatMap((offer) => (offer.stay ? [offer.stay] : []));
  // The business's own photos lead its panel, as a listing's do: each option's first, then the rest.
  const photos = [
    ...offers.flatMap((offer) => offer.photos.slice(0, 1)),
    ...offers.flatMap((offer) => offer.photos.slice(1)),
  ].slice(0, CARD_PHOTOS);
  const heading = [groupTitle, `${offers.length} ${offers.length === 1 ? "option" : "options"}`, place].filter(Boolean).join(" · ");
  // A shop's vehicles are picked together, a counter each, rather than added one card at a time.
  if (shop)
    return (
      <ShopPanel
        name={name}
        businessId={shop.businessId}
        heading={heading}
        photos={photos}
        offers={offers}
        dates={dates}
        onOpen={setPickedId}
        onClose={onClose}
      />
    );
  // What tells the options apart ("Sleeps 4 · 2 beds"): their details that not every one shares.
  const apart = (offer: Offer) =>
    offer.features
      .filter((feature) => !offers.every((other) => other.features.some((each) => each.label === feature.label)))
      .slice(0, 2)
      .map((feature) => feature.label)
      .join(" · ");
  return (
    <Dialog
      open
      placement="side"
      title={name}
      onClose={onClose}
      data-testid="detail-panel"
      media={
        <ListingPhotos
          photos={photos}
          label={name}
          category={offers[0].category}
          count="bottom"
          className="aspect-[16/9]"
        />
      }
    >
      <div ref={body} className="contents">
        <p className="-mt-2 text-sm text-muted">
          {heading}
        </p>
        {/* Several room types with trip dates: rooms for the whole party first (RAA-188). */}
        {stays.length >= 2 && dates?.from && dates.to && <StayMixPicker offers={stays} dates={dates} />}
        <ul aria-label={`${name}: ${groupTitle}`} className="flex flex-col gap-2.5" data-testid="business-offers">
          {offers.map((offer) => (
            <li
              key={offer.listingId}
              className="group relative grid grid-cols-[4rem_minmax(0,1fr)] items-start gap-x-3 gap-y-2.5 rounded-control border border-line p-2.5 transition-colors duration-300 ease-calm hover:border-line-strong hover:bg-surface-2"
            >
              <Thumb offer={offer} />
              <div className="flex min-w-0 flex-col gap-1">
                <button
                  type="button"
                  data-testid="business-offer"
                  onClick={() => setPickedId(offer.listingId)}
                  className="flex items-start justify-between gap-2 text-left font-semibold leading-snug text-link underline-offset-4 after:absolute after:inset-0 after:rounded-control after:content-[''] hover:underline"
                >
                  {offer.title}
                  <ArrowGlyph className="mt-0.5 size-4 shrink-0 transition-transform duration-500 ease-calm motion-safe:group-hover:translate-x-0.5" />
                </button>
                {apart(offer) && <span className="text-sm text-foreground">{apart(offer)}</span>}
              </div>
              {/* A foot across the whole row, as a card's: the price on the left and the one
                  action on the right (the title, the whole row, opens the details). Under the
                  thumb too, so a phone's panel still has room for "from ₱2,500 / night". */}
              <div className="col-span-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-line pt-2.5">
                <span className="text-sm text-pretty text-muted">
                  {offer.price ? <Price {...offer.price} prefix="from" /> : offer.unpriced && TO_BE_AGREED}
                </span>
                <div className="relative z-10 ml-auto flex">{offer.action}</div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Dialog>
  );
}

// A vehicle shop's panel (RAA-191, the plan's mock 2): its photos and name over its models, each
// with a counter, the seats they make for the trip's people, the total and one Add for them all.
// A model's title opens its details in the same panel.
function ShopPanel({
  name,
  businessId,
  heading,
  photos,
  offers,
  dates,
  onOpen,
  onClose,
}: {
  name: string;
  businessId: number;
  heading: string;
  photos: Photo[];
  offers: Offer[];
  dates?: TripDates;
  onOpen: (listingId: number) => void;
  onClose: () => void;
}) {
  const tripDates = dates ?? { guests: 1 };
  const { body, summary, action } = useShopModels({
    business: { id: businessId, name },
    category: { name: offers[0].category },
    dates: tripDates,
    people: tripDates.guests,
    listingIds: offers.map((offer) => offer.listingId),
    onOpen,
  });
  return (
    <Dialog
      open
      placement="side"
      title={name}
      onClose={onClose}
      data-testid="detail-panel"
      media={<ListingPhotos photos={photos} label={name} category={offers[0].category} count="bottom" className="aspect-[16/9]" />}
      // A side panel's foot is its own: the total, then the button, on one row. The foot wraps,
      // so the total takes what's left and wraps its own words, or a longer total ("₱4,800 rent
      // + ₱5,000 refundable deposit") would push the button under it.
      actions={
        <div className="flex w-full items-center justify-between gap-3">
          <div className="min-w-0 flex-1">{summary}</div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      }
    >
      <p className="-mt-2 text-sm text-muted">{heading}</p>
      {body}
    </Dialog>
  );
}

// A listing's first photo, small, or its category icon.
function Thumb({ offer }: { offer: Offer }) {
  const photo = offer.photos[0];
  return (
    <span
      className={cn(
        "relative grid size-16 shrink-0 place-items-center overflow-hidden rounded-control bg-mist text-primary",
      )}
    >
      {photo ? (
        <Image src={photo.src} alt="" fill sizes="64px" unoptimized={isApiPhoto(photo.src)} className="object-cover" />
      ) : (
        <CategoryGlyph name={offer.category} className="size-6" />
      )}
    </span>
  );
}
