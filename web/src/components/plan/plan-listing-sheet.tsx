"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { listingQuery, ListingPanel, PanelActions, PanelPhoto } from "@/components/discovery/detail-panel";
import { listingFeatures } from "@/components/discovery/listing-features";
import { CategoryGlyph } from "@/components/discovery/tag-glyphs";
import { AddToTripButton } from "@/components/trips/add-to-trip-button";
import { useRemoveTripItem, type Trip } from "@/components/trips/use-trips";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

// A listing's details over the review (RAA-263), from a click on its row or on a tour in the
// chooser: the area page's side panel. In the trip its foot offers Remove (not once it is booked);
// otherwise Add to trip, the usual add flow, so real dates and availability apply. `onAdded` runs
// when the listing joins the trip while the panel is open.
export function PlanListingSheet({ listingId, trip, onClose, onAdded }: { listingId: number; trip: Trip; onClose: () => void; onAdded: () => void }) {
  const { data: listing } = useQuery(listingQuery(listingId));
  const remove = useRemoveTripItem();
  const item = trip.items.find((each) => each.listing.id === listingId);
  const held = Boolean(item);
  const wasHeld = useRef(held);
  useEffect(() => {
    if (held && !wasHeld.current) onAdded();
    wasHeld.current = held;
  }, [held, onAdded]);

  const title = item?.listing.title ?? listing?.title ?? "Listing";
  const category = item?.listing.category ?? listing?.category.name ?? "";
  const cover = listing?.photos[0]?.card_url ?? item?.listing.cover_photo_url;
  const by = item?.business.name ?? listing?.business.name;
  const dates = { from: trip.starts_on ?? undefined, to: trip.ends_on ?? undefined, guests: trip.guests };
  const action = item ? (
    item.booking ? undefined : (
      <Button type="button" variant="soft" size="touch" loading={remove.isPending} onClick={() => remove.mutate(item.id, { onSuccess: onClose })} data-testid="plan-listing-remove">
        Remove from trip
      </Button>
    )
  ) : listing ? (
    <AddToTripButton listing={listing} dates={dates} />
  ) : undefined;

  return (
    <Dialog
      open
      placement="side"
      title={title}
      onClose={onClose}
      data-testid="detail-panel"
      media={<PanelPhoto photo={cover ? { src: cover, alt: title } : null} icon={<CategoryGlyph name={category} className="size-12" />} />}
      actions={<PanelActions action={action} listingId={listingId} dates={dates} />}
    >
      <ListingPanel
        listingId={listingId}
        href={`/listings/${listingId}`}
        category={category}
        by={by ? `by ${by}` : ""}
        summary={listing?.summary}
        features={listing ? listingFeatures({ details: listing.details, cancellation_policy: item?.cancellation_policy ?? "" }) : []}
        instantBook={listing?.instant_book}
        dates={dates}
      />
    </Dialog>
  );
}
