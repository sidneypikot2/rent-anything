"use client";

import { skipToken, useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type ComponentProps, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { apiClient } from "@/api/client";
import { isApiPhoto } from "@/components/landing/sample-photos";
import { tripDatesQuery, type TripDates } from "@/components/trips/trip-dates";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/components/ui/cn";
import { Dialog } from "@/components/ui/dialog";
import { Price } from "@/components/ui/typography";
import { formatPeso } from "@/lib/money";
import { InstantBookBadge } from "./instant-book-badge";
import type { Feature } from "./listing-features";
import { StayPrice } from "./stay-price";
import { shownQuoteKey } from "./stay-quote";
import { SamplePhotoTag } from "./photo-card";
import { CategoryGlyph, ChevronGlyph, FeatureGlyph, PlaceGlyph, TagGlyph } from "./tag-glyphs";
import { TourFacts } from "./tour-facts";
import { VehicleBookingCard } from "./vehicle-booking-card";
import { VehiclePrice } from "./vehicle-price";

type Photo = { src: string; alt: string };

// A card's title as a button that opens its details in a side panel (RAA-126). Its ::after
// covers the card, so a click anywhere on it opens the panel; controls of the card's own that
// should still work (photo arrows, Add to trip) sit above it with `relative z-10`. The panel is
// put on the body, clear of the card's clipping, glass colours and hover styles, and only while
// open; React context (TripAddProvider) still reaches it.
export function DetailPanelButton({
  title,
  media,
  panel,
  actions,
  children,
  className,
  "data-testid": testId,
}: {
  title: string;
  media?: ReactNode;
  panel: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  "data-testid"?: string;
}) {
  const [open, setOpen] = useState(false);
  // A link inside it to a row on the page (#listing-<id>: a place's "Go there with") closes it, so
  // the row it scrolls to is in view.
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("hashchange", close);
    return () => window.removeEventListener("hashchange", close);
  }, [open]);
  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        data-testid={testId}
        onClick={() => setOpen(true)}
        className={cn(
          "cursor-pointer text-left outline-none after:absolute after:inset-0 after:rounded-card after:content-[''] focus-visible:after:outline-2 focus-visible:after:-outline-offset-4 focus-visible:after:outline-(--focus)",
          className,
        )}
      >
        {children}
      </button>
      {open &&
        createPortal(
          <Dialog open placement="side" title={title} media={media} onClose={() => setOpen(false)} actions={actions} data-testid="detail-panel">
            {panel}
          </Dialog>,
          document.body,
        )}
    </>
  );
}

function PanelSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

// A side panel's single photo, above its title, saying so when it is a stand-in. A place with
// no photo that fits it gets its icon on navy, as its card does; a listing with none of its own,
// its category's (`icon`).
export function PanelPhoto({ photo, icon }: { photo: Photo | null; icon?: ReactNode }) {
  return (
    <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-card bg-navy text-sky-mist/50">
      {photo ? (
        <>
          <Image src={photo.src} alt={photo.alt} fill unoptimized={isApiPhoto(photo.src)} sizes="28rem" className="object-cover" />
          {!isApiPhoto(photo.src) && <SamplePhotoTag className="absolute left-3 top-3" />}
        </>
      ) : (
        (icon ?? <PlaceGlyph className="size-12" />)
      )}
    </div>
  );
}

// A place to see, whole, under its photo and name: every tag, the full description and the
// listings on the page that go there, each a link down to its row in What to book, which closes
// the panel (DetailPanelButton) and shows the row whatever section is picked.
export function LandmarkPanel({
  landmark,
  areaName,
}: {
  landmark: { description: string; tags: { slug: string; name: string }[]; visits?: { id: number; title: string; href: string }[] };
  areaName: string;
}) {
  return (
    <>
      <p className="text-sm text-muted">Place to see · {areaName}</p>
      {landmark.tags.length > 0 && (
        <ul aria-label="Tags" className="flex flex-wrap gap-1.5">
          {landmark.tags.map((tag) => (
            <li key={tag.slug}>
              <Badge tone="mist" className="min-h-7 px-2.5 text-xs">
                <TagGlyph slug={tag.slug} className="size-3.5" />
                {tag.name}
              </Badge>
            </li>
          ))}
        </ul>
      )}
      {landmark.description.trim() && (
        <PanelSection title="About">
          <p className="text-sm break-words whitespace-pre-line">{landmark.description}</p>
        </PanelSection>
      )}
      {landmark.visits && landmark.visits.length > 0 && (
        <PanelSection title="Go there with">
          <ul className="flex flex-col gap-2">
            {landmark.visits.map((visit) => (
              <li key={visit.id}>
                <a
                  href={`#listing-${visit.id}`}
                  onClick={(event) => {
                    // The same row again: no hashchange would fire, so send one.
                    if (window.location.hash !== `#listing-${visit.id}`) return;
                    event.preventDefault();
                    window.dispatchEvent(new HashChangeEvent("hashchange"));
                  }}
                  className="flex min-h-11 items-center text-sm font-semibold text-link underline-offset-4 hover:underline"
                >
                  {visit.title}
                  <ChevronGlyph aria-hidden className="ml-1 size-4" />
                </a>
              </li>
            ))}
          </ul>
        </PanelSection>
      )}
    </>
  );
}

// A thing to book, whole, under its photos and title. What the area page already has shows at once; the description, a
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
  unpriced,
}: {
  listingId: number;
  href: string;
  category: string;
  by: string;
  summary?: string | null;
  features: Feature[];
  instantBook?: boolean;
  dates?: TripDates;
  // Set while it has no price: the panel says what adding and booking it mean.
  unpriced?: string;
}) {
  const { data: listing, isPending, isError } = useQuery({
    queryKey: ["listing", listingId],
    queryFn: async () => {
      const { data, error } = await apiClient().GET("/api/v1/listings/{id}", { params: { path: { id: listingId } } });
      if (error || !data) throw new Error("Couldn't load this listing");
      return data;
    },
    staleTime: 5 * 60_000,
  });
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
          <Link href={href} className="font-semibold text-link underline">
            View full listing
          </Link>
        </p>
      )}
      {unpriced && (
        <PanelSection title="Price">
          <p className="text-sm text-pretty">
            The partner hasn&apos;t listed a price yet. Saving it to your trip is free, and when you book it, the price
            is agreed with them.
          </p>
        </PanelSection>
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
      {listing?.vehicle_rate && typeof listing.details.seats === "number" && (
        // Its people and vehicles and what they cost; the panel's foot adds it (RAA-191).
        <VehicleBookingCard listing={listing} rate={listing.vehicle_rate} dates={dates ?? { guests: 1 }} seats={listing.details.seats} add={false} />
      )}
      {listing?.vehicle_rate && <VehiclePrice listing={listing} rate={listing.vehicle_rate} />}
      {description && description !== summary?.trim() && (
        <PanelSection title="About this">
          <p className="text-sm break-words whitespace-pre-line">{description}</p>
        </PanelSection>
      )}
      <Link href={href} data-testid="listing-link" className="w-fit text-sm font-semibold text-link underline-offset-4 hover:underline">
        View full listing <span aria-hidden>→</span>
      </Link>
    </>
  );
}

// The panel's foot: the price, or how an unpriced listing is priced, and the action. With the
// page's dates a stay shows its total for them, the same figure as the body's last line, rather
// than a "from" price beside it.
export function PanelActions({
  price,
  unpriced,
  action,
  listingId,
  dates,
}: {
  price?: ComponentProps<typeof Price>;
  unpriced?: string;
  action?: ReactNode;
  listingId?: number;
  dates?: TripDates;
}) {
  const { data: quote } = useQuery<{ quote: { total_cents: number; nights_count: number } } | { errors: string[] }>({
    queryKey: shownQuoteKey(listingId ?? 0, dates),
    queryFn: skipToken,
    enabled: false,
  });
  if (!price && !action) return null;
  const total = quote && "quote" in quote ? quote.quote : null;
  return (
    <>
      {total ? (
        <Price amount={formatPeso(total.total_cents)} unit={`for ${total.nights_count} ${total.nights_count === 1 ? "night" : "nights"}`} />
      ) : price ? (
        <Price {...price} />
      ) : unpriced ? (
        <span className="text-sm text-muted">{unpriced}</span>
      ) : (
        <span />
      )}
      {action}
    </>
  );
}
