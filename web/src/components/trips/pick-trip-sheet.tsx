"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { tripDetails } from "./format";
import { TripOption } from "./trip-option";
import type { Trip } from "./use-trips";

type Props = {
  title: string;
  // What is being moved: "Island hopping · Nov 13", or "Every item in Oslob day trip".
  summary: string;
  // The trips it can go to; never the one it's in.
  trips: Trip[];
  confirmLabel: string;
  pending: boolean;
  error?: string;
  onPick: (trip: Trip) => void;
  onClose: () => void;
  "data-testid"?: string;
};

// Picks another trip (screen 7): to move an item into, or to merge a trip into. Nothing is
// preselected, so a stray tap on the confirming button does nothing.
export function PickTripSheet({
  title,
  summary,
  trips,
  confirmLabel,
  pending,
  error,
  onPick,
  onClose,
  "data-testid": testId,
}: Props) {
  const [pickedId, setPickedId] = useState<number | null>(null);
  const picked = trips.find((trip) => trip.id === pickedId);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (picked) onPick(picked);
  }

  return (
    <Dialog open onClose={onClose} placement="sheet" title={title} data-testid={testId}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <p className="text-sm text-muted">{summary}</p>

        {trips.length === 0 ? (
          <p className="text-sm">You have no other trips to choose from.</p>
        ) : (
          <fieldset disabled={pending} className="flex max-h-[50dvh] flex-col gap-2 overflow-y-auto">
            <legend className="sr-only">Trip</legend>
            {trips.map((trip) => (
              <TripOption
                key={trip.id}
                checked={pickedId === trip.id}
                onSelect={() => setPickedId(trip.id)}
                title={trip.name}
                detail={tripDetails(trip)}
              />
            ))}
          </fieldset>
        )}

        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-3">
          <Button type="button" variant="soft" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" data-testid="pick-trip-confirm" disabled={pending || !picked}>
            {pending ? "Saving…" : confirmLabel}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
