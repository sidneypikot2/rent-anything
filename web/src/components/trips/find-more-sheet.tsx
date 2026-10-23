"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AreaGlyph, ArrowGlyph } from "@/components/discovery/tag-glyphs";
import { Button, ButtonLink } from "@/components/ui/button";
import { CardLink } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
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
    <Dialog open onClose={onClose} placement="sheet" title={`Find more for ${trip.name}`} data-testid="find-more-sheet">
      {areas.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold">Where this trip goes</p>
          <ul className="flex flex-col gap-2">
            {areas.map((area) => (
              <li key={area.slug}>
                <CardLink
                  href={withDates(`/${area.slug}`, carry)}
                  data-testid="find-more-area"
                  className="flex items-center gap-3 p-3 hover:text-primary"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-mist text-primary">
                    <AreaGlyph className="size-6" />
                  </span>
                  <span className="min-w-0 flex-1 font-semibold">More in {area.name}</span>
                  <ArrowGlyph className="size-5 shrink-0" />
                </CardLink>
              </li>
            ))}
          </ul>
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
