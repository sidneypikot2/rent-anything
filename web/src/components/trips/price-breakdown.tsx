"use client";

import { TicketNote } from "@/components/ui/ticket";
import { formatPeso } from "@/lib/money";
import { useListingPrices, type ListingPrice, type PriceRequest } from "./use-listing-price";

// The prices of an add, put together: every item's lines (a mix's under each item's title), the
// refundable deposits, the total, and why it can't be had when the API says so.
export function combinePrices(prices: (ListingPrice | undefined)[], titles?: string[]) {
  const ready = prices.every(Boolean) ? (prices as ListingPrice[]) : null;
  if (!ready) return null;
  const lines = ready.flatMap((price, index) =>
    price.lines.map((line) => ({ ...line, label: titles ? `${titles[index]}: ${line.label}` : line.label })),
  );
  // A price to be agreed comes back as 0: it adds nothing to the total, and with nothing else
  // priced there is no total at all, rather than a ₱0 that reads as free.
  const priced = ready.filter((price) => !price.to_be_agreed);
  return {
    lines,
    total:
      priced.length > 0 && priced.every((price) => price.total_cents !== null)
        ? priced.reduce((sum, price) => sum + (price.total_cents ?? 0), 0)
        : null,
    deposit: ready.reduce((sum, price) => sum + (price.deposit_cents ?? 0), 0),
    toBeAgreed: ready.some((price) => price.to_be_agreed),
    unavailable: ready.map((price) => price.unavailable).filter(Boolean).join(". ") || null,
    // Vehicle rentals' pickup times (RAA-195): those free for every one of them, as several
    // models picked together go at one time; and when they are due back. Null for anything else.
    pickupTimes: pickupTimesOf(ready),
    returnsAt: ready.find((price) => price.returns_at)?.returns_at ?? null,
  };
}

function pickupTimesOf(prices: ListingPrice[]) {
  const lists = prices.map((price) => price.pickup_times).filter((times) => times !== null);
  if (lists.length === 0) return null;
  return lists[0].map((slot) => ({
    time: slot.time,
    available: lists.every((times) => times.some((each) => each.time === slot.time && each.available)),
  }));
}

// What the add sheet asks the API for (RAA-191), and the combined price for its summary.
export function usePriceBreakdown(requests: PriceRequest[], titles?: string[]) {
  const results = useListingPrices(requests);
  const dated = requests.every((request) => request.startsOn && request.endsOn);
  return {
    dated,
    loading: dated && results.some((result) => result.isPending),
    failed: results.some((result) => result.isError),
    price: dated ? combinePrices(results.map((result) => result.data), titles) : null,
  };
}

// The breakdown and total in the add sheet's ticket: what the total is made of, a rental's
// refundable deposit apart, and the total. Without dates it says the price comes with them.
export function PriceBreakdown({ breakdown }: { breakdown: ReturnType<typeof usePriceBreakdown> }) {
  const { dated, loading, failed, price } = breakdown;
  if (!dated) return <TicketNote data-testid="add-sheet-price">Pick dates to see the price.</TicketNote>;
  if (failed) return <TicketNote tone="warning" data-testid="add-sheet-price">Couldn&apos;t work out the price. Try again.</TicketNote>;
  if (loading || !price)
    return (
      <div className="px-3.5 py-3" data-testid="add-sheet-price">
        <span aria-hidden className="block h-4 w-40 rounded bg-mist motion-safe:animate-pulse" />
      </div>
    );
  return (
    <div className="flex flex-col gap-1.5 px-3.5 py-3 text-sm" data-testid="add-sheet-price">
      {price.toBeAgreed && <p className="text-muted">The partner hasn&apos;t set a price yet: you agree it when you book.</p>}
      <dl className="flex flex-col gap-1">
        {price.lines.map((line, index) => (
          <div key={index} className="flex justify-between gap-4">
            <dt className="min-w-0">{line.label}</dt>
            <dd className="shrink-0 tabular-nums">{formatPeso(line.amount_cents)}</dd>
          </div>
        ))}
        {price.deposit > 0 && (
          <div className="flex justify-between gap-4 text-muted">
            <dt>Refundable deposit, held at pick-up</dt>
            <dd className="shrink-0 tabular-nums">{formatPeso(price.deposit)}</dd>
          </div>
        )}
        {price.total !== null && (
          <div className="flex justify-between gap-4 border-t border-line pt-1.5 font-semibold">
            <dt>{price.toBeAgreed ? "Total so far" : "Total"}</dt>
            <dd className="tabular-nums" data-testid="add-sheet-total">
              {formatPeso(price.total)}
            </dd>
          </div>
        )}
      </dl>
      {price.unavailable && <p className="font-semibold text-warning">{price.unavailable}</p>}
    </div>
  );
}
