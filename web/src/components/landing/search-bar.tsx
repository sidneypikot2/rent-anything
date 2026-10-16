"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { SearchBox } from "@/components/discovery/search-box";
import { SearchGlyph } from "@/components/discovery/tag-glyphs";
import { readTripDates } from "@/components/trips/trip-dates";
import { Dialog } from "@/components/ui/dialog";
import { formatDateRange } from "@/lib/dates";
import { useCurrentPlace } from "./current-place";

// The search under every guest page's banner but the home hero, which holds it itself
// (RAA-126): where, when and with whom, filled in from the page, so a guest can change their
// mind from anywhere. It scrolls up with the page until it meets the header, then sticks 8px
// under it; `--chrome` (globals.css) is how far down that reaches, for the anchor offset. From
// sm it is one row; on a phone a pill that opens the same search in a sheet.
export function SearchBar() {
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);

  // `--chrome` from the bar as it is (fonts, a long place), not just the estimate in
  // globals.css that holds it until now: where it sticks, its height and 12px.
  useEffect(() => {
    const bar = ref.current;
    if (!bar) return;
    const root = document.documentElement;
    const observer = new ResizeObserver(() => {
      const top = parseFloat(getComputedStyle(bar).top) || 0;
      root.style.setProperty("--chrome", `${top + bar.offsetHeight + 12}px`);
    });
    observer.observe(bar);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--chrome");
    };
  }, []);

  return (
    // One block from the banner and from the first section (the sheet's pt-block), less the
    // banner's own foot padding. The strip beside the bar lets clicks through.
    <div
      ref={ref}
      data-search-bar
      className="pointer-events-none sticky top-20 z-30 mt-[max(0px,calc(var(--spacing-block)-0.75rem))] px-3 sm:mt-[max(0px,calc(var(--spacing-block)-1.5rem))] sm:px-6"
    >
      {/* Holds the bar's height until the URL can be read, so the page doesn't move. */}
      <Suspense fallback={<div className="mx-auto h-11 max-w-3xl sm:h-[3.875rem]" />}>
        <SearchBarContent pathname={pathname} />
      </Suspense>
    </div>
  );
}

function SearchBarContent({ pathname }: { pathname: string }) {
  const params = useSearchParams();
  const place = useCurrentPlace();
  const dates = readTripDates(Object.fromEntries(params));
  const onSearch = pathname === "/search";
  const query = onSearch ? (params.get("q") ?? "").trim() : (place ?? "");
  const here = !onSearch && place ? { name: place, href: pathname } : undefined;
  // Whatever the bar was opened for; a new page or new dates close the sheet and refill the bar.
  const key = `${pathname}?${params.toString()}|${place ?? ""}`;
  const [openFor, setOpenFor] = useState<string | null>(null);
  const open = openFor === key;
  const box = (
    <SearchBox key={key} bar initialQuery={query} initialDates={dates} here={here} onDone={() => setOpenFor(null)} />
  );

  return (
    <div className="pointer-events-auto mx-auto max-w-3xl" data-testid="search-bar">
      <div className="max-sm:hidden">{box}</div>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => setOpenFor(key)}
        data-testid="search-bar-pill"
        className="flex min-h-11 w-full items-center gap-2.5 card-edge rounded-full bg-surface/90 px-4 text-left text-sm text-foreground shadow-lift backdrop-blur-xl sm:hidden"
      >
        <SearchGlyph className="size-4.5 shrink-0 text-primary" />
        <span className="min-w-0 truncate">
          <span className="font-semibold">{query || "Where to?"}</span>
          <span className="text-muted">
            {" · "}
            {formatDateRange(dates.from, dates.to) ?? "Add dates"}
            {" · "}
            {dates.guests === 1 ? "1 guest" : `${dates.guests} guests`}
          </span>
        </span>
      </button>
      {open && (
        <Dialog open placement="sheet" title="Search" onClose={() => setOpenFor(null)}>
          {box}
        </Dialog>
      )}
    </div>
  );
}
