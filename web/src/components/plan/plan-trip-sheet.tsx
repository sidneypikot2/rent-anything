"use client";

import { ChevronGlyph } from "@/components/discovery/tag-glyphs";
import { guestCount, thingCount } from "@/components/trips/format";
import { itemPriceLabel, itemQuote, type Trip, type TripQuote } from "@/components/trips/use-trips";
import { ButtonLink } from "@/components/ui/button";
import { Dialog, DialogSummary } from "@/components/ui/dialog";
import { formatDateRange } from "@/lib/dates";

// The foot's way to the trip while planning (2026-11-10): Next stays the step's main button, and
// this one beside it shows what the trip holds so far without leaving the step.
export function PlanTripButton({ count, total, onOpen }: { count: number; total: string | null; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-haspopup="dialog"
      className="flex min-h-11 min-w-0 items-center gap-2 rounded-button border border-primary px-4 text-left text-control font-semibold text-navy transition-colors duration-300 ease-calm hover:bg-primary/10"
      data-testid="plan-trip-open"
    >
      <span className="min-w-0 truncate">
        {count} in trip
        {total && <span className="font-medium text-muted max-sm:hidden"> · {total}</span>}
      </span>
      <ChevronGlyph direction="up" className="size-4 shrink-0" />
    </button>
  );
}

// What the trip holds, from the plan's foot: each item with its dates and price (the quote's,
// never worked out here), the steps still open and the total, with Review trip. Read-only:
// changes happen on Review and in the cart. Closing it leaves the guest on the same step.
export function PlanTripSheet({
  open,
  onClose,
  trip,
  place,
  quote,
  total,
  stillOpen,
  reviewHref,
}: {
  open: boolean;
  onClose: () => void;
  trip: Trip;
  place: string;
  quote: TripQuote | undefined;
  total: string | null;
  stillOpen: string[];
  reviewHref: string;
}) {
  const when = formatDateRange(trip.starts_on, trip.ends_on);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      placement="sheet"
      pinned
      title="Your trip"
      meta={[place, when, guestCount(trip.guests + (trip.children ?? 0))].filter(Boolean).join(" · ")}
      summary={<DialogSummary value={total ?? "…"} detail={thingCount(trip.items.length)} />}
      actions={
        <ButtonLink href={reviewHref} variant="soft" glyph="arrow" data-testid="plan-trip-review">
          Review trip
        </ButtonLink>
      }
      data-testid="plan-trip-sheet"
    >
      <ul className="flex flex-col divide-y divide-line">
        {trip.items.map((item) => {
          const price = itemPriceLabel(itemQuote(quote, item));
          const dates = formatDateRange(item.starts_on, item.ends_on);
          return (
            <li key={item.id} className="flex items-baseline justify-between gap-3 py-3">
              <div className="flex min-w-0 flex-col">
                <span className="truncate font-semibold text-navy">{item.listing.title}</span>
                <span className="truncate text-small text-muted">
                  {[item.listing.category, dates ?? "No date yet"].filter(Boolean).join(" · ")}
                </span>
              </div>
              {price && <span className="shrink-0 text-sm font-semibold text-navy tabular-nums">{price}</span>}
            </li>
          );
        })}
      </ul>
      {stillOpen.length > 0 && (
        <p className="mt-2 text-sm text-warning" data-testid="plan-trip-still-open">
          Still open: {stillOpen.join(", ")}
        </p>
      )}
    </Dialog>
  );
}
