"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ListingPhotos, orderedPhotos } from "./listing-photos";
import { uploadedPhotos } from "./use-listing-photos";
import { usePartnerListing, useUpdateListing, type ListingBody, type PartnerListing } from "./use-partner-listings";
import { WizardActions } from "./wizard-steps";

// The add-listing wizards' last step (RAA-109): photos go to a listing that exists, so the
// step before saves the draft and this one adds them to it. Earlier steps are closed by
// then; the listing is changed on its edit page. A new order is saved with the body the
// wizard sent, the photos' ids added.
export function NewListingPhotos({ listing, body }: { listing: PartnerListing; body: ListingBody }) {
  const router = useRouter();
  const live = usePartnerListing(listing.id);
  const update = useUpdateListing(listing.id);
  const [order, setOrder] = useState<number[]>();
  const [busy, setBusy] = useState(false);
  const photos = live.data?.photos ?? listing.photos;

  function finish() {
    const done = () => router.push("/partner/listings");
    if (!order) return done();
    update.mutate({ ...body, photos: orderedPhotos(photos, order).map((photo) => photo.id) }, { onSuccess: done });
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <div data-testid="listing-step-photos" className="flex flex-col gap-4">
        <h2 className="mb-2 font-display text-2xl font-extrabold tracking-tight">Photos</h2>
        <p className="text-sm text-muted">
          <span className="font-medium text-foreground">{listing.title}</span> is saved as a draft. Add its photos now, or
          later from the listing.
        </p>
        {update.error && (
          <p role="alert" className="text-sm text-danger">
            {update.error.message}
          </p>
        )}
        <ListingPhotos listingId={listing.id} photos={photos} limit={listing.photo_limit} order={order} onOrderChange={setOrder} onBusyChange={setBusy} />
      </div>
      <WizardActions
        next={
          uploadedPhotos(photos).length === 0 && !busy ? (
            <Button type="button" variant="soft" onClick={finish} data-testid="listing-skip-photos">
              Skip for now
            </Button>
          ) : (
            <Button type="button" onClick={finish} disabled={busy || update.isPending} data-testid="listing-photos-done">
              {busy ? "Uploading…" : update.isPending ? "Saving…" : "Done"}
            </Button>
          )
        }
      />
    </div>
  );
}
