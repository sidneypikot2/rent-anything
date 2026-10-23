"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { formatDateRange, itemCount, tripDetails } from "@/components/trips/format";
import { TripOption } from "@/components/trips/trip-option";
import type { Trip } from "@/components/trips/use-trips";

// Which trip to work on, or a new one: the home page's Start your trip, for a guest who already
// has trips, and a place page's Switch trip (AreaHero). `selected`: the trip being worked on, else
// the first (the one the home page would have continued). `places`, on a place page: the trips
// with something here come first, under "In <place>", so the one wanted is near the top however
// many trips the guest has.
export function TripChoiceSheet({
  trips,
  areaName,
  places,
  selected,
  onPick,
  onClose,
}: {
  trips: Trip[];
  areaName: string;
  places?: string[];
  selected?: number | "new";
  onPick: (choice: Trip | "new") => void;
  onClose: () => void;
}) {
  const [picked, setPicked] = useState<number | "new">(selected ?? trips[0]?.id ?? "new");
  const isHere = (trip: Trip) => trip.items.some((item) => places?.includes(item.area.slug) ?? false);
  const here = trips.filter(isHere);
  const others = trips.filter((trip) => !isHere(trip));
  const grouped = here.length > 0 && others.length > 0;
  const option = (trip: Trip) => (
    <TripOption
      key={trip.id}
      checked={picked === trip.id}
      onSelect={() => setPicked(trip.id)}
      title={trip.name}
      detail={
        // A trip named after its place and dates needs only its count under the name.
        trip.name.includes(formatDateRange(trip.starts_on, trip.ends_on) ?? "\0")
          ? itemCount(trip.items.length)
          : tripDetails(trip)
      }
    />
  );
  const heading = (text: string) => (
    <p className="mt-1 text-small font-semibold tracking-wide text-muted uppercase first:mt-0">{text}</p>
  );

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onPick(picked === "new" ? "new" : (trips.find((trip) => trip.id === picked) ?? "new"));
  }

  return (
    <Dialog open onClose={onClose} placement="sheet" title="Which trip?" data-testid="trip-choice-sheet">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <p className="text-sm text-muted">Add to one of your trips, or start a new one on {areaName}.</p>
        <fieldset className="flex max-h-[50dvh] flex-col gap-2 overflow-y-auto">
          <legend className="sr-only">Trip</legend>
          {grouped && heading(`In ${areaName}`)}
          {here.map(option)}
          {grouped && heading("Your other trips")}
          {others.map(option)}
          <TripOption
            checked={picked === "new"}
            onSelect={() => setPicked("new")}
            title="+ New trip"
            detail="Starts with the first thing you add"
          />
        </fieldset>
        <div className="flex flex-wrap justify-end gap-3">
          <Button type="button" variant="soft" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" arrow data-testid="trip-choice-go">
            {picked === "new" ? "Start a new trip" : "Continue this trip"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
