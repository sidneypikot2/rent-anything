"use client";

import { useRouter } from "next/navigation";
import type { MouseEvent } from "react";
import Link from "next/link";
import { newTabProps, useOpensInNewTab } from "@/components/discovery/business-row";
import { ListingPhotos } from "@/components/discovery/listing-photos";
import { BoltGlyph, CloseGlyph, HeartGlyph } from "@/components/discovery/tag-glyphs";
import { InTripCount } from "@/components/trips/in-trip-badge";
import { cn } from "@/components/ui/cn";
import { formatPeso } from "@/lib/money";
import { priceUnitText, TO_BE_AGREED } from "@/lib/pricing";
import { openOverPlan } from "./over-plan";
import { distanceText, type PlanBusiness, type PlanLandmark } from "./plan-data";

export type CardContext = {
  landmarks: Map<string, PlanLandmark>;
  hearted: Set<string>;
  stay: { point: { lat: number; lng: number } } | null;
  // The trip's dates and people, said on every card ("Nov 16 – 21").
  when: string;
};

// The hearted places a business's tours go to ("Virgin Island, Kota Beach").
export function heartedStops(business: PlanBusiness, { landmarks, hearted }: Pick<CardContext, "landmarks" | "hearted">) {
  return business.goesTo
    .filter((slug) => hearted.has(slug))
    .map((slug) => landmarks.get(slug)?.name)
    .filter((name): name is string => Boolean(name));
}

// A business offering a step, laid out as Airbnb lays out a search result (2026-11-03): photos
// from each of its options to swipe, with a pill over their top left (the hearted places its
// tours go to, else Instant book), then its name (with how far from the stay on the right), what
// it offers here ("Honda Click 125 + 2 more"), what and where the first is, the trip's dates and
// its lowest price underlined. The whole card opens the business's page (`href`, its options in
// this step): in a new tab on a laptop, so the plan stays as it was; on a phone in this tab,
// over the plan, in the plan's own URL (`?business=`, openOverPlan), so a reload keeps it open.
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
  const price = business.price_from_cents ? formatPeso(business.price_from_cents) : null;
  const far = distanceText(context.stay?.point, business.location);
  const stops = heartedStops(business, context);
  const more = business.listings_count - 1;
  const open = () => {
    onLeave?.();
    if (newTab) window.open(href, "_blank");
    else openOverPlan(router, href);
  };
  const openFromPhoto = (event: MouseEvent) => {
    if ((event.target as HTMLElement).closest("button")) return;
    open();
  };
  return (
    <article
      onPointerEnter={() => onHover?.(business.id)}
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
          photos={business.photos.map((photo) => ({ src: photo.card_url, alt: business.name }))}
          label={business.name}
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
        {(stops.length > 0 || business.instant_book) && (
          <span className="pointer-events-none absolute top-3 left-3 flex max-w-[calc(100%-1.5rem)] items-center gap-1 rounded-full bg-surface/95 px-2.5 py-1 text-small font-bold text-navy shadow-soft">
            {stops.length > 0 ? (
              <>
                <HeartGlyph filled className="size-3.5 shrink-0 text-forest" />
                <span className="truncate">Goes to {stops.join(", ")}</span>
              </>
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
              // A plain tap on a phone opens it over the plan; a new tab or a modified click keeps the link.
              if (newTab || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return onLeave?.();
              event.preventDefault();
              open();
            }}
            data-testid="plan-option"
            className="min-w-0 truncate text-left font-bold text-navy outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:rounded-control focus-visible:after:outline-2 focus-visible:after:outline-(--focus)"
          >
            {business.name}
          </Link>
          {far && <span className="shrink-0 text-navy tabular-nums">{far} away</span>}
        </div>
        <span className="truncate text-muted">
          {business.title}
          {more > 0 && ` + ${more} more`}
        </span>
        <span className="truncate text-muted">
          {business.category} in {business.area_name}
        </span>
        {context.when && <span className="truncate text-muted">{context.when}</span>}
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
