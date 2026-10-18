"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { SearchBox } from "@/components/discovery/search-box";
import { ChevronGlyph, SearchGlyph } from "@/components/discovery/tag-glyphs";
import { readTripDates } from "@/components/trips/trip-dates";
import { cn } from "@/components/ui/cn";
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
      <Suspense fallback={<div className="mx-auto h-12 max-w-page px-inset search:h-16" />}>
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
  const dateLabel = formatDateRange(dates.from, dates.to);
  const guestsLabel = dates.guests === 1 ? "1 guest" : `${dates.guests} guests`;
  const box = (
    <SearchBox key={key} bar initialQuery={query} initialDates={dates} here={here} onDone={() => setOpenFor(null)} />
  );

  return (
    // As wide as the page's content under it (the sheet's max-w-page less its inset), so its
    // edges line up with What to book's rail and listings.
    <div className="pointer-events-auto mx-auto max-w-page px-inset" data-testid="search-bar">
      <div className="max-search:hidden">{box}</div>
      <SearchPill where={query} dateLabel={dateLabel} guestsLabel={guestsLabel} onClick={() => setOpenFor(key)} />
      {open && (
        <Dialog open placement="sheet" title="Search" onClose={() => setOpenFor(null)}>
          {box}
        </Dialog>
      )}
    </div>
  );
}

// The route folded to one line, for a phone: the place, the dates and, where there's room, the
// guests as joined stops, and the search's round button. It opens the search in a sheet,
// here and in the home hero. `summary` (the hero's) drops the round button, as the hero has a
// button of its own under it, and ends on a chevron that says it opens.
export function SearchPill({
  where,
  dateLabel,
  guestsLabel,
  onClick,
  summary = false,
}: {
  summary?: boolean;
  where: string;
  dateLabel: string | null | undefined;
  guestsLabel: string;
  onClick: () => void;
}) {
  const rowRef = useRef<HTMLSpanElement>(null);
  const [guestsFit, setGuestsFit] = useState(true);

  // The guests show only when all three stops fit whole with the shortest space between them;
  // otherwise they step out, and the place is cut short only if it and the dates still don't fit.
  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const measure = () => {
      const labels = [...row.querySelectorAll<HTMLElement>("[data-stop-label]")];
      const need = labels.reduce((sum, label) => sum + label.scrollWidth + STOP_DOT, 0) + (labels.length - 1) * PATH_MIN;
      setGuestsFit(need <= row.clientWidth);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(row);
    document.fonts.ready.then(measure);
    return () => observer.disconnect();
  }, [where, dateLabel, guestsLabel]);

  return (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-label={`Edit search: ${where || "where to"}, ${dateLabel ?? "no dates yet"}, ${guestsLabel}`}
      onClick={onClick}
      data-testid="search-bar-pill"
      className={cn(
        "flex min-h-12 w-full items-center gap-3 card-edge rounded-full bg-surface/90 py-1.5 pl-4 text-left text-sm font-semibold text-navy shadow-lift backdrop-blur-xl search:hidden",
        summary ? "pr-3" : "pr-1.5",
      )}
    >
      <span ref={rowRef} className="relative flex min-w-0 flex-1 items-center">
        <MiniStop set={Boolean(where)} className="min-w-0 shrink">
          {where || "Where to?"}
        </MiniStop>
        <MiniPath traced={Boolean(where && dateLabel)} />
        <MiniStop set={Boolean(dateLabel)} className="shrink-0">
          {/* The hero's summary only shows what was picked, so it doesn't ask in blue as the bar does. */}
          {dateLabel ?? (summary ? "Any dates" : <span className="text-primary">Add dates +</span>)}
        </MiniStop>
        {/* Out of the row while it doesn't fit, but still measured. */}
        <span className={cn("flex items-center", guestsFit ? "flex-1" : "invisible absolute")}>
          <MiniPath traced={Boolean(dateLabel)} />
          <MiniStop set className="shrink-0">
            {guestsLabel}
          </MiniStop>
        </span>
      </span>
      {summary ? (
        <ChevronGlyph className="size-4 shrink-0 text-muted" />
      ) : (
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-white">
          <SearchGlyph className="size-4" />
        </span>
      )}
    </button>
  );
}

// A stop's dot and the gap after it (size-2, gap-1.5), and the shortest space between two stops
// (MiniPath's px-1.5 each side), in px.
const STOP_DOT = 14;
const PATH_MIN = 12;

function MiniStop({ set, className, children }: { set: boolean; className?: string; children: ReactNode }) {
  return (
    <span aria-hidden className={cn("flex items-center gap-1.5 whitespace-nowrap", className)}>
      <span className={cn("size-2 shrink-0 rounded-full", set ? "bg-navy" : "border-2 border-line-strong")} />
      <span data-stop-label className="min-w-0 truncate">
        {children}
      </span>
    </span>
  );
}

// The space between two stops, drawn as a line only while it has room for one. The spaces share
// the pill's spare width, so the stops spread evenly along it; with none to spare they close to
// a plain gap, so the dates and the guests keep their room before the line does.
function MiniPath({ traced }: { traced: boolean }) {
  return (
    <span aria-hidden className="@container min-w-0 flex-1 px-1.5">
      <span
        className={cn(
          "block h-0.5 @max-[1rem]:hidden",
          traced
            ? "bg-navy"
            : "bg-[repeating-linear-gradient(90deg,var(--color-line-strong)_0_4px,transparent_4px_8px)]",
        )}
      />
    </span>
  );
}
