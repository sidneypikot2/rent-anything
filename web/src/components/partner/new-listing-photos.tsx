"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowGlyph } from "@/components/discovery/tag-glyphs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ListingPhotos, orderedPhotos } from "./listing-photos";
import { STATUS } from "./listing-status";
import { LiveBlockers } from "./listing-status-section";
import {
  useChangeListingStatus,
  usePartnerListing,
  useUpdateListing,
  type ListingBody,
  type PartnerListing,
} from "./use-partner-listings";
import { WizardActions, WizardLayout, WizardTitle } from "./wizard-steps";

// The add-listing wizards' last two steps, once the step before has saved the draft
// (RAA-109): Photos, which go to a listing that exists, then Listing status (RAA-115).
// Earlier steps are closed by then; the listing is changed on its edit page. Both steps are
// kept here, above the layout, so the photos' new order survives going between them. A new
// order is saved with the body the wizard sent, the photos' ids added. The status step ends
// with Save as draft or Go live, which is greyed out, saying why, while the listing lacks what
// going live needs (a ready photo among them, so it opens up once one is uploaded and sized).
// Either opens the new listing.
export function NewListingPhotos({
  steps,
  listing,
  body,
}: {
  steps: readonly { key: string; label: string }[];
  listing: PartnerListing;
  body: ListingBody;
}) {
  const router = useRouter();
  const live = usePartnerListing(listing.id);
  const update = useUpdateListing(listing.id);
  const changeStatus = useChangeListingStatus(listing.id);
  const photosStep = steps.length - 2;
  const [current, setCurrent] = useState(photosStep);
  const [order, setOrder] = useState<number[]>();
  const [busy, setBusy] = useState(false);
  const saved = live.data ?? listing;
  const photos = saved.photos;
  const blockers = saved.live_blockers;
  const status = STATUS[saved.status];
  const saving = update.isPending || changeStatus.isPending;
  const error = update.error ?? changeStatus.error;

  function finish(goLive: boolean) {
    const done = () => router.push(`/partner/listings/${listing.id}`);
    const next = goLive ? () => changeStatus.mutate("active", { onSuccess: done }) : done;
    if (!order) return next();
    update.mutate({ ...body, photos: orderedPhotos(photos, order).map((photo) => photo.id) }, { onSuccess: next });
  }

  return (
    <WizardLayout steps={[...steps]} current={current} reached={photosStep + 1} onSelect={setCurrent} locked>
      {current === photosStep ? (
        <div className="flex w-full flex-col gap-6">
          <div data-testid="listing-step-photos" className="flex flex-col gap-4">
            <WizardTitle as="h2">Photos</WizardTitle>
            <p className="text-sm text-muted">
              <span className="font-medium text-foreground">{listing.title}</span> is saved. Add its photos now, or later
              from the listing.
            </p>
            <ListingPhotos listingId={listing.id} photos={photos} limit={listing.photo_limit} order={order} onOrderChange={setOrder} onBusyChange={setBusy} />
          </div>
          <WizardActions
            next={
              <Button type="button" variant="glow" size="pill" onClick={() => setCurrent(photosStep + 1)} disabled={busy} data-testid="listing-photos-next">
                {busy ? "Uploading…" : "Next"}
                {!busy && <ArrowGlyph className="size-4" />}
              </Button>
            }
          />
        </div>
      ) : (
        <div className="flex w-full flex-col gap-6">
          <div data-testid="listing-step-status" className="flex flex-col gap-4">
            <WizardTitle as="h2">Listing status</WizardTitle>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge tone={status.tone} data-testid="listing-status-badge">
                {status.label}
              </Badge>
              <span className="text-muted">{status.note}.</span>
            </div>
            <p className="text-sm text-muted">Save it as a draft to finish it later, or make it live for guests to book.</p>
            {error && (
              <p role="alert" className="text-sm text-danger">
                {error.message}
              </p>
            )}
            <LiveBlockers
              blockers={blockers}
              hint={
                blockers.some((blocker) => blocker !== "photo")
                  ? "Save it as a draft and add the rest from the listing's edit page."
                  : undefined
              }
            />
          </div>
          <WizardActions
            onBack={() => setCurrent(photosStep)}
            next={
              <>
                <Button type="button" variant="glass" size="pill" onClick={() => finish(false)} disabled={saving} data-testid="listing-save-draft">
                  Save as draft
                </Button>
                <Button
                  type="button"
                  variant="glow"
                  size="pill"
                  onClick={() => finish(true)}
                  disabled={saving || blockers.length > 0}
                  data-testid="listing-go-live"
                >
                  {saving ? "Saving…" : "Go live"}
                </Button>
              </>
            }
          />
        </div>
      )}
    </WizardLayout>
  );
}
