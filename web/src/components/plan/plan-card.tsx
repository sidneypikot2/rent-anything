"use client";

import { useRouter } from "next/navigation";
import type { MouseEvent } from "react";
import Link from "next/link";
import { newTabProps, useOpensInNewTab } from "@/components/discovery/business-row";
import { ListingPhotos } from "@/components/discovery/listing-photos";
import { TourStops } from "@/components/discovery/landmark-tours";
import { BoltGlyph, CloseGlyph, PlaceGlyph } from "@/components/discovery/tag-glyphs";
import { InTripCount } from "@/components/trips/in-trip-badge";
import { cn } from "@/components/ui/cn";
import { formatPeso } from "@/lib/money";
import { priceUnitText, TO_BE_AGREED } from "@/lib/pricing";
import { openOverPlan } from "./over-plan";
import { distanceText, nearText, type PlanBusiness, type PlanLandmark } from "./plan-data";

export type CardContext = {
  landmarks: Map<string, PlanLandmark>;
  hearted: Set<string>;
  stay: { point: { lat: number; lng: number } } | null;
  // The trip's dates and people, said on every card ("Nov 16 – 21").
  when: string;
  // The stay closest to the picks, when it is close to all of them, and what its pill says.
  best?: { id: number; label: string } | null;
};

const NEAR_ROWS = 3;
const STOP_CHIPS = 3;

// A business offering a step, laid out as Airbnb lays out a search result (2026-11-03): photos
// from each of its options to swipe, with a pill over their top left (Instant book), then its name
// (with how far from the stay on the right), what it offers here ("Honda Click 125 + 2 more"), what
// and where the first is, the trip's dates, the places its tours go to and its lowest price
// underlined. The whole card opens `href` — a stay's business's page (its options in this step),
// a title card's listing page: in a new tab on a laptop, so the plan stays as it was; on a phone
// in this tab — a business over the plan, in the plan's own URL (`?business=`, openOverPlan), so a
// reload keeps it open; a listing as its own page, whose way back returns to the plan.
export function PlanCard({
  business,
  href,
  context,
  onHover,
  active = false,
  onClose,
  onLeave,
  className,
}: {
  business: PlanBusiness;
  href: string;
  context: CardContext;
  // The map's pin lights up with the card under the pointer.
  onHover?: (id: number | null) => void;
  active?: boolean;
  // Shown over a map for a tapped pin (Airbnb's): white, a wider photo, and a close button.
  onClose?: () => void;
  // Called as it opens the business's page (the phone's map view closes, as the page over the
  // plan can't sit under it).
  onLeave?: () => void;
  className?: string;
}) {
  const router = useRouter();
  const newTab = useOpensInNewTab();
  const overMap = Boolean(onClose);
  // A stay's business opens over the plan on a phone; a title card's listing page opens in this tab.
  const overPlan = href.startsWith("/businesses/");
  const price = business.price_from_cents ? formatPeso(business.price_from_cents) : null;
  const far = distanceText(context.stay?.point, business.location);
  const stops = business.goesTo.flatMap((slug) => {
    const landmark = context.landmarks.get(slug);
    return landmark ? [{ slug, name: landmark.name }] : [];
  });
  const more = business.listings_count - 1;
  const best = context.best?.id === business.pin ? context.best.label : null;
  // How far a stay is from each pick, as the API says it.
  const near = business.near.flatMap(({ slug, km }) => {
    const landmark = context.landmarks.get(slug);
    return landmark ? [nearText(km, landmark)] : [];
  });
  const open = () => {
    onLeave?.();
    if (newTab) window.open(href, "_blank");
    else if (overPlan) openOverPlan(router, href);
    else router.push(href);
  };
  const openFromPhoto = (event: MouseEvent) => {
    if ((event.target as HTMLElement).closest("button")) return;
    open();
  };
  return (
    <article
      onPointerEnter={() => onHover?.(business.pin)}
      onPointerLeave={() => onHover?.(null)}
      className={cn(
        "group/card flex min-w-0 flex-col",
        overMap ? "card-edge animate-drop-in overflow-hidden rounded-card bg-surface shadow-float" : "gap-2.5",
        className,
      )}
      data-active={active || undefined}
      data-testid="plan-card"
    >
      <div onClick={openFromPhoto} className="relative cursor-pointer">
        <ListingPhotos
          photos={business.photos.map((photo) => ({ src: photo.card_url, alt: business.titled ? business.title : business.name }))}
          label={business.titled ? business.title : business.name}
          category={business.category}
          count="bottom"
          className={cn(
            "transition-shadow duration-300 ease-calm",
            overMap ? "aspect-[16/9] rounded-none!" : "aspect-[20/19]",
            active && !overMap && "ring-2 ring-navy ring-offset-2",
          )}
        />
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="tap-target absolute top-3 right-3 z-10 flex size-9 items-center justify-center rounded-full bg-surface/95 text-navy shadow-soft hover:bg-surface"
            data-testid="plan-picked-close"
          >
            <CloseGlyph className="size-4" />
          </button>
        )}
        {(best || business.instant_book) && (
          <span className="pointer-events-none absolute top-3 left-3 flex max-w-[calc(100%-1.5rem)] items-center gap-1 rounded-full bg-surface/95 px-2.5 py-1 text-small font-bold text-navy shadow-soft">
            {best ? (
              <span className="truncate text-forest" data-testid="plan-near-best">
                {best}
              </span>
            ) : (
              <>
                <BoltGlyph className="size-3.5 shrink-0 text-primary" />
                Instant book
              </>
            )}
          </span>
        )}
      </div>
      <div className={cn("relative flex flex-col text-sm", overMap && "px-4 pt-3 pb-4")}>
        <div className="flex items-baseline justify-between gap-2">
          <Link
            href={href}
            {...newTabProps(newTab)}
            onClick={(event) => {
              // A plain tap on a phone opens a business over the plan; a listing, a new tab or a
              // modified click keeps the link.
              if (newTab || !overPlan || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return onLeave?.();
              event.preventDefault();
              open();
            }}
            data-testid="plan-option"
            className="min-w-0 truncate text-left font-bold text-navy outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:rounded-control focus-visible:after:outline-2 focus-visible:after:outline-(--focus)"
          >
            {business.titled ? business.title : business.name}
          </Link>
          {far && <span className="shrink-0 text-navy tabular-nums">{far} away</span>}
        </div>
        {/* A title card names its business; a stay's card what it offers. */}
        <span className="truncate text-muted">
          {business.titled ? `by ${business.name}` : business.title}
          {more > 0 && (business.titled ? ` · ${more + 1} options` : ` + ${more} more`)}
        </span>
        <span className="truncate text-muted">
          {business.category} in {business.area_name}
        </span>
        {context.when && <span className="truncate text-muted">{context.when}</span>}
        {near.length > 0 && (
          <ul className="mt-1.5 flex flex-col gap-1 rounded-control bg-surface-2 px-3 py-2 text-small text-navy" data-testid="plan-near">
            {near.slice(0, NEAR_ROWS).map((line) => (
              <li key={line} className="flex items-center gap-1.5">
                <PlaceGlyph className="size-3.5 shrink-0 text-forest" />
                <span className="min-w-0 truncate">{line}</span>
              </li>
            ))}
            {near.length > NEAR_ROWS && <li className="pl-5 text-muted">+{near.length - NEAR_ROWS} more</li>}
          </ul>
        )}
        {stops.length > 0 && (
          <div className="mt-1.5">
            <TourStops
              stops={stops}
              picked={context.hearted}
              max={STOP_CHIPS}
              label={more > 0 ? `Tours go to ${stops.length} ${stops.length === 1 ? "place" : "places"}` : undefined}
            />
          </div>
        )}
        <span className="mt-1 text-navy">
          {price ? (
            <>
              {more > 0 && <span className="text-muted">from </span>}
              <span className="font-bold underline underline-offset-2 tabular-nums">{price}</span>{" "}
              <span className="text-muted">{priceUnitText(business.price_unit)}</span>
            </>
          ) : (
            <span className="text-muted">{TO_BE_AGREED}</span>
          )}
        </span>
        {/* What this trip holds of it; never another trip's (the user, 2026-11-03). */}
        <span className="relative z-10 mt-1.5 empty:hidden">
          <InTripCount listingIds={business.listing_ids} otherTrips={false} />
        </span>
      </div>
    </article>
  );
}
