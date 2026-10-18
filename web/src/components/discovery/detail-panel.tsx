"use client";

import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { useState, type ComponentProps, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { apiClient } from "@/api/client";
import { isApiPhoto } from "@/components/landing/sample-photos";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/components/ui/cn";
import { Dialog } from "@/components/ui/dialog";
import { Price } from "@/components/ui/typography";
import { InstantBookBadge } from "./instant-book-badge";
import type { Feature } from "./listing-features";
import { StayPrice } from "./stay-price";
import { CategoryGlyph, FeatureGlyph, TagGlyph } from "./tag-glyphs";
import { TourFacts } from "./tour-facts";

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

// A side panel's single photo, above its title.
export function PanelPhoto({ photo }: { photo: Photo }) {
  return (
    <div className="relative aspect-[4/3] overflow-hidden rounded-card bg-mist">
      <Image src={photo.src} alt={photo.alt} fill unoptimized={isApiPhoto(photo.src)} sizes="28rem" className="object-cover" />
    </div>
  );
}

// A place to see, whole, under its photo and name: every tag and the full description.
export function LandmarkPanel({
  landmark,
  areaName,
}: {
  landmark: { description: string; tags: { slug: string; name: string }[] };
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
    </>
  );
}

// A thing to book, whole, under its photos and title. What the area page already has shows at once; the description, a
// tour's facts and a stay's price and fees come from the listing's own endpoint, fetched when
// the panel opens and kept, so opening it again is instant.
export function ListingPanel({
  listingId,
  href,
  category,
  by,
  summary,
  features,
  instantBook = false,
}: {
  listingId: number;
  href: string;
  category: string;
  by: string;
  summary?: string | null;
  features: Feature[];
  instantBook?: boolean;
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
  const cancellation = features.find((feature) => feature.trust);

  return (
    <>
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
        <Badge tone="mist" className="min-h-6 px-2.5 text-xs">
          <CategoryGlyph name={category} className="size-3.5" />
          {category}
        </Badge>
        {instantBook && <InstantBookBadge small />}
        {[listing?.area.name, by].filter(Boolean).join(" · ")}
      </p>
      {summary && <p className="text-sm break-words">{summary}</p>}
      {features.length > 0 && (
        <PanelSection title="Includes">
          <ul className="flex flex-wrap gap-1.5">
            {features.map((feature) => (
              <li key={feature.label}>
                <Badge tone={feature.trust ? "emerald" : "mist"} className="min-h-7 px-2.5 text-xs">
                  <FeatureGlyph name={feature.icon} className="size-3.5" />
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
      {listing?.tour && <TourFacts listing={listing} tour={listing.tour} />}
      {listing?.stay_rate && <StayPrice listing={listing} rate={listing.stay_rate} datesSet={false} />}
      {listing?.description.trim() && (
        <PanelSection title="About this">
          <p className="text-sm break-words whitespace-pre-line">{listing.description}</p>
        </PanelSection>
      )}
      {cancellation && (
        <PanelSection title="Cancellation">
          <p className="text-sm">{cancellation.label}.</p>
        </PanelSection>
      )}
      <Link href={href} data-testid="listing-link" className="w-fit text-sm font-semibold text-link underline-offset-4 hover:underline">
        View full listing <span aria-hidden>→</span>
      </Link>
    </>
  );
}

// The panel's foot: the price, or nothing promised, and the action.
export function PanelActions({ price, action }: { price?: ComponentProps<typeof Price>; action?: ReactNode }) {
  if (!price && !action) return null;
  return (
    <>
      {price ? <Price {...price} /> : <span />}
      {action}
    </>
  );
}
