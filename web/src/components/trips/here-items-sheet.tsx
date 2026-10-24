"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BookingStatusBadge } from "@/components/bookings/booking-status";
import { tripHref } from "@/components/landing/launch-area";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { formatDateRange, guestCount } from "./format";
import { ItemEditSheet } from "./item-edit-sheet";
import { useRemoveTripItem, type Trip, type TripItem } from "./use-trips";

// What the trip holds in this place, from the place's page: each item's dates and guests, with
// Edit, its dates and guests (the cart's ItemEditSheet), and Remove, so a guest fixes an add without leaving for
// the cart. A booked item only links to the trip, where its booking is changed or cancelled.
// Moving to another trip stays in the cart. Closes itself once nothing is left here.
export function HereItemsSheet({
  trip,
  places,
  placeName,
  onClose,
}: {
  trip: Trip;
  places: string[];
  placeName: string;
  onClose: () => void;
}) {
  const items = trip.items.filter((item) => places.includes(item.area.slug));
  const [step, setStep] = useState<{ kind: "date" | "remove"; item: TripItem } | null>(null);
  const removeItem = useRemoveTripItem();
  const toast = useToast();
  const empty = items.length === 0;
  useEffect(() => {
    if (empty) onClose();
  }, [empty, onClose]);

  function back() {
    if (removeItem.isPending) return;
    removeItem.reset();
    setStep(null);
  }

  if (step?.kind === "date")
    return <ItemEditSheet trip={trip} item={step.item} onClose={back} onSaved={() => {
          setStep(null);
          toast.show(`Saved ${step.item.listing.title}`);
        }}
      />;

  if (step?.kind === "remove")
    return (
      <Dialog
        open
        onClose={back}
        title="Remove from trip?"
        data-testid="remove-item-dialog"
        actions={
          <>
            <Button type="button" variant="soft" onClick={back}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              data-testid="remove-item-confirm"
              disabled={removeItem.isPending}
              onClick={() =>
                removeItem.mutate(step.item.id, {
                  onSuccess: () => {
                    setStep(null);
                    toast.show(`Removed ${step.item.listing.title} from ${trip.name}`);
                  },
                })
              }
            >
              {removeItem.isPending ? "Removing…" : "Remove"}
            </Button>
          </>
        }
      >
        <p className="text-sm">
          {step.item.listing.title} will be removed from {trip.name}.
        </p>
        {removeItem.error && (
          <p role="alert" className="text-sm text-danger">
            {removeItem.error.message}
          </p>
        )}
      </Dialog>
    );

  return (
    <Dialog open onClose={onClose} placement="sheet" title={`In ${placeName}`} data-testid="here-items-sheet">
      <p className="text-sm text-muted">
        Your trip: {trip.name}. To book, or move something to another trip, open the trip.
      </p>
      <ul className="flex flex-col divide-y divide-line">
        {items.map((item) => {
          const dates = formatDateRange(item.starts_on, item.ends_on);
          return (
            <li key={item.id} data-testid="here-item" className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="font-semibold leading-snug">{item.listing.title}</span>
                <span className="text-sm text-muted">
                  {guestCount(item.quantity)} · {dates ?? <span className="font-semibold text-warning">No date yet</span>}
                </span>
              </div>
              {item.booking ? (
                <span className="flex shrink-0 items-center gap-3">
                  <BookingStatusBadge status={item.booking.status} small />
                  <Link href={tripHref(trip.id)} className="text-sm font-semibold text-primary hover:underline">
                    Manage booking
                  </Link>
                </span>
              ) : (
                <span className="flex shrink-0 gap-2">
                  <Button
                    type="button"
                    variant="soft"
                    data-testid="here-item-date"
                    onClick={() => setStep({ kind: "date", item })}
                  >
                    {dates ? "Edit" : "Pick a date"}
                  </Button>
                  <Button
                    type="button"
                    variant="soft"
                    data-testid="here-item-remove"
                    onClick={() => setStep({ kind: "remove", item })}
                  >
                    Remove
                  </Button>
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <div className="flex justify-end">
        <Button type="button" variant="soft" onClick={onClose}>
          Done
        </Button>
      </div>
    </Dialog>
  );
}
