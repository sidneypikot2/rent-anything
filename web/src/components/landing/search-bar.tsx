"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState, type ReactNode, type Ref } from "react";
import { SearchBox } from "@/components/discovery/search-box";
import { ChevronGlyph, GuestsGlyph, SearchGlyph } from "@/components/discovery/tag-glyphs";
import { readTripDates } from "@/components/trips/trip-dates";
import { cn } from "@/components/ui/cn";
import { Dialog } from "@/components/ui/dialog";
import { formatDateRange } from "@/lib/dates";
import { SearchHere, useCurrentPlace, usePageSearching, useRegisterEditSearch } from "./current-place";
import { guestsLabel } from "@/components/trips/format";

// Every guest page's banner but the home hero (which holds the search itself) and the cart's
// says the page has a search (RAA-126). The search itself is in the header (`HeaderSearch`):
// this only marks the page, for CSS (`data-search-bar`, so the server's render already shows
// it) and for the header once the page runs.
export function SearchBar() {
  return (
    <>
      <span data-search-bar hidden />
      <SearchHere />
    </>
  );
}

// The search in the guest header, on a page with one: a pill saying where, when and with whom,
// filled in from the page, so a guest can change their mind from anywhere without a form
// between the banner and the page. From the `search` breakpoint it sits between the logo and the
// cart and opens the one-row search as a panel under the header; on a phone it is the header's
// second row and opens the same search in a sheet. CSS shows it (globals.css), so the first
// paint has it. It measures the header for `--chrome`, how far down what sticks at the top
// reaches plus 12px, for anchors and anything sticking under it.
export function HeaderSearch() {
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const header = ref.current?.closest("header");
    if (!header) return;
    const root = document.documentElement;
    const observer = new ResizeObserver(() => root.style.setProperty("--chrome", `${header.offsetHeight + 12}px`));
    observer.observe(header);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--chrome");
    };
  }, []);

  return (
    <div
      ref={ref}
      data-header-search
      data-testid="search-bar"
      className="min-w-0 max-search:order-last max-search:basis-full search:flex-1"
    >
      {/* Holds the pill's height until the URL can be read, so the header doesn't move. */}
      <Suspense fallback={<div className="h-12 w-full search:h-11 search:max-w-xl" />}>
        <HeaderSearchContent pathname={pathname} />
      </Suspense>
    </div>
  );
}

// How far the page scrolls after the panel is opened before it closes.
const REFOLD_PX = 160;

function HeaderSearchContent({ pathname }: { pathname: string }) {
  const params = useSearchParams();
  const place = useCurrentPlace();
  const searching = usePageSearching();
  const dates = readTripDates(Object.fromEntries(params));
  const onSearch = pathname === "/search";
  // Where keeps naming the place on its own pages, even after a search there (`?q=`, which What
  // to book says back); on /search it holds what was searched.
  const query = onSearch ? (params.get("q") ?? "").trim() : (place?.name ?? "");
  const here = !onSearch && place ? { name: place.name, href: pathname, area: `/${place.slug}` } : undefined;
  // Whatever the search was opened for; a new page or new dates close it and refill the pill.
  const key = `${pathname}?${params.toString()}|${place?.name ?? ""}`;
  // Open for this search: as the panel under the header (`wide`) or a phone's sheet, from scroll `y`.
  const [opened, setOpened] = useState<{ key: string; wide: boolean; y: number } | null>(null);
  const open = opened?.key === key ? opened : null;
  const close = useCallback(() => setOpened(null), []);
  // A page asking for a stop (the area page's trip line): the search opens on it.
  // It holds for the search it was made in: new dates or another page drop it.
  const [request, setRequest] = useState<{ panel: "where" | "when" | "guests"; n: number; key: string }>();
  const wrapRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLButtonElement>(null);

  function openOn(panel?: "where" | "when" | "guests") {
    const wide = window.matchMedia(SEARCH_ROW).matches;
    // The panel starts in Where; a phone's sheet opens as it is unless a page asked for a stop.
    const stop = panel ?? (wide ? "where" : undefined);
    if (stop) setRequest((last) => ({ panel: stop, n: (last?.n ?? 0) + 1, key }));
    setOpened({ key, wide, y: window.scrollY });
  }
  useRegisterEditSearch(openOn, searching);

  // The panel closes on a click outside it, Escape, or once the page has scrolled on (unless
  // something in it has focus: a calendar, the guests).
  const panelOpen = Boolean(open?.wide);
  const openedY = open?.y ?? 0;
  useEffect(() => {
    if (!panelOpen) return;
    const wrap = wrapRef.current;
    const onPointer = (event: PointerEvent) => {
      if (!wrap?.contains(event.target as Node)) close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      close();
      pillRef.current?.focus();
    };
    const onScroll = () => {
      if (Math.abs(window.scrollY - openedY) < REFOLD_PX || wrap?.contains(document.activeElement)) return;
      close();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll);
    };
  }, [panelOpen, openedY, close]);

  const box = (
    <SearchBox
      key={key}
      bar
      initialQuery={query}
      initialDates={dates}
      here={here}
      request={request?.key === key ? request : undefined}
      onDone={close}
    />
  );

  return (
    <div ref={wrapRef} className="mx-auto w-full search:max-w-xl">
      <SearchPill
        ref={pillRef}
        where={query}
        dateLabel={formatDateRange(dates.from, dates.to)}
        guestsLabel={guestsLabel(dates.guests)}
        expanded={panelOpen}
        onClick={() => (open ? close() : openOn())}
        always
        className="search:min-h-11 search:py-1"
      />
      {/* Under the header, as wide as it, so the row lines up with the page's content. White
          inside: the header's text and focus ring are for navy. */}
      {open?.wide && (
        <div data-testid="search-panel" className="absolute inset-x-0 top-full mt-2 text-foreground [--focus:var(--color-primary)]">
          {box}
        </div>
      )}
      {open && !open.wide && (
        <Dialog open placement="sheet" title="Search" onClose={close}>
          {box}
        </Dialog>
      )}
    </div>
  );
}

// Where the search is one row rather than a sheet (globals.css's `search` breakpoint).
const SEARCH_ROW = "(min-width: 46.875rem)";

// The route folded to one line: the place, the dates and, where there's room, the guests as
// joined stops, and the search's round button. It opens the search, in the header and in the
// home hero (on a phone). `summary` (the hero's) drops the round button, as the hero has a
// button of its own under it, and ends on a chevron that says it opens.
export function SearchPill({
  where,
  dateLabel,
  guestsLabel,
  onClick,
  summary = false,
  always = false,
  expanded,
  className,
  ref,
}: {
  summary?: boolean;
  // Shown at every width (the header's), not only under the search breakpoint.
  always?: boolean;
  // Set when the pill opens a panel in place (the header's, from the search breakpoint).
  expanded?: boolean;
  className?: string;
  ref?: Ref<HTMLButtonElement>;
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
      ref={ref}
      type="button"
      aria-haspopup="dialog"
      aria-expanded={expanded}
      aria-label={`Edit search: ${where || "where to"}, ${dateLabel ?? "no dates yet"}, ${guestsLabel}`}
      onClick={onClick}
      data-testid="search-bar-pill"
      className={cn(
        "flex min-h-12 w-full items-center gap-3 card-edge rounded-full bg-surface py-1.5 pl-4 text-left text-sm font-semibold text-navy shadow-lift",
        !always && "search:hidden",
        summary ? "pr-3" : "pr-1.5",
        className,
      )}
    >
      <span ref={rowRef} className="@container relative flex min-w-0 flex-1 items-center">
        {/* The place shortens first. When the text is large for the room (the row under 11rem,
            which grows with the text size) only the dates stay, shortened if they must: the page
            under the header names its place, and the label above reads all three. */}
        <MiniStop set={Boolean(where)} className="min-w-12 shrink @max-[11rem]:hidden">
          {where || "Where to?"}
        </MiniStop>
        <MiniPath traced={Boolean(where && dateLabel)} className="@max-[11rem]:hidden" />
        <MiniStop set={Boolean(dateLabel)} className="min-w-0 shrink-0 @max-[11rem]:shrink">
          {/* The same words as the route's empty stop; the hero's summary doesn't ask in blue, as its
              own button under it is the action. */}
          {dateLabel ?? (summary ? "Add dates" : <span className="text-primary">Add dates +</span>)}
        </MiniStop>
        {/* Out of the row while it doesn't fit, but still measured; in its place the count alone,
            with the guests icon, so the search never loses who's going. */}
        <span className={cn("flex items-center", guestsFit ? "flex-1" : "invisible absolute")}>
          <MiniPath traced={Boolean(dateLabel)} />
          <MiniStop set className="shrink-0">
            {guestsLabel}
          </MiniStop>
        </span>
        {!guestsFit && (
          <span aria-hidden className="flex shrink-0 items-center gap-1 pl-2 whitespace-nowrap @max-[11rem]:hidden">
            <GuestsGlyph className="size-4 text-muted" />
            {guestsLabel.match(/\d+/)?.[0] ?? "1"}
          </span>
        )}
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
function MiniPath({ traced, className }: { traced: boolean; className?: string }) {
  return (
    <span aria-hidden className={cn("@container min-w-0 flex-1 px-1.5", className)}>
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
