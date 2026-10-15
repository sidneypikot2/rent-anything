"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { BLOCKER_LABELS, STATUS } from "./listing-status";
import { useChangeListingStatus, type PartnerListing } from "./use-partner-listings";

// A listing's status (RAA-115), with what it still needs before it can go live. On the
// listing page it is only shown; on the edit page (`editable`) Change status opens the moves
// it offers, kept out of sight until then so a tap can't change it by accident: a draft or
// delisted listing goes live, a live one pauses or delists (asking first), a paused one
// resumes or delists. Going live or resuming is greyed out while the listing lacks something
// it needs. It reads the saved listing, so on the edit page unsaved changes don't count yet.
// The add-listing wizards end with their own Listing status step (NewListingPhotos).
export function ListingStatusSection({ listing, editable = false }: { listing: PartnerListing; editable?: boolean }) {
  const change = useChangeListingStatus(listing.id);
  const [changing, setChanging] = useState(false);
  const [delisting, setDelisting] = useState(false);
  const status = STATUS[listing.status];
  const blocked = listing.live_blockers.length > 0;
  const live = listing.status === "active";

  function close() {
    change.reset();
    setChanging(false);
  }

  return (
    <div data-testid="listing-status-section" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge tone={status.tone} data-testid="listing-status-badge">
          {status.label}
        </Badge>
        <span className="text-muted">{status.note}.</span>
      </div>

      {!live && <LiveBlockers blockers={listing.live_blockers} />}

      {editable && !changing && (
        <Button
          type="button"
          size="pill"
          variant="glass"
          className="self-start"
          onClick={() => setChanging(true)}
          data-testid="listing-change-status"
        >
          Change status
        </Button>
      )}

      {changing && change.error && (
        <p role="alert" className="text-sm text-danger">
          {change.error.message}
        </p>
      )}

      {changing && (
        <div className="flex flex-wrap gap-2">
          {!live && (
            <Button
              type="button"
              size="pill"
              disabled={blocked || change.isPending}
              onClick={() => change.mutate("active", { onSuccess: close })}
              data-testid="listing-go-live"
            >
              {listing.status === "paused" ? "Resume" : "Go live"}
            </Button>
          )}
          {live && (
            <Button
              type="button"
              size="pill"
              variant="soft"
              disabled={change.isPending}
              onClick={() => change.mutate("paused", { onSuccess: close })}
              data-testid="listing-pause"
            >
              Pause
            </Button>
          )}
          {(live || listing.status === "paused") && (
            <Button type="button" size="pill" variant="soft" disabled={change.isPending} onClick={() => setDelisting(true)} data-testid="listing-delist">
              Delist
            </Button>
          )}
          <Button type="button" size="pill" variant="glass" disabled={change.isPending} onClick={close} data-testid="listing-status-cancel">
            Cancel
          </Button>
        </div>
      )}

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
              onClick={() =>
                change.mutate("delisted", { onSuccess: close, onSettled: () => setDelisting(false) })
              }
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

// What a listing still needs before it can go live (the API's live_blockers), as a to-do list,
// with an optional line on where to do it. Nothing when it has everything.
export function LiveBlockers({ blockers, hint }: { blockers: PartnerListing["live_blockers"]; hint?: string }) {
  if (blockers.length === 0) return null;
  return (
    <div data-testid="listing-live-blockers" className="flex flex-col gap-1 text-sm">
      <span className="font-semibold">Before it can go live:</span>
      <ul className="list-disc pl-5 text-muted">
        {blockers.map((blocker) => (
          <li key={blocker}>{BLOCKER_LABELS[blocker]}</li>
        ))}
      </ul>
      {hint && <span className="text-muted">{hint}</span>}
    </div>
  );
}
