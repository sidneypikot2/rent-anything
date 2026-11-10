"use client";

import Image from "next/image";
import { useState, type ComponentProps } from "react";
import { AddToTripButton } from "@/components/trips/add-to-trip-button";
import type { AddListing } from "@/components/trips/add-preview";
import { stopsText } from "@/components/trips/add-sheet-stops";
import { InTripBadge, useListingsInTrip } from "@/components/trips/in-trip-badge";
import type { TripDates } from "@/components/trips/trip-dates";
import { useRowLink } from "@/components/trips/trip-link";
import type { AddPreview } from "@/components/trips/use-trips";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Price } from "@/components/ui/typography";
import { isApiPhoto } from "@/components/landing/sample-photos";
import { useSavedHere } from "@/components/trips/save-landmark-button";
import { ArrowGlyph, CategoryGlyph, HeartGlyph, TickGlyph } from "./tag-glyphs";

// A tour (or other activity) on the page that goes to a place to see, as the place's tour list
// shows it: what its row in What to book shows, with the same Add to trip.
export type LandmarkTour = {
  id: number;
  title: string;
  by: string;
  category: string;
  photo: { src: string; alt: string } | null;
  price?: ComponentProps<typeof Price>;
  unpriced?: string;
  // For its Add to trip, built here: plain data crosses from the server page.
  listing: AddListing;
  preview: AddPreview;
};

// A place to see's line under its name: its tags, or, once a tour in the trip being worked on
// goes there, that the trip covers it, or, saved to the trip with no tour going yet, that.
export function LandmarkLine({ slug, tags, tours }: { slug: string; tags: string; tours: { id: number; title: string }[] }) {
  const held = useListingsInTrip(tours.map((tour) => tour.id));
  const covering = tours.find((tour) => held.has(tour.id));
  const saved = useSavedHere().has(slug);
  if (covering)
    return (
      // Short, so it fits the card's one line: the tour list names the tour.
      <p data-testid="landmark-covered" title={`With ${covering.title}`} className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-mint">
        <TickGlyph aria-hidden className="size-4 shrink-0" />
        <span className="truncate">
          Your trip goes here<span className="sr-only"> with {covering.title}</span>
        </span>
      </p>
    );
  if (saved)
    return (
      <p data-testid="landmark-saved" className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-sky-pale">
        <HeartGlyph filled className="size-4 shrink-0" />
        <span className="truncate">Saved to your trip</span>
      </p>
    );
  return tags ? <p className="truncate text-sm text-sky-mist">{tags}</p> : null;
}

const STOP_CHIPS = 4;

// The places a tour stops at, so a guest can compare tours before adding one: the trip's picks
// first, hearted in green, the rest plain, as the review's day shows them. Stops have no order, so
// no numbers. `picked`: the plan's own hearts, else what is saved to the trip the page shows.
export function TourStops({
  stops,
  picked,
  label,
  max = STOP_CHIPS,
}: {
  stops: { slug: string; name: string }[];
  picked?: Set<string>;
  // A business's card sums its tours ("Tours go to 5 places").
  label?: string;
  max?: number;
}) {
  const saved = useSavedHere();
  const isPick = (slug: string) => (picked ?? saved).has(slug);
  if (stops.length === 0) return null;
  const ordered = [...stops.filter((stop) => isPick(stop.slug)), ...stops.filter((stop) => !isPick(stop.slug))];
  return (
    <div className="flex min-w-0 flex-col gap-1" data-testid="tour-stops">
      <p className="text-sm text-muted">{label ?? stopsText(stops.length)}</p>
      <ul className="flex flex-wrap gap-1">
        {ordered.slice(0, max).map((stop) => (
          <li key={stop.slug} className="min-w-0">
            <Badge tone={isPick(stop.slug) ? "emerald" : "mist"} data-testid="tour-stop">
              {isPick(stop.slug) && <HeartGlyph filled className="size-3.5 shrink-0" />}
              <span className="truncate">{stop.name}</span>
            </Badge>
          </li>
        ))}
        {ordered.length > max && (
          <li>
            <Badge tone="mist">+{ordered.length - max} more</Badge>
          </li>
        )}
      </ul>
    </div>
  );
}

// "2 tours go here" on a place to see: opens the tours that go there in a sheet, each with its
// price and Add to trip, and marked when the trip already holds it. A tour's title goes to its
// row in What to book.
export function LandmarkToursButton({
  place,
  label,
  tours,
  dates,
}: {
  place: string;
  label: string;
  tours: LandmarkTour[];
  dates: TripDates;
}) {
  const [open, setOpen] = useState(false);
  const rowLink = useRowLink();
  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        data-testid="landmark-tours"
        className="relative z-10 -my-1 flex min-h-11 items-center gap-1.5 self-start text-sm font-semibold text-sky-pale underline-offset-4 hover:underline"
      >
        {label} <ArrowGlyph className="size-4" />
      </button>
      {/* Mounted only while open: no hidden Add to trip buttons per card in the page. */}
      {open && (
      <Dialog
        open
        onClose={() => setOpen(false)}
        title={`Going to ${place}`}
        meta={`${label}. Add one to your trip to see it.`}
        placement="sheet"
        data-testid="landmark-tours-sheet"
      >
        <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-[1.375rem] border border-line">
          {tours.map((tour) => (
            <li key={tour.id} className="flex flex-col gap-3 px-3.5 py-3.5">
              <div className="flex min-w-0 items-start gap-3">
                <span className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-[1.125rem] bg-mist text-primary">
                  {tour.photo ? (
                    <Image src={tour.photo.src} alt="" fill unoptimized={isApiPhoto(tour.photo.src)} sizes="4rem" className="object-cover" />
                  ) : (
                    <CategoryGlyph name={tour.category} className="size-6" />
                  )}
                </span>
                <div className="flex min-w-0 flex-col gap-1">
                  <a
                    {...rowLink(tour.id, () => setOpen(false))}
                    className="font-semibold break-words text-foreground underline-offset-4 hover:underline"
                  >
                    {tour.title}
                  </a>
                  <span className="text-sm text-muted">{tour.by}</span>
                  <span className="flex">
                    <InTripBadge listingId={tour.id} />
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                {tour.price ? <Price {...tour.price} /> : <span className="text-sm text-muted">{tour.unpriced}</span>}
                <AddToTripButton listing={tour.listing} dates={dates} preview={tour.preview} />
              </div>
            </li>
          ))}
        </ul>
      </Dialog>
      )}
    </>
  );
}
