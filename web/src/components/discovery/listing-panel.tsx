"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import type { ReactNode } from "react";
import { tripDatesQuery, type TripDates } from "@/components/trips/trip-dates";
import { useTripHref } from "@/components/trips/trip-link";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/components/ui/cn";
import { InstantBookBadge } from "./instant-book-badge";
import type { Feature } from "./listing-features";
import { listingQuery } from "./listing-query";
import { StayPrice } from "./stay-price";
import { CategoryGlyph, FeatureGlyph } from "./tag-glyphs";
import { TourFacts } from "./tour-facts";
import { VehicleBookingCard } from "./vehicle-booking-card";
import { VehiclePrice } from "./vehicle-price";

function PanelSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

// A booked or saved item's listing in the cart's item panel (CartItemPanel), under its booking.
// Browse pages open the listing's own page instead (2026-11-10).
// What the cart already has shows at once; the description, a
// tour's facts, a stay's or a vehicle's price and fees come from the listing's own endpoint, fetched when
// the panel opens and kept, so opening it again is instant. With the page's trip dates a stay's
// total comes from /quotes, as on the listing page.
export function ListingPanel({
  listingId,
  href,
  category,
  by,
  summary,
  features,
  instantBook = false,
  dates,
}: {
  listingId: number;
  href: string;
  category: string;
  by: string;
  summary?: string | null;
  features: Feature[];
  instantBook?: boolean;
  dates?: TripDates;
}) {
  const fullHref = useTripHref()(href);
  const { data: listing, isPending, isError } = useQuery(listingQuery(listingId));
  // The full description only when it says more than the summary above it.
  const description = listing?.description.trim();

  return (
    <>
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
        <Badge tone="kind" className="min-h-6 px-2.5 text-xs">
          <CategoryGlyph name={category} className="size-3.5" />
          {category}
        </Badge>
        {instantBook && <InstantBookBadge small />}
        {by}
      </p>
      {summary && <p className="text-sm break-words">{summary}</p>}
      {features.length > 0 && (
        <PanelSection title="Details">
          <ul className="flex flex-wrap gap-1.5">
            {features.map((feature) => (
              <li key={feature.label}>
                <Badge tone={feature.trust ? "emerald" : "fact"} className="min-h-7 px-2.5 text-xs">
                  <FeatureGlyph name={feature.icon} className={cn("size-3.5", !feature.trust && "text-primary")} />
                  {feature.label}
                </Badge>
              </li>
            ))}
          </ul>
        </PanelSection>
      )}
      {isPending && (
        <div role="status" aria-busy className="flex flex-col gap-2">
          <span className="sr-only">Loading the rest of this listing…</span>
          <div className="h-24 rounded-control bg-mist motion-safe:animate-pulse" />
          <div className="h-16 rounded-control bg-mist motion-safe:animate-pulse" />
        </div>
      )}
      {isError && (
        <p className="text-sm text-muted">
          Couldn&apos;t load the rest.{" "}
          <Link href={fullHref} className="font-semibold text-link underline">
            View full listing
          </Link>
        </p>
      )}
      {listing?.tour && <TourFacts listing={listing} tour={listing.tour} head={false} />}
      {listing?.stay_rate && (
        <StayPrice
          key={dates ? tripDatesQuery(dates) : ""}
          listing={listing}
          rate={listing.stay_rate}
          dates={dates ?? { guests: 1 }}
          headline={false}
        />
      )}
      {listing?.vehicle_rate && (typeof listing.details.seats === "number" || listing.group === "gear") && (
        // Its people and vehicles, or gear's count, and what they cost; the panel's foot adds it (RAA-191).
        <VehicleBookingCard
          listing={listing}
          rate={listing.vehicle_rate}
          dates={dates ?? { guests: 1 }}
          seats={typeof listing.details.seats === "number" ? listing.details.seats : null}
          add={false}
        />
      )}
      {listing?.vehicle_rate && <VehiclePrice listing={listing} rate={listing.vehicle_rate} />}
      {description && description !== summary?.trim() && (
        <PanelSection title="About this">
          <p className="text-sm break-words whitespace-pre-line">{description}</p>
        </PanelSection>
      )}
      <Link href={fullHref} data-testid="listing-link" className="w-fit text-sm font-semibold text-link underline-offset-4 hover:underline">
        View full listing <span aria-hidden>→</span>
      </Link>
    </>
  );
}
