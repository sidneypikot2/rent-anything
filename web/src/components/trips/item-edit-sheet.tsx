"use client";

import { useState, type FormEvent } from "react";
import { CANCELLATION_POLICY } from "@/components/bookings/cancellation";
import { TickGlyph } from "@/components/discovery/tag-glyphs";
import { BOOKING_STATE } from "@/components/landing/launch-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DateRangeField } from "@/components/ui/date-range-field";
import { Dialog } from "@/components/ui/dialog";
import { StepperField } from "@/components/ui/stepper-field";
import { daysBetween, guestLimitHint, noNightError, RANGE_TYPES, todayIso } from "./format";
import { ItemThumb } from "./item-thumb";
import { useUpdateTripItem, type Trip, type TripItem } from "./use-trips";

type Props = {
  trip: Trip;
  item: TripItem;
  onClose: () => void;
  onSaved: (trip: Trip) => void;
};

// Edit an item's dates and guests (screen 7). An undated item starts from the trip's dates
// (decision 9); the trip grows if the new dates fall outside it. Guests go up to what the
// listing takes (`max_guests`), so + stops there; an item added with more before the limit
// keeps its count until the guest lowers it. It opens on what is being changed: the listing's
// photo, name and kind, the trip it is in, then the nights the new dates make, its cancellation
// policy and that nothing is paid yet, so a guest changing it from a card knows what they hold.
export function ItemEditSheet({ trip, item, onClose, onSaved }: Props) {
  const range = RANGE_TYPES.has(item.booking_type);
  // The trip's dates are a starting point only while they're still ahead.
  const tripAhead = trip.starts_on && trip.starts_on >= todayIso() ? trip : null;
  const [{ from: startsOn, to: endsOn }, setDates] = useState({
    from: item.starts_on ?? tripAhead?.starts_on ?? "",
    to: item.ends_on ?? tripAhead?.ends_on ?? "",
  });
  const [guests, setGuests] = useState(item.quantity);
  const update = useUpdateTripItem();
  const maxGuests = Math.max(item.max_guests ?? 99, item.quantity);

  // A single-day booking has one date; the API takes it as from–to of that day.
  const itemEnds = range ? endsOn : startsOn;
  const noNight = noNightError(item.booking_type, startsOn, endsOn);
  const valid = Boolean(startsOn && itemEnds) && !noNight;
  const nights = item.booking_type === "stay" && valid ? daysBetween(startsOn, endsOn) : null;
  const policy = CANCELLATION_POLICY[item.cancellation_policy];
  const where = item.destination?.name ?? item.area.name;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!valid) return;
    update.mutate(
      { id: item.id, changes: { starts_on: startsOn, ends_on: itemEnds, quantity: guests } },
      { onSuccess: onSaved },
    );
  }

  return (
    <Dialog open onClose={onClose} placement="sheet" title="Change dates and guests" data-testid="item-edit-sheet">
      <form onSubmit={submit} className="flex flex-col gap-5">
        <div className="flex items-start gap-3 rounded-control bg-surface-2 p-3">
          <ItemThumb item={item} />
          <div className="flex min-w-0 flex-col gap-1">
            <p className="font-semibold text-pretty">{item.listing.title}</p>
            <p className="text-sm text-muted">{[item.listing.category, where].filter(Boolean).join(" · ")}</p>
            <p className="flex items-center gap-1.5 text-sm font-medium text-primary">
              <TickGlyph aria-hidden className="size-3.5 shrink-0" />
              <span className="truncate">In {trip.name}</span>
            </p>
          </div>
        </div>

        {item.unavailable && (
          <p role="status" className="rounded-control border border-warning/40 px-3 py-2 text-sm text-warning">
            {item.unavailable}. Pick other dates to keep it.
          </p>
        )}

        <fieldset disabled={update.isPending} className="flex flex-col gap-4">
          <DateRangeField
            label={range ? "Dates" : "Date"}
            single={!range}
            min={todayIso()}
            from={startsOn}
            to={endsOn}
            onChange={setDates}
            inline
            autoFocus
            hint={
              range && startsOn && !endsOn
                ? "Pick the last day too"
                : nights
                  ? `${nights} ${nights === 1 ? "night" : "nights"}`
                  : undefined
            }
            error={noNight}
          />
          <StepperField
            label="Guests"
            hint={guestLimitHint(item.max_guests)}
            value={guests}
            onChange={setGuests}
            min={1}
            max={maxGuests}
            data-testid="item-edit-guests"
          />
        </fieldset>

        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4 text-sm text-muted">
          {policy && (
            <Badge tone={item.cancellation_policy === "non_refundable" ? "fact" : "emerald"} className="min-h-6 px-2.5 text-xs">
              {policy.name}
            </Badge>
          )}
          <span>Saved to your trip; {BOOKING_STATE.unpaid}.</span>
        </div>

        {update.error && (
          <p role="alert" className="text-sm text-danger">
            {update.error.message}
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-3">
          <Button type="button" variant="soft" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" data-testid="item-edit-save" loading={update.isPending} disabled={!valid}>
            {update.isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
