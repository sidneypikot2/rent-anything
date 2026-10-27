"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BookingStatusBadge } from "@/components/bookings/booking-status";
import { tripHref } from "@/components/landing/launch-area";
import { Button, ButtonLink } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/components/ui/cn";
import { useToast } from "@/components/ui/toast";
import { formatDateRange, guestCount } from "./format";
import { ItemEditSheet } from "./item-edit-sheet";
import { ItemThumb } from "./item-thumb";
import { useRemoveTripItem, type Trip, type TripItem } from "./use-trips";

// What the trip holds in this place, from the place's page: each item's dates and guests, with
// Edit, its dates and guests (the cart's ItemEditSheet), and Remove, so a guest fixes an add without leaving for
// the cart. A booked item only links to the trip, where its booking is changed or cancelled.
// Moving to another trip stays in the cart. Closes itself once nothing is left here. Edit and
// Remove open over the list, which stays put, so coming back keeps its scroll and puts focus on
// the button that opened them.
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
  // The row's button that opened a step, for focus to return to.
  const opener = useRef<HTMLElement | null>(null);
  function open(kind: "date" | "remove", item: TripItem) {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setStep({ kind, item });
  }
  // After the step's dialog has gone: the opener, or the list's own close button once its row was removed.
  function done() {
    setStep(null);
    window.setTimeout(() => {
      const target = opener.current?.isConnected
        ? opener.current
        : document.querySelector<HTMLElement>('[data-testid="here-items-sheet"] button[aria-label="Close"]');
      target?.focus();
      opener.current = null;
    });
  }
  useEffect(() => {
    if (empty) onClose();
  }, [empty, onClose]);

  function back() {
    if (removeItem.isPending) return;
    removeItem.reset();
    done();
  }

  const stepSheet =
    step?.kind === "date" ? (
      <ItemEditSheet
        trip={trip}
        item={step.item}
        onClose={back}
        onSaved={() => {
          done();
          toast.show(`Saved ${step.item.listing.title}`);
        }}
      />
    ) : step?.kind === "remove" ? (
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
                    done();
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
    ) : null;

  return (
    <>
      <Dialog
        open
        onClose={onClose}
        placement="sheet"
        pinned
        title={`Your trip in ${placeName}`}
        data-testid="here-items-sheet"
        actions={
          <ButtonLink href={tripHref(trip.id)} arrow data-testid="here-items-open-trip">
            Open the trip
          </ButtonLink>
        }
      >
        <p className="text-sm text-pretty text-muted">
          {trip.name}. To book, or move something to another trip, open the trip.
        </p>
        <ul className="-mt-1 flex flex-col divide-y divide-line">
          {items.map((item) => {
            const dates = formatDateRange(item.starts_on, item.ends_on);
            const title = item.listing.title;
            return (
              <li key={item.id} data-testid="here-item" className="flex items-start gap-3 py-3.5">
                <ItemThumb item={item} />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span className="font-semibold leading-snug text-pretty">{title}</span>
                  <span className="text-sm text-muted">
                    {guestCount(item.quantity)} ·{" "}
                    {dates ?? <span className="font-semibold text-warning">No date yet</span>}
                  </span>
                  {/* Text actions under the line, not two pills per row: the list stays a list of
                  the trip, and each still has a 44px target (ACTION's stretched hit area). */}
                  {item.booking ? (
                    <span className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-0.5">
                      <BookingStatusBadge status={item.booking.status} small />
                      <Link href={tripHref(trip.id)} className={ACTION} aria-label={`Manage booking: ${title}`}>
                        Manage booking
                      </Link>
                    </span>
                  ) : (
                    <span className="flex gap-x-6 pt-0.5">
                      <button
                        type="button"
                        data-testid="here-item-date"
                        aria-label={`${dates ? "Edit dates and guests" : "Pick a date"}: ${title}`}
                        onClick={() => open("date", item)}
                        className={ACTION}
                      >
                        {dates ? "Edit" : "Pick a date"}
                      </button>
                      <button
                        type="button"
                        data-testid="here-item-remove"
                        aria-label={`Remove ${title}`}
                        onClick={() => open("remove", item)}
                        className={cn(ACTION, "text-muted hover:text-danger")}
                      >
                        Remove
                      </button>
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </Dialog>
      {stepSheet}
    </>
  );
}

// A row's action as text, its hit area stretched to 44px tall so it stays easy to tap.
const ACTION =
  "relative text-left text-sm font-semibold whitespace-nowrap text-link underline-offset-4 transition-colors duration-300 ease-calm after:absolute after:-inset-x-2 after:-inset-y-3 after:content-[''] hover:underline";
