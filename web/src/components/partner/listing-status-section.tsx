"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { BLOCKER_LABELS, STATUS } from "./listing-status";
import { useChangeListingStatus, type PartnerListing } from "./use-partner-listings";

// A listing's status and the moves it offers (RAA-115): a draft or delisted listing goes
// live, a live one pauses or delists (asking first), a paused one resumes or delists. Going
// live or resuming is greyed out while the listing lacks something it needs, listed below.
// It reads the saved listing, so on the edit page unsaved changes don't count yet. On the
// listing page and the edit page; the add-listing wizards end with their own choice
// (NewListingPhotos).
export function ListingStatusSection({ listing }: { listing: PartnerListing }) {
  const change = useChangeListingStatus(listing.id);
  const [delisting, setDelisting] = useState(false);
  const status = STATUS[listing.status];
  const blocked = listing.live_blockers.length > 0;
  const live = listing.status === "active";

  return (
    <div data-testid="listing-status-section" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge tone={status.tone} data-testid="listing-status-badge">
          {status.label}
        </Badge>
        <span className="text-muted">{status.note}.</span>
      </div>

      {!live && blocked && (
        <div data-testid="listing-live-blockers" className="flex flex-col gap-1 text-sm">
          <span className="font-semibold">Before it can go live:</span>
          <ul className="list-disc pl-5 text-muted">
            {listing.live_blockers.map((blocker) => (
              <li key={blocker}>{BLOCKER_LABELS[blocker]}</li>
            ))}
          </ul>
        </div>
      )}

      {change.error && (
        <p role="alert" className="text-sm text-danger">
          {change.error.message}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {!live && (
          <Button
            type="button"
            size="pill"
            disabled={blocked || change.isPending}
            onClick={() => change.mutate("active")}
            data-testid="listing-go-live"
          >
            {listing.status === "paused" ? "Resume" : "Go live"}
          </Button>
        )}
        {live && (
          <Button type="button" size="pill" variant="soft" disabled={change.isPending} onClick={() => change.mutate("paused")} data-testid="listing-pause">
            Pause
          </Button>
        )}
        {(live || listing.status === "paused") && (
          <Button type="button" size="pill" variant="soft" disabled={change.isPending} onClick={() => setDelisting(true)} data-testid="listing-delist">
            Delist
          </Button>
        )}
      </div>

      <Dialog
        open={delisting}
        onClose={() => setDelisting(false)}
        title={`Delist “${listing.title}”?`}
        data-testid="listing-delist-confirm"
        actions={
          <>
            <Button type="button" variant="soft" size="pill" onClick={() => setDelisting(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              size="pill"
              disabled={change.isPending}
              data-testid="listing-delist-confirm-button"
              onClick={() => change.mutate("delisted", { onSettled: () => setDelisting(false) })}
            >
              {change.isPending ? "Delisting…" : "Delist"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          Guests won&apos;t find it or be able to book it. It stays here with its details and photos, and you can make it
          live again.
        </p>
      </Dialog>
    </div>
  );
}
