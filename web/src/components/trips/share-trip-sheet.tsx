"use client";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { sharedTripUrl, useChangeTripShare, useTripShare } from "./use-trip-share";
import type { Trip } from "./use-trips";

// Share a trip with friends (RAA-178): a view-only link to /trips/shared/<token> — the trip's
// name, dates, guests and items with their booking status, never prices, contact details or a
// way into the cart. The link shows first and Share or Copy is a second tap, as
// `navigator.share` needs the tap itself and would be refused after waiting on the API. New
// link replaces it (the old one stops working); Stop sharing removes it.
export function ShareTripSheet({ trip, onClose }: { trip: Trip; onClose: () => void }) {
  const share = useTripShare(trip.id);
  const change = useChangeTripShare(trip.id);
  const toast = useToast();
  const url = share.data ? sharedTripUrl(share.data) : null;
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  async function send(link: string) {
    if (canShare) {
      try {
        await navigator.share({ title: trip.name, url: link });
      } catch {
        // Closed without sharing.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(link);
      toast.show("Link copied", { "data-testid": "share-toast" });
    } catch {
      // No clipboard (an insecure origin, or refused): the link is on screen to copy by hand.
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={trip.name}
      meta="Share it: anyone with the link sees its dates, guests and what's in it, never prices or your details, and can't change anything."
      placement="sheet"
      data-testid="share-trip-sheet"
    >

      {share.isPending ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : share.isError ? (
        <p role="alert" className="text-sm text-danger">
          {share.error.message}
        </p>
      ) : url ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 rounded-[1.375rem] border border-line bg-surface-2 p-4">
            <span className="text-xs font-semibold text-muted">Share link</span>
            <span data-testid="share-trip-url" className="text-sm break-all">
              {url}
            </span>
            <Button type="button" size="sm" onClick={() => void send(url)} data-testid="share-trip-send" className="self-start">
              {canShare ? "Share" : "Copy link"}
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="soft"
              disabled={change.isPending}
              onClick={() => change.mutate("create", { onSuccess: () => toast.show("New link made. The old one no longer works.") })}
              data-testid="share-trip-rotate"
            >
              New link
            </Button>
            <Button
              type="button"
              size="sm"
              variant="danger"
              disabled={change.isPending}
              onClick={() => change.mutate("stop", { onSuccess: () => toast.show("Stopped sharing. The link no longer works.") })}
              data-testid="share-trip-stop"
            >
              Stop sharing
            </Button>
          </div>
          <p className="text-sm text-muted">New link makes this one stop working, for anyone you sent it to.</p>
        </div>
      ) : (
        <Button
          type="button"
          disabled={change.isPending}
          onClick={() => change.mutate("create")}
          data-testid="share-trip-create"
          className="self-start"
        >
          {change.isPending ? "Making the link…" : "Make a share link"}
        </Button>
      )}
    </Dialog>
  );
}
