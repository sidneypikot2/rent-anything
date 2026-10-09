"use client";

import { useState, type FormEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { formatDateRange, guestCount, itemCount, todayIso } from "./format";
import { useAddTripItem, useTripSuggestion, type AddRequest, type Trip, type TripSuggestion } from "./use-trips";

type Props = {
  request: AddRequest;
  // The guest's current trips, at least one.
  trips: Trip[];
  onClose: () => void;
  // The trip the item went to, and the same trip before the add when it already existed.
  onAdded: (trip: Trip, before?: Trip) => void;
};

type Choice = number | "new";

// Why the suggested trip is suggested: the item falls in its dates, it would stretch them,
// or (undated) it's the trip last edited for this destination.
function suggestedReason(suggestion: TripSuggestion, startsOn: string | undefined, endsOn: string | undefined) {
  if (suggestion.extends_to) {
    return `Extends this trip to ${formatDateRange(suggestion.extends_to.starts_on, suggestion.extends_to.ends_on)}`;
  }
  const dates = formatDateRange(startsOn, endsOn);
  return dates ? `${dates} is in this trip` : "Your latest trip here";
}

function tripDetails(trip: Trip) {
  return [formatDateRange(trip.starts_on, trip.ends_on) ?? "No dates yet", itemCount(trip.items.length)].join(" · ");
}

// "Add to which trip?" (screen 4): shown only when the guest already has trips. The
// server's suggestion comes first and is preselected; "New trip" is always there.
export function WhichTripSheet({ request, trips, onClose, onAdded }: Props) {
  const [startsOn, setStartsOn] = useState(request.startsOn ?? "");
  const [endsOn, setEndsOn] = useState(request.endsOn ?? "");
  const [quantity, setQuantity] = useState(String(request.quantity));
  // What the guest picked; until they pick, the suggestion is the choice.
  const [picked, setPicked] = useState<Choice | null>(null);
  const addItem = useAddTripItem();

  // A single-day booking has one date; the API takes it as from–to of that day.
  const itemEnds = request.range ? endsOn : startsOn;
  const halfDated = Boolean(startsOn) !== Boolean(itemEnds);
  const backwards = Boolean(startsOn && itemEnds && itemEnds < startsOn);
  const datesValid = !halfDated && !backwards;
  const dated = datesValid && startsOn ? { startsOn, endsOn: itemEnds } : { startsOn: undefined, endsOn: undefined };

  const suggestion = useTripSuggestion(request.listingId, dated.startsOn, dated.endsOn, datesValid);
  const suggested = suggestion.data?.trip ?? null;
  const choice: Choice | null = picked ?? (suggestion.data ? (suggested?.id ?? "new") : null);

  // The suggested trip first, then the rest as the cart lists them.
  const ordered = suggested
    ? [trips.find((trip) => trip.id === suggested.id) ?? suggested, ...trips.filter((trip) => trip.id !== suggested.id)]
    : trips;

  const quantityNumber = Number(quantity);
  const quantityValid = Number.isInteger(quantityNumber) && quantityNumber >= 1 && quantityNumber <= 99;
  const dateError = halfDated
    ? "Pick both dates, or neither"
    : backwards
      ? "The end can't be before the start"
      : undefined;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!datesValid || !quantityValid || choice === null) return;
    const tripId = choice === "new" ? null : choice;
    addItem.mutate(
      { request: { ...request, ...dated, quantity: quantityNumber }, tripId },
      {
        onSuccess: (trip) =>
          onAdded(
            trip,
            trips.find((existing) => existing.id === tripId),
          ),
      },
    );
  }

  const summary = [
    request.title,
    formatDateRange(dated.startsOn, dated.endsOn) ?? "No date yet",
    quantityValid ? guestCount(quantityNumber) : "? guests",
  ].join(" · ");

  return (
    <Dialog open onClose={onClose} placement="sheet" title="Add to which trip?" data-testid="which-trip-sheet">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <p className="text-sm text-muted">{summary}</p>

        <fieldset disabled={addItem.isPending} className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field
            label={request.range ? "From" : "Date"}
            type="date"
            min={todayIso()}
            value={startsOn}
            onChange={(event) => {
              setStartsOn(event.target.value);
              setPicked(null);
            }}
            error={dateError}
          />
          {request.range && (
            <Field
              label="To"
              type="date"
              min={startsOn || todayIso()}
              value={endsOn}
              onChange={(event) => {
                setEndsOn(event.target.value);
                setPicked(null);
              }}
            />
          )}
          <Field
            label="Guests"
            type="number"
            min={1}
            max={99}
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            error={quantityValid ? undefined : "1 to 99"}
          />
        </fieldset>

        <fieldset disabled={addItem.isPending} className="flex max-h-[40dvh] flex-col gap-2 overflow-y-auto">
          <legend className="sr-only">Trip</legend>
          {ordered.map((trip) => (
            <TripOption
              key={trip.id}
              checked={choice === trip.id}
              onSelect={() => setPicked(trip.id)}
              title={trip.name}
              detail={
                trip.id === suggested?.id && suggestion.data
                  ? `${suggestedReason(suggestion.data, dated.startsOn, dated.endsOn)} · ${itemCount(trip.items.length)}`
                  : tripDetails(trip)
              }
              suggested={trip.id === suggested?.id}
            />
          ))}
          <TripOption
            checked={choice === "new"}
            onSelect={() => setPicked("new")}
            title="+ New trip"
            detail={suggestion.data?.new_trip_name ?? "Named after the destination and dates"}
            suggested={suggestion.data !== undefined && suggested === null}
          />
        </fieldset>

        {(addItem.error || suggestion.error) && (
          <p role="alert" className="text-sm text-danger">
            {addItem.error?.message ?? "Couldn't suggest a trip. Pick one, or try again."}
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-3">
          <Button type="button" variant="soft" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            data-testid="which-trip-add"
            disabled={addItem.isPending || choice === null || !datesValid || !quantityValid}
          >
            {addItem.isPending ? "Adding…" : "Add to trip"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function TripOption({
  checked,
  onSelect,
  title,
  detail,
  suggested,
}: {
  checked: boolean;
  onSelect: () => void;
  title: string;
  detail: string;
  suggested: boolean;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-xl border-[1.5px] p-3",
        checked ? "border-primary bg-mist" : "border-line-strong bg-surface",
      )}
    >
      <input type="radio" name="trip" checked={checked} onChange={onSelect} className="mt-1 accent-primary" />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2 font-semibold">
          {title}
          {suggested && <Badge tone="emerald">Suggested</Badge>}
        </span>
        <span className="block text-sm text-muted">{detail}</span>
      </span>
    </label>
  );
}
