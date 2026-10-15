"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ListingPhotos, orderedPhotos } from "./listing-photos";
import { BLOCKER_LABELS } from "./listing-status";
import {
  useChangeListingStatus,
  usePartnerListing,
  useUpdateListing,
  type ListingBody,
  type PartnerListing,
} from "./use-partner-listings";
import { WizardActions, WizardTitle } from "./wizard-steps";

// The add-listing wizards' last step (RAA-109): photos go to a listing that exists, so the
// step before saves the draft and this one adds them to it. Earlier steps are closed by
// then; the listing is changed on its edit page. A new order is saved with the body the
// wizard sent, the photos' ids added. It ends with Save as draft or Go live (RAA-115), which
// is greyed out, saying why, while the listing lacks what going live needs (a ready photo
// among them, so it opens up once one is uploaded and sized). Either opens the new listing.
export function NewListingPhotos({ listing, body }: { listing: PartnerListing; body: ListingBody }) {
  const router = useRouter();
  const live = usePartnerListing(listing.id);
  const update = useUpdateListing(listing.id);
  const changeStatus = useChangeListingStatus(listing.id);
  const [order, setOrder] = useState<number[]>();
  const [busy, setBusy] = useState(false);
  const current = live.data ?? listing;
  const photos = current.photos;
  const blockers = current.live_blockers;
  const saving = update.isPending || changeStatus.isPending;
  const error = update.error ?? changeStatus.error;

  function finish(goLive: boolean) {
    const done = () => router.push(`/partner/listings/${listing.id}`);
    const next = goLive ? () => changeStatus.mutate("active", { onSuccess: done }) : done;
    if (!order) return next();
    update.mutate({ ...body, photos: orderedPhotos(photos, order).map((photo) => photo.id) }, { onSuccess: next });
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <div data-testid="listing-step-photos" className="flex flex-col gap-4">
        <WizardTitle as="h2">Photos</WizardTitle>
        <p className="text-sm text-muted">
          <span className="font-medium text-foreground">{listing.title}</span> is saved as a draft: guests can&apos;t see it
          yet. Add its photos now, or later from the listing, then save it as a draft or make it live.
        </p>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error.message}
          </p>
        )}
        <ListingPhotos listingId={listing.id} photos={photos} limit={listing.photo_limit} order={order} onOrderChange={setOrder} onBusyChange={setBusy} />
        {blockers.length > 0 && (
          <div data-testid="listing-live-blockers" className="flex flex-col gap-1 text-sm">
            <span className="font-semibold">Before it can go live:</span>
            <ul className="list-disc pl-5 text-muted">
              {blockers.map((blocker) => (
                <li key={blocker}>{BLOCKER_LABELS[blocker]}</li>
              ))}
            </ul>
            {blockers.some((blocker) => blocker !== "photo") && (
              <span className="text-muted">Save it as a draft and add the rest from the listing&apos;s edit page.</span>
            )}
          </div>
        )}
      </div>
      <WizardActions
        next={
          <>
            <Button
              type="button"
              variant="glass"
              size="pill"
              onClick={() => finish(false)}
              disabled={busy || saving}
              data-testid="listing-save-draft"
            >
              Save as draft
            </Button>
            <Button
              type="button"
              variant="glow"
              size="pill"
              onClick={() => finish(true)}
              disabled={busy || saving || blockers.length > 0}
              data-testid="listing-go-live"
            >
              {busy ? "Uploading…" : saving ? "Saving…" : "Go live"}
            </Button>
          </>
        }
      />
    </div>
  );
}
