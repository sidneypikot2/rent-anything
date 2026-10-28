"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogFooter, DialogSummary } from "@/components/ui/dialog";
import { Ticket } from "@/components/ui/ticket";
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
    <p className="bg-surface-2 px-3.5 py-2 text-xs font-semibold text-muted">{text}</p>
  );

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onPick(picked === "new" ? "new" : (trips.find((trip) => trip.id === picked) ?? "new"));
  }

  const chosen = picked === "new" ? null : trips.find((trip) => trip.id === picked);
  return (
    <Dialog
      open
      onClose={onClose}
      placement="sheet"
      title="Which trip?"
      meta={`Add to one of your trips, or start a new one on ${areaName}`}
      data-testid="trip-choice-sheet"
    >
      <form onSubmit={submit} className="flex flex-1 flex-col gap-4">
        <fieldset className="flex flex-col">
          <legend className="sr-only">Trip</legend>
          <Ticket className="max-h-[50dvh] overflow-y-auto">
            {grouped && heading(`In ${areaName}`)}
            {here.map(option)}
            {grouped && heading("Your other trips")}
            {others.map(option)}
            <TripOption
              isNew
              checked={picked === "new"}
              onSelect={() => setPicked("new")}
              title="New trip"
              detail="Starts with the first thing you add"
            />
          </Ticket>
        </fieldset>
        <DialogFooter summary={chosen && <DialogSummary value={chosen.name.split(" · ")[0]} detail={tripDetails(chosen)} />}>
          <Button type="submit" arrow data-testid="trip-choice-go">
            {picked === "new" ? "Start a new trip" : "Continue this trip"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
