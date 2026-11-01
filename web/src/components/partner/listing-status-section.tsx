"use client";

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { BLOCKER_LABELS, STATUS } from "./listing-status";
import type { PartnerListing } from "./use-partner-listings";

export type StatusMove = "active" | "paused" | "delisted";

// What a move does, shown once it is picked.
function moveNote(move: StatusMove, listing: PartnerListing) {
  const notes: Record<StatusMove, string> = {
    active: "Guests can find and book it once you save.",
    paused: "Guests won't see it or be able to book it until you resume it. Bookings already made stay as they are.",
    delisted: "Guests won't find it or be able to book it. It stays here with its details and photos, and you can make it live again.",
  };
  return listing.status === "paused" && move === "active" ? "Guests can find and book it again once you save." : notes[move];
}

// A listing's status (RAA-115), with what it still needs before it can go live. On the
// listing page it is only shown. On the edit page (`editable`) the Change status button in the
// section's header opens (`choosing`) a sheet of the moves it offers — a draft or delisted
// listing goes live, a live one pauses or delists, a paused one resumes or delists — and the one
// picked is only held (`staged`) until the form's Save changes, which lists it with the other
// changes and makes it after saving them; Undo drops it. Going live or resuming is greyed out
// while the listing lacks something it needs. It reads the saved listing, so unsaved changes
// don't count yet. The add-listing wizards end with their own Listing status step
// (NewListingPhotos).
export function ListingStatusSection({
  listing,
  editable = false,
  staged,
  onStage,
  choosing = false,
  onChoosingChange,
}: {
  listing: PartnerListing;
  editable?: boolean;
  staged?: StatusMove;
  onStage?: (move: StatusMove | undefined) => void;
  choosing?: boolean;
  onChoosingChange?: (choosing: boolean) => void;
}) {
  const status = STATUS[listing.status];
  const next = staged && STATUS[staged];
  const blocked = listing.live_blockers.length > 0;
  const live = listing.status === "active";

  function pick(move: StatusMove) {
    onStage?.(move === listing.status ? undefined : move);
    onChoosingChange?.(false);
  }

  return (
    <div data-testid="listing-status-section" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge tone={status.tone} data-testid="listing-status-badge">
          {status.label}
        </Badge>
        {next ? (
          <>
            <span aria-hidden className="text-muted">
              →
            </span>
            <Badge tone={next.tone} data-testid="listing-status-staged">
              {next.label}
            </Badge>
            <span className="text-muted">Changes when you save.</span>
            <button type="button" className="font-semibold text-primary underline" onClick={() => onStage?.(undefined)} data-testid="listing-status-undo">
              Undo
            </button>
          </>
        ) : (
          <span className="text-muted">{status.note}.</span>
        )}
      </div>
      {staged && <p className="text-sm text-muted">{moveNote(staged, listing)}</p>}

      {!live && staged !== "active" && <LiveBlockers blockers={listing.live_blockers} />}

      {editable && (
        <Dialog
          open={choosing}
          onClose={() => onChoosingChange?.(false)}
          title="Change status"
          meta="It changes when you save the listing."
          placement="sheet"
          data-testid="listing-status-options"
        >
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted">Now:</span>
            <Badge tone={status.tone}>{status.label}</Badge>
          </div>
          <ul className="flex flex-col divide-y divide-line">
            {!live && (
              <StatusOption description={blocked ? "It still needs a few things first." : "Guests can find and book it."}>
                <Button type="button" size="pill" disabled={blocked} onClick={() => pick("active")} data-testid="listing-go-live">
                  {listing.status === "paused" ? "Resume" : "Go live"}
                </Button>
              </StatusOption>
            )}
            {live && (
              <StatusOption description="Hide it for a while; bookings already made stay.">
                <Button type="button" size="pill" variant="soft" onClick={() => pick("paused")} data-testid="listing-pause">
                  Pause
                </Button>
              </StatusOption>
            )}
            {(live || listing.status === "paused") && (
              <StatusOption description="Take it off the site; you can make it live again.">
                <Button type="button" size="pill" variant="soft" onClick={() => pick("delisted")} data-testid="listing-delist">
                  Delist
                </Button>
              </StatusOption>
            )}
          </ul>
          {!live && <LiveBlockers blockers={listing.live_blockers} />}
        </Dialog>
      )}
    </div>
  );
}

// One move in the Change status sheet: what it does, and its button.
function StatusOption({ description, children }: { description: string; children: ReactNode }) {
  return (
    <li className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <span className="text-sm text-muted">{description}</span>
      {children}
    </li>
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
