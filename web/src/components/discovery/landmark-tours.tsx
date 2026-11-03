"use client";

import Image from "next/image";
import { useState, type ComponentProps } from "react";
import { AddToTripButton } from "@/components/trips/add-to-trip-button";
import type { AddListing } from "@/components/trips/add-preview";
import { InTripBadge, useListingsInTrip } from "@/components/trips/in-trip-badge";
import type { TripDates } from "@/components/trips/trip-dates";
import type { AddPreview } from "@/components/trips/use-trips";
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

// Which of the places to see saved to the trip a tour goes to, under its option in a business's
// panel ("Goes to your saved Ogtong Cave and Kawayan Beach"), so a guest who saved places sees
// which tour reaches them. Nothing while it goes to none of them.
export function SavedStops({ places }: { places: { slug: string; name: string }[] }) {
  const saved = useSavedHere();
  const names = places.filter((place) => saved.has(place.slug)).map((place) => place.name);
  if (names.length === 0) return null;
  const list =
    names.length === 1
      ? names[0]
      : names.length === 2
        ? `${names[0]} and ${names[1]}`
        : `${names[0]}, ${names[1]} and ${names.length - 2} more`;
  return (
    <p data-testid="offer-saved-stops" title={names.join(", ")} className="flex min-w-0 items-start gap-1.5 text-sm font-semibold text-primary">
      <HeartGlyph filled className="mt-0.5 size-4 shrink-0" />
      <span>Goes to your saved {list}</span>
    </p>
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
                    href={`#listing-${tour.id}`}
                    onClick={(event) => {
                      setOpen(false);
                      // The same row again: no hashchange would fire, so send one.
                      if (window.location.hash !== `#listing-${tour.id}`) return;
                      event.preventDefault();
                      window.dispatchEvent(new HashChangeEvent("hashchange"));
                    }}
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
