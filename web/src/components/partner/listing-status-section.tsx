"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { BLOCKER_LABELS, STATUS } from "./listing-status";
import { useChangeListingStatus, type PartnerListing } from "./use-partner-listings";

type Move = "active" | "paused" | "delisted";

// What each move's confirmation says, and its button.
type Confirmation = { title: string; body: string; action: string; pending: string; variant: "primary" | "danger" };

function confirmation(move: Move, listing: PartnerListing): Confirmation {
  const resuming = listing.status === "paused";
  const confirmations: Record<Move, Confirmation> = {
    active: {
      title: resuming ? `Resume “${listing.title}”?` : `Make “${listing.title}” live?`,
      body: "Guests can find and book it straight away.",
      action: resuming ? "Resume" : "Go live",
      pending: resuming ? "Resuming…" : "Going live…",
      variant: "primary",
    },
    paused: {
      title: `Pause “${listing.title}”?`,
      body: "Guests won't see it or be able to book it until you resume it. Bookings already made stay as they are.",
      action: "Pause",
      pending: "Pausing…",
      variant: "primary",
    },
    delisted: {
      title: `Delist “${listing.title}”?`,
      body: "Guests won't find it or be able to book it. It stays here with its details and photos, and you can make it live again.",
      action: "Delist",
      pending: "Delisting…",
      variant: "danger",
    },
  };
  return confirmations[move];
}

// A listing's status (RAA-115), with what it still needs before it can go live. On the
// listing page it is only shown; on the edit page (`editable`) Change status opens the moves
// it offers, kept out of sight until then so a tap can't change it by accident, and each move
// is confirmed in a dialog first: a draft or delisted listing goes live, a live one pauses or
// delists, a paused one resumes or delists. Going live or resuming is greyed out while the
// listing lacks something it needs. It reads the saved listing, so on the edit page unsaved
// changes don't count yet. The add-listing wizards end with their own Listing status step
// (NewListingPhotos).
export function ListingStatusSection({ listing, editable = false }: { listing: PartnerListing; editable?: boolean }) {
  const change = useChangeListingStatus(listing.id);
  const [changing, setChanging] = useState(false);
  const [confirming, setConfirming] = useState<Move>();
  const status = STATUS[listing.status];
  const blocked = listing.live_blockers.length > 0;
  const live = listing.status === "active";
  const confirm = confirming && confirmation(confirming, listing);

  function close() {
    change.reset();
    setChanging(false);
  }

  function ask(move: Move) {
    change.reset();
    setConfirming(move);
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
          variant="soft"
          className="self-start"
          onClick={() => setChanging(true)}
          data-testid="listing-change-status"
        >
          Change status
        </Button>
      )}

      {changing && change.error && !confirming && (
        <p role="alert" className="text-sm text-danger">
          {change.error.message}
        </p>
      )}

      {changing && (
        <div className="flex flex-wrap gap-2">
          {!live && (
            <Button type="button" size="pill" disabled={blocked || change.isPending} onClick={() => ask("active")} data-testid="listing-go-live">
              {listing.status === "paused" ? "Resume" : "Go live"}
            </Button>
          )}
          {live && (
            <Button type="button" size="pill" variant="soft" disabled={change.isPending} onClick={() => ask("paused")} data-testid="listing-pause">
              Pause
            </Button>
          )}
          {(live || listing.status === "paused") && (
            <Button type="button" size="pill" variant="soft" disabled={change.isPending} onClick={() => ask("delisted")} data-testid="listing-delist">
              Delist
            </Button>
          )}
          <Button type="button" size="pill" variant="ghost" disabled={change.isPending} onClick={close} data-testid="listing-status-cancel">
            Cancel
          </Button>
        </div>
      )}

      <Dialog
        open={!!confirm}
        onClose={() => setConfirming(undefined)}
        title={confirm?.title ?? ""}
        data-testid="listing-status-confirm"
        actions={
          <>
            <Button type="button" variant="soft" size="pill" onClick={() => setConfirming(undefined)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant={confirm?.variant}
              size="pill"
              disabled={change.isPending}
              data-testid="listing-status-confirm-button"
              onClick={() =>
                confirming &&
                change.mutate(confirming, {
                  onSuccess: () => {
                    setConfirming(undefined);
                    close();
                  },
                })
              }
            >
              {change.isPending ? confirm?.pending : confirm?.action}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted">{confirm?.body}</p>
          {change.error && (
            <p role="alert" className="text-sm text-danger">
              {change.error.message}
            </p>
          )}
        </div>
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
