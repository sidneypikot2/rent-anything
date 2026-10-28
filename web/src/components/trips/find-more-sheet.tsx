"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AreaGlyph, ArrowGlyph } from "@/components/discovery/tag-glyphs";
import { Button, ButtonLink } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Ticket } from "@/components/ui/ticket";
import { Field } from "@/components/ui/field";
import { readTripDates, tripDatesQuery, withDates } from "./trip-dates";
import type { Trip } from "./use-trips";

// Finding more for a trip from the cart: its destinations, and a search for anywhere else, each
// a link out with the trip's dates and guests (dropped once past, as readTripDates does). The add
// there runs the usual flow, whose suggestion picks this trip by its dates or destination.
export function FindMoreSheet({ trip, onClose }: { trip: Trip; onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const carry = tripDatesQuery(
    readTripDates({ from: trip.starts_on ?? undefined, to: trip.ends_on ?? undefined, guests: String(trip.guests) }),
  );
  const areas = [...new Map(trip.items.map((item) => [item.area.slug, item.area])).values()];

  return (
    <Dialog open onClose={onClose} placement="sheet" title={trip.name} meta="Find more for this trip, on its dates" data-testid="find-more-sheet">
      {areas.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold">Where this trip goes</p>
          <Ticket>
            {areas.map((area) => (
              <Link
                key={area.slug}
                href={withDates(`/${area.slug}`, carry)}
                data-testid="find-more-area"
                className="group flex min-h-16 items-center gap-3 px-3.5 py-3 transition-colors duration-300 ease-calm hover:bg-surface-2"
              >
                <span className="flex size-9.5 shrink-0 items-center justify-center rounded-xl bg-action-tint text-action-ink">
                  <AreaGlyph className="size-5" />
                </span>
                <span className="min-w-0 flex-1 text-control font-bold">More in {area.name}</span>
                <ArrowGlyph className="size-4.5 shrink-0 text-muted transition-transform duration-500 ease-calm motion-safe:group-hover:translate-x-0.5" />
              </Link>
            ))}
          </Ticket>
        </div>
      )}

      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          router.push(withDates(`/search?q=${encodeURIComponent(query.trim())}`, carry));
        }}
      >
        <Field
          label={areas.length > 0 ? "Somewhere else" : "Where to, or what to do"}
          placeholder="A destination, landmark or activity"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          minLength={2}
          required
          data-testid="find-more-query"
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" data-testid="find-more-search">
            Search
          </Button>
          <ButtonLink href={`/${carry}`} variant="soft">
            Browse destinations
          </ButtonLink>
        </div>
      </form>
    </Dialog>
  );
}
