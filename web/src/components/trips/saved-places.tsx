"use client";

import Link from "next/link";
import { HeartGlyph, TrashGlyph } from "@/components/discovery/tag-glyphs";
import { Card } from "@/components/ui/card";
import { useUnsaveLandmark, type Trip } from "./use-trips";

// A trip's saved places in the cart: places to see the guest wants to go to, with no dates or
// price and never sent to a partner. Each links to its card on its place's page, where the tours
// that go there are; a bin takes it off the trip.
export function SavedPlaces({ trip }: { trip: Trip }) {
  const unsave = useUnsaveLandmark();
  return (
    <Card edge="line">
      <section aria-labelledby={`trip-${trip.id}-saved`} data-testid="cart-saved-places" className="flex flex-col gap-2 px-4 py-3.5 sm:px-card">
        <h3 id={`trip-${trip.id}-saved`} className="flex items-center gap-2 text-sm font-semibold">
          <HeartGlyph filled className="size-4 text-primary" />
          Places you want to see
        </h3>
        <p className="text-sm text-muted">Saved for ideas, not booked. Open one to add a tour that goes there.</p>
        <ul className="flex flex-col divide-y divide-line">
          {trip.saved_landmarks.map((saved) => (
            <li key={saved.id} className="flex min-h-11 items-center justify-between gap-3">
              <Link href={`/${saved.area_slug}#${saved.slug}`} className="font-semibold text-link underline-offset-4 hover:underline">
                {saved.name}
              </Link>
              <button
                type="button"
                onClick={() => unsave.mutate(saved.id)}
                disabled={unsave.isPending && unsave.variables === saved.id}
                aria-label={`Remove ${saved.name} from this trip`}
                className="flex size-11 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-danger"
              >
                <TrashGlyph className="size-4.5" />
              </button>
            </li>
          ))}
        </ul>
      </section>
    </Card>
  );
}
