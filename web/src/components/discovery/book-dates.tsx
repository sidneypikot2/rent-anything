"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState, useSyncExternalStore, useTransition } from "react";
import type { TripDates } from "@/components/trips/trip-dates";
import { DateRangeField } from "@/components/ui/date-range-field";
import { localTodayIso } from "@/lib/dates";

// What to book's dates (2026-11-11): the guest picks them here, and every section then keeps only
// what is free on them (book_cards' `from` / `to`). A white bar across the seam between the
// banner and the listings (BookDatesSeam), half on each, so the search joins the two. They live in the URL (`?from=&to=`, which
// the page's prices and adds read too) and are remembered in this browser per place, so coming
// back to the page, or its Show all page, brings them back. Clearing forgets them.
const storageKey = (slug: string) => `book-dates:${slug}`;

function remembered(slug: string): { from: string; to: string } | null {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey(slug)) ?? "null");
    return saved && typeof saved.from === "string" && typeof saved.to === "string" ? saved : null;
  } catch {
    return null;
  }
}

function remember(slug: string, range: { from: string; to: string } | null) {
  try {
    if (range) localStorage.setItem(storageKey(slug), JSON.stringify(range));
    else localStorage.removeItem(storageKey(slug));
  } catch {
    // Private windows and blocked storage: the URL still holds them.
  }
}

// New dates wait on the server for the whole page before Next swaps it in, so the old cards would
// stay up meanwhile: the bar's navigation runs in a transition, and while it is pending the listings
// (BookDatesPending) show their skeleton at once. One page's bar and listings, so one flag.
let pending = false;
const listeners = new Set<() => void>();
function setPending(next: boolean) {
  if (pending === next) return;
  pending = next;
  listeners.forEach((listener) => listener());
}
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

// The listings under the bar: their skeleton (`fallback`) in their place while new dates load.
// No wrapper element: the listings' section must stay a direct child of `.page-sections`, whose
// rules give it its paper sheet (globals.css).
export function BookDatesPending({ fallback, children }: { fallback: ReactNode; children: ReactNode }) {
  const loading = useSyncExternalStore(subscribe, () => pending, () => false);
  return loading ? fallback : children;
}

export function BookDates({ slug, dates }: { slug: string; dates: TripDates }) {
  const router = useRouter();
  const [navigating, startTransition] = useTransition();
  useEffect(() => {
    setPending(navigating);
    return () => setPending(false);
  }, [navigating]);
  const [range, setRange] = useState({ from: dates.from ?? "", to: dates.to ?? "" });
  // The URL's dates changed (the header's search, back and forward): the field follows.
  const [shown, setShown] = useState(`${dates.from}-${dates.to}`);
  if (shown !== `${dates.from}-${dates.to}`) {
    setShown(`${dates.from}-${dates.to}`);
    setRange({ from: dates.from ?? "", to: dates.to ?? "" });
  }

  // The page with these dates in its URL, or none; the rest of the query and the hash stay.
  // The same dates as the URL's change nothing, so they don't reload the listings.
  const go = (next: { from: string; to: string } | null) => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("from") === (next?.from ?? null) && params.get("to") === (next?.to ?? null)) return;
    if (next) {
      params.set("from", next.from);
      params.set("to", next.to);
    } else {
      params.delete("from");
      params.delete("to");
    }
    params.delete("page");
    const query = params.toString();
    const href = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
    startTransition(() => router.replace(href, { scroll: false }));
  };

  // Arriving with dates keeps them for next time; arriving without, the ones kept come back
  // while they haven't passed.
  useEffect(() => {
    if (dates.from && dates.to) {
      remember(slug, { from: dates.from, to: dates.to });
      return;
    }
    const saved = remembered(slug);
    if (saved && saved.from >= localTodayIso() && saved.to >= saved.from) go(saved);
    else if (saved) remember(slug, null);
    // Once, on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The calendar opens in a dialog whose OK applies the picks; the X clears at once. From sm the bar is only
  // as long as the dates, one width so it doesn't jump between "All dates" and a range; on a phone, only as
  // wide as what it shows.
  return (
    <div className="card-edge w-fit min-w-56 max-w-full rounded-frame bg-surface text-foreground shadow-float sm:w-80">
      <DateRangeField
        row
        modal
        label="When"
        placeholder="All dates"
        from={range.from}
        to={range.to}
        min={localTodayIso()}
        clearable
        onChange={(next) => {
          setRange(next);
          if (!next.from && !next.to) {
            remember(slug, null);
            go(null);
          } else if (next.from && next.to) {
            remember(slug, next);
            go(next);
          }
        }}
        className="rounded-[inherit]"
        data-testid="book-dates"
      />
    </div>
  );
}

// Where the bar sits: between a page's banner and its sheet, pulled up and down by half its
// height so it lies across the seam, over both. z-36: it and its calendar stay over the banner
// (z-10) and the sheet's chips (z-20, z-35 on a phone), and under the header (z-40).
export function BookDatesSeam({ slug, dates }: { slug: string; dates: TripDates }) {
  return (
    <div className="relative z-36 -my-7 flex sm:-my-10 justify-center px-6">
      <BookDates slug={slug} dates={dates} />
    </div>
  );
}
