"use client";

import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { BookCardsPage, PlanGroup } from "@/api/discovery";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Dialog } from "@/components/ui/dialog";
import { Pager } from "@/components/ui/pager";
import { gapGroup, planGaps, stillMissing } from "@/components/trips/trip-missing";
import { useTripAdd } from "@/components/trips/trip-add-provider";
import { tripDatesQuery, withDates, type TripDates } from "@/components/trips/trip-dates";
import { useTripHere } from "@/components/trips/use-trip-here";
import { formatDateRange } from "@/lib/dates";
import { pricedByNote } from "@/lib/pricing";
import { BusinessRow } from "./business-row";
import { bookCardsOptions, bookCountsOptions, useBookCards } from "./book-cards";
import { LIST_PAGE, ROW_SIZE, type BookQuery, type BookSeed } from "./book-query";
import { businessHref, isTitleCard, offerOf, titleCardHref } from "./browse-offers";
import { BOOKING_GROUPS } from "./categories";
import { listingKey, MapHoverTarget, MapSwitch, useAreaMap } from "./area-map-context";
import { FilterButton } from "./filter-controls";
import { FilterMarkers, FilterPanel, sharedLabels } from "./filter-panel";
import { filtered, filterQuery, NO_FILTERS, setCount, type Facets, type Filters } from "./filters";
import { CategoryGlyph, ChevronGlyph, FeatureGlyph, GridGlyph } from "./tag-glyphs";
import { focusDock } from "./floating-dock";

// A What to book section: a guest group, its anchor (`need-<group>`), title and chip icon.
export type BookSection = { id: string; title: string; icon: string; group: PlanGroup };
type Card = BookCardsPage["cards"][number];

// What to book's held section order (see ListingBrowser), for this page only.
let heldOrder: { path: string; ids: string[] } | null = null;
const pathnameNow = () => (typeof window === "undefined" ? "" : window.location.pathname);
const heldOrderFor = (path: string) => (heldOrder && heldOrder.path === path ? heldOrder.ids : null);
// A card's row id, its anchor on the page.
const rowId = (section: BookSection, card: Card) => `${section.id}-card-${card.key}`;

// What to book on an area page (RAA-125): the sections above the listings, one row of chips with
// their counts under the intro, stuck under the header (2026-11-11: the rail on the left went,
// so the rows take the whole width), its icons and the map's Show map at its end from lg.
// Each section is one sideways row of tall cards (2026-11-11, the UX-laws review's choice
// overload): 3 in view, 6 loaded a page, the next 6 as the guest scrolls near its end or presses ›, and "Show all N",
// which opens the section's own page (`/<area>/book/<group>`, `mode="list"`) in a new tab: a grid
// of the same cards, 10 a page with the pager. "All" shows every section, a chip just one. The
// cards come from the API a page at a time (`book_cards`, useQueries: one per section's page),
// filtered and searched on the server, so a place with hundreds of listings never sends them all.
// The dates picked in the bar over the list (BookDates, in the URL and remembered) keep only what is free.
// Filters belong to one section (RAA-126), so a price set for a motorbike never hides a
// cottage: each title has a filter button opening them in a modal (What to book's for its
// category, FilterPanel), and what is set shows beside it as pills to remove, one row of them
// with "+N more" for the rest. Setting one under All picks that section.
// On an area page with its map, the map's pins follow the group and filters shown here, a row
// and its pin light up together, and a distance search narrows the rows to what is in range,
// nearest first, each with how far it is. `initial` is the group to open on (the home hero's
// category pills, RAA-130); one the area doesn't have opens on All, and says so. The chips stick
// under the search bar, so another section is always a tap away.
// `query`: a search typed on this page's search bar (`?q=`), which narrows every section to the
// listings matching it (on the server) and says so, with Clear search (`clearHref`) and a search of
// every place. `placeName` names the place in those lines. `seed`: the pages and chip counts the server fetched for
// the first view.
export function ListingBrowser({
  slug,
  sections,
  seed,
  dates,
  empty,
  initial,
  query,
  placeName,
  clearHref,
  gettingHere,
  tripPlaces = [],
  tripIsland,
  mode = "rows",
}: {
  slug: string;
  sections: BookSection[];
  seed: BookSeed;
  dates: TripDates;
  empty: ReactNode;
  initial?: string;
  query?: string;
  placeName?: string;
  clearHref?: string;
  // How a traveller reaches the place at all, said over Transfers.
  gettingHere?: { route: string; note: string };
  // The page's place and the places inside it: a section the guest's trip already has something
  // from here goes to the end, in the chips and the sections, so what the trip still lacks leads.
  tripPlaces?: string[];
  // The island this place is a town of, so its plan counts kinds from anywhere on it (coversHere).
  tripIsland?: string | null;
  // `rows`: What to book's sideways rows; `list`: a Show all page, one section 10 a page.
  mode?: "rows" | "list";
}) {
  const rows = mode === "rows";
  const dated = Boolean(dates.from && dates.to);
  const [current, setCurrent] = useState<string>(() => (initial && sections.some((section) => section.id === initial) ? initial : "all"));
  // The pages of 6 each row has loaded, the page a list is on, each section's filters, and a
  // listing a link points at (#listing-<id>): first asked for with `around` (`probing`), which
  // answers with the page holding it, then shown once the row or list has that page.
  const [loaded, setLoaded] = useState<Record<string, number>>({});
  const [pages, setPages] = useState<Record<string, number>>({});
  const [filters, setFilters] = useState<Record<string, Filters>>({});
  const [target, setTarget] = useState<number | null>(null);
  const [probing, setProbing] = useState(false);
  const linkTo = (id: number | null) => {
    setTarget(id);
    setProbing(id !== null);
  };
  const client = useQueryClient();
  const filtersOf = (id: string) => filters[id] ?? NO_FILTERS;
  const map = useAreaMap();
  const near = map?.near ?? null;
  const nearIds = near ? [...near.entries()].sort((a, b) => a[1] - b[1]).map(([id]) => id) : null;
  // A new distance search or new dates start every section over, as a new filter does: page 3 of
  // the old results may not exist in the new ones.
  const nearKey = `${nearIds?.join(",") ?? ""}|${dates.from}|${dates.to}`;
  const [pagedNear, setPagedNear] = useState(nearKey);
  if (pagedNear !== nearKey) {
    setPagedNear(nearKey);
    setPages({});
    setLoaded({});
  }

  // A section's query for one of its row's pages, or the list's page.
  const queryOf = (section: BookSection, page = 1): BookQuery => ({
    group: section.group,
    page: rows ? page : (pages[section.id] ?? 1),
    perPage: rows ? ROW_SIZE : LIST_PAGE,
    filters: filtersOf(section.id),
    q: query,
    around: probing && page === 1 ? target : null,
    near: nearIds,
    ...(dated ? { from: dates.from, to: dates.to } : {}),
    // A row's later pages: the section's filter sheet reads its first.
    ...(rows && page > 1 ? { facets: false as const } : {}),
  });
  const displayed = (section: BookSection) => current === "all" || current === section.id;
  // One query per page a row has loaded (a list has one).
  const slots = sections.flatMap((section) =>
    Array.from({ length: rows ? (loaded[section.id] ?? 1) : 1 }, (_, index) => ({ section, page: index + 1 })),
  );
  const results = useQueries({
    queries: slots.map(({ section, page }) => ({
      // A later page of a row never stands in with another page's cards while it loads.
      ...(page === 1
        ? bookCardsOptions(slug, queryOf(section, page), seed.pages.find((each) => each.query.group === section.group), client)
        : bookCardsOptions(slug, queryOf(section, page))),
      // Shown, or filtered (the chips count it); a distance search with nothing in range asks nothing.
      enabled: (displayed(section) || filtered(filters[section.id])) && !(nearIds && nearIds.length === 0),
    })),
  });
  const resultsOf = (section: BookSection) => slots.flatMap((slot, index) => (slot.section === section ? [results[index]] : []));
  const resultOf = (section: BookSection) => resultsOf(section)[0];
  const dataOf = (section: BookSection) => resultOf(section)?.data;
  // A section's cards so far: a row's pages one after another.
  const cardsOf = (section: BookSection) => {
    const seen = new Set<string>();
    return resultsOf(section)
      .flatMap((result) => result?.data?.cards ?? [])
      .filter((card) => !seen.has(card.key) && Boolean(seen.add(card.key)));
  };
  // The row's next 6, once the last page it asked for is in. The next page is counted from the
  // pages this render has, never added to: a fast swipe calls this several times before the row
  // re-renders, and each call adding one asked for up to 9 pages at once (2026-11-12).
  const loadMore = (section: BookSection) => {
    const pagesNow = resultsOf(section);
    const last = pagesNow.at(-1);
    const data = dataOf(section);
    if (!last?.data || last.isFetching || !data || cardsOf(section).length >= data.total) return;
    const next = pagesNow.length + 1;
    setLoaded((all) => ((all[section.id] ?? 1) >= next ? all : { ...all, [section.id]: next }));
  };
  // Its Show all page, with the search and the dates, which the guest's filters don't follow.
  const showAllHref = (section: BookSection) =>
    withDates(`/${slug}/book/${section.group}${query ? `?q=${encodeURIComponent(query)}` : ""}`, tripDatesQuery(dates));
  // Cards per group with the search and dates: one request for the page, which switching sections
  // or filtering never repeats.
  const counts = useQuery(bookCountsOptions(slug, { q: query, ...(dated ? { from: dates.from, to: dates.to } : {}) }, seed)).data;
  // A section's card count: its own total once filtered or in a distance search, else the counts.
  const countOf = (section: BookSection) => {
    if (nearIds && nearIds.length === 0) return 0;
    const own = dataOf(section);
    if ((filtered(filters[section.id]) || nearIds) && own) return own.total;
    return counts?.[section.group] ?? own?.total ?? 0;
  };
  const present = sections.filter((section) => (counts?.[section.group] ?? 0) > 0 || section.id === current);

  const { trip, has } = useTripHere(tripPlaces);
  // With a trip shown, the plan orders the sections: what it is missing here first (a stay for
  // its nights, a transfer, an item to replace; stillMissing, the banner's count), then the ideas
  // it has nothing of yet, then what it has, and gear, never needed, last. With none, Stays lead.
  const offered = present.map((section) => section.group);
  const gaps = trip ? stillMissing(planGaps(trip, tripPlaces ?? [], offered, [], tripIsland)) : [];
  const lacks = new Set<string>(gaps.map(gapGroup));
  const inTrip = (section: BookSection) => has.has(section.group) && !lacks.has(section.group);
  const rank = (section: BookSection) => (lacks.has(section.group) ? 0 : inTrip(section) ? 2 : section.group === "gear" ? 3 : 1);
  const stayFirst = (a: BookSection, b: BookSection) => Number(b.group === "stay") - Number(a.group === "stay");
  const planned = [...present].sort((a, b) => (trip ? rank(a) - rank(b) : 0) || stayFirst(a, b));
  // Once the guest starts an add, the sections keep their order until another is picked: a stay
  // just added would otherwise drop to the end with "what the trip has" and leave the guest
  // looking at scooters. The dots and ticks still update; only the order holds.
  const { busyListingId, lastAdded } = useTripAdd();
  // Kept outside the component too (heldOrder), as a first add signing a guest in can mount this
  // list afresh.
  const [frozen, setFrozen] = useState<string[] | null>(() => heldOrderFor(pathnameNow()));
  if (busyListingId !== null && frozen === null) setFrozen(planned.map((section) => section.id));
  useEffect(() => {
    heldOrder = frozen && { path: pathnameNow(), ids: frozen };
  }, [frozen]);
  const place = (section: BookSection) => (frozen && frozen.includes(section.id) ? frozen.indexOf(section.id) : Number.MAX_SAFE_INTEGER);
  const ordered = frozen ? [...planned].sort((a, b) => place(a) - place(b)) : planned;
  // The row just added comes back into view if it left it, and glows once (.just-added), so the
  // guest sees what changed: its In your trip badge and Add another.
  useEffect(() => {
    if (!lastAdded) return;
    const row = document.querySelector<HTMLElement>(`[data-listings~="${lastAdded.listingId}"]`);
    if (!row) return;
    const box = row.getBoundingClientRect();
    if (box.top < 0 || box.bottom > window.innerHeight) {
      const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      row.scrollIntoView({ block: "center", behavior: still ? "auto" : "smooth" });
    }
    row.classList.remove("just-added");
    void row.offsetWidth;
    row.classList.add("just-added");
  }, [lastAdded]);
  // Picking a section from the chips while scrolled into the list: the list gets
  // shorter, so the window would be left below it, on the next section. Back to its top instead.
  const root = useRef<HTMLDivElement>(null);
  const [picked, setPicked] = useState(0);
  const pick = (id: string) => {
    setCurrent(id);
    linkTo(null);
    setPicked((count) => count + 1);
  };
  useEffect(() => {
    if (picked === 0) return;
    const section = root.current?.closest("section") ?? root.current;
    if (section && section.getBoundingClientRect().top < 0) section.scrollIntoView({ block: "start" });
  }, [picked]);
  // Once another section is picked, its rows ease in (animate-swap-in), never on the first paint.
  const [seen, setSeen] = useState(current);
  const [switched, setSwitched] = useState(false);
  if (current !== seen) {
    setSeen(current);
    setSwitched(true);
    setFrozen(null);
  }
  // The home hero's shortcut to a group this place has nothing in.
  const missing =
    initial && counts && !present.some((section) => section.id === initial) ? BOOKING_GROUPS.find((group) => group.id === initial) : undefined;
  // The section whose filters are open.
  const [editing, setEditing] = useState<string | null>(null);
  // A link to a section (#need-<group>) picks it and scrolls to it. A link to a row
  // (#listing-<id>: a place to see's "1 tour goes here") asks every section for the page holding
  // it (`around`), shows it there, even past its section's first rows under All, then scrolls to
  // it. "Show all N" scrolls to the section it picks the same way.
  // A new object each time, so revealing the same row twice scrolls twice.
  const [reveal, setReveal] = useState<{ id: string } | null>(null);
  // The picked chip in view in a phone's sideways row (a shortcut can pick one past its edge),
  // scrolling the row only, never the page.
  const chipsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const row = chipsRef.current;
    const chip = row?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!row || !chip || row.scrollWidth <= row.clientWidth) return;
    row.scrollLeft = chip.offsetLeft - (row.clientWidth - chip.offsetWidth) / 2;
  }, [current]);
  // Read by the hash follower below, which runs on arrival and on a hash change only.
  const sectionsRef = useRef(sections);
  useEffect(() => {
    sectionsRef.current = sections;
  }, [sections]);
  useEffect(() => {
    const follow = () => {
      // A link or refresh at #listings (a search, a category, the nav's tab): What to book itself,
      // once the page has laid out, rather than the browser's own jump, which the banner's late
      // layout throws off.
      if (window.location.hash === "#listings") {
        setReveal({ id: "listings" });
        return;
      }
      // A link to a section (#need-stay: the trip card's "A place to stay") picks it.
      const section = sectionsRef.current.find((each) => `#${each.id}` === window.location.hash);
      if (section) {
        setCurrent(section.id);
        setReveal({ id: `${section.id}-top` });
        return;
      }
      const id = Number(/^#listing-(\d+)$/.exec(window.location.hash)?.[1]);
      if (id) linkTo(id);
    };
    follow();
    window.addEventListener("hashchange", follow);
    return () => window.removeEventListener("hashchange", follow);
  }, []);
  // A row linked to: once a section's answer to `around` holds it, its row loads up to that page
  // (a list turns to it), then the card is scrolled to, in the page and in its row. Settled while
  // rendering, as the answers come in.
  if (target !== null) {
    const holds = (card: Card) => card.listings.some((listing) => listing.id === target);
    if (probing) {
      const hit = sections.find((section) => !resultOf(section)?.isPlaceholderData && dataOf(section)?.cards.some(holds));
      const data = hit && dataOf(hit);
      if (hit && data) {
        if (current !== "all" && current !== hit.id) setCurrent(hit.id);
        if (rows) setLoaded((all) => ({ ...all, [hit.id]: Math.max(all[hit.id] ?? 1, data.page) }));
        else setPages((all) => ({ ...all, [hit.id]: data.page }));
        setProbing(false);
      }
    } else {
      const hit = sections.find(
        (section) => resultsOf(section).every((result) => result?.data && !result.isPlaceholderData) && cardsOf(section).some(holds),
      );
      if (hit) {
        setReveal({ id: rowId(hit, cardsOf(hit).find(holds)!) });
        setTarget(null);
      }
    }
  }
  useEffect(() => {
    if (reveal === null) return;
    document.getElementById(reveal.id)?.scrollIntoView({ block: "start", inline: "nearest" });
  }, [reveal]);
  const setFiltersOf = (id: string, next: Filters) => {
    setFilters((all) => ({ ...all, [id]: next }));
    setPages((all) => ({ ...all, [id]: 1 }));
    setLoaded((all) => ({ ...all, [id]: 1 }));
    linkTo(null);
  };
  // Another page: back to the section's top.
  const turnPage = (section: BookSection) => (page: number) => {
    setPages((all) => ({ ...all, [section.id]: page }));
    linkTo(null);
    setReveal({ id: `${section.id}-top` });
  };

  // Tell the map what is showing: the picked section's group, search, dates and filters (every
  // group under All, with the search and dates), which its pins are fetched with (useMapPins).
  const setView = map?.setView;
  const shownSection = sections.find((section) => section.id === current) ?? null;
  const mapQuery = JSON.stringify({
    ...(shownSection ? { group: shownSection.group, ...filterQuery(filtersOf(shownSection.id)) } : {}),
    ...(query ? { q: query } : {}),
    ...(dated ? { from: dates.from, to: dates.to } : {}),
  });
  useEffect(() => {
    setView?.({ group: shownSection?.group ?? null, query: JSON.parse(mapQuery) });
  }, [setView, shownSection?.group, mapQuery]);

  const total = ordered.reduce((sum, section) => sum + countOf(section), 0);
  // Under a search, only the sections it found something in (and the one picked).
  const options = [
    { id: "all", title: "All", icon: "", count: total, set: 0 },
    ...ordered
      .map((section) => ({ id: section.id, title: section.title, icon: section.icon, count: countOf(section), set: setCount(filtersOf(section.id)) }))
      .filter((option) => !query || option.count > 0 || option.id === current),
  ];
  // Under a search, All keeps to the sections with a match.
  const shown =
    current === "all" ? ordered.filter((section) => !query || countOf(section) > 0) : sections.filter((section) => section.id === current);
  // Arrived on a section from the home page's shortcuts: said once, with the way back to All.
  const opened = rows && initial && current === initial ? sections.find((section) => section.id === initial) : undefined;
  const editingSection = editing ? sections.find((section) => section.id === editing) : undefined;
  // Filters are a section's own: setting them under All picks it.
  const openFilters = (section: BookSection) => setEditing(section.id);

  return (
    <div ref={root} className="relative grid gap-5">
      <MapSkipLink />
      {/* The sections in one row under the intro, stuck under the header for the whole list (its */}
      {/* contents join the grid), with Show map at its end from lg. */}
      <aside aria-label="Filter what to book" className="contents">
        {present.length > 1 ? (
          <div
            ref={chipsRef}
            role="group"
            aria-label="Show"
            className={cn(
              // Stuck under the header (which holds the search). On a phone its background reaches
              // up under the header's foot (z-35, under the header's z-40), so no row shows through
              // the 12px between them.
              "sticky top-(--chrome) z-20 -mx-inset -my-2 flex items-center gap-1.5 overflow-x-auto bg-surface-2 px-inset py-2 [scrollbar-width:none] max-search:top-[calc(var(--chrome)_-_1.25rem)] max-search:-mt-5 max-search:z-35 max-search:pt-5 lg:gap-2",
            )}
          >
            {options.map((option) => {
              const on = option.id === current;
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => pick(option.id)}
                  className={cn(
                    // Each a chip, so the row reads as something to tap on the pale section.
                    "flex min-h-11 shrink-0 items-center gap-2 rounded-chip px-3.5 text-sm whitespace-nowrap transition-colors duration-150 ease-calm lg:px-4",
                    on
                      ? "bg-primary font-semibold text-white"
                      : // A flat grey tag, as the row's facts are: the outlined teal is for buttons.
                        "bg-tag font-medium text-navy hover:bg-lagoon-tint",
                  )}
                >
                  {/* The icon from lg, where the row has room for it. */}
                  <span aria-hidden className="hidden lg:flex">
                    {option.icon ? <CategoryGlyph name={option.icon} className="size-4" /> : <GridGlyph className="size-4" />}
                  </span>
                  <span className="flex items-center gap-1.5">
                    {option.title}
                    {option.set > 0 && (
                      <span className={cn("ml-1.5 text-xs font-medium", on ? "text-white/80" : "text-muted")}>
                        · {option.set} {option.set === 1 ? "filter" : "filters"}
                      </span>
                    )}
                  </span>
                  <span className={cn("tabular-nums", on ? "text-white/80" : "text-muted")}>{option.count}</span>
                </button>
              );
            })}
            <MapSwitch />
            {/* A fade at the row's right edge while it scrolls, so a cut-off chip reads as more. */}
            <span
              aria-hidden
              className="pointer-events-none sticky -right-inset -ml-1.5 w-12 shrink-0 self-stretch bg-linear-to-l from-surface-2 from-30% to-transparent"
            />
          </div>
        ) : (
          <div className="flex">
            <MapSwitch />
          </div>
        )}
      </aside>
      <div className="flex min-w-0 flex-col gap-8">
        {missing && current === "all" && (
          <p role="status" className="text-sm text-muted">
            Nothing in {missing.title} here yet, so here is everything else.
          </p>
        )}
        {query && counts && <SearchedLine query={query} count={total} placeName={placeName} clearHref={clearHref} />}
        {!query && opened && (
          <p role="status" data-testid="opened-group" className="flex flex-wrap items-center gap-x-3 text-sm text-muted">
            <span>
              Showing <span className="font-semibold text-foreground">{opened.title}</span>
              {placeName && <> on {placeName}</>}
            </span>
            <TextButton onClick={() => pick("all")} className="min-h-11">
              Show everything
            </TextButton>
          </p>
        )}
        {counts && shown.length === 0
          ? !query &&
            (dated ? (
              <p className="rounded-card bg-surface p-4 text-sm text-muted card-edge">Nothing here is free on these dates. Try other dates.</p>
            ) : (
              empty
            ))
          : shown.map((section, sectionIndex) => {
              const result = resultOf(section);
              const data = result?.data;
              const set = setCount(filtersOf(section.id));
              const clear = () => setFiltersOf(section.id, NO_FILTERS);
              const shared = data?.facets ? sharedLabels(data.facets) : [];
              const note = data?.facets?.unpriced_booking_type ? pricedByNote(data.facets.unpriced_booking_type) : undefined;
              const cards = cardsOf(section);
              const busy = result?.isPlaceholderData;
              const more = Boolean(rows && data && cards.length < data.total);
              const fetchingMore = rows && resultsOf(section).slice(1).some((each) => !each?.data);
              return (
                <div
                  // Keyed by the pick too, so a new pick plays the rows' arrival again.
                  key={`${current}-${section.id}`}
                  id={`${section.id}-top`}
                  className={cn(
                    "flex scroll-mt-(--chrome) flex-col gap-3",
                    // A hairline between categories, none above the first.
                    sectionIndex > 0 && "border-t border-line pt-8",
                    switched && "animate-swap-in",
                  )}
                  style={switched ? { animationDelay: `${Math.min(sectionIndex, 3) * 60}ms` } : undefined}
                >
                  {/* On a phone the pills take a row of their own under the title. */}
                  <div className="flex min-w-0 flex-wrap items-center gap-2.5 sm:flex-nowrap">
                    <div className="flex shrink-0 items-center gap-2.5">
                      <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-xl bg-mist text-primary">
                        {section.icon ? <CategoryGlyph name={section.icon} className="size-5" /> : <GridGlyph className="size-5" />}
                      </span>
                      <h3 id={section.id} className="scroll-mt-36 font-display text-xl font-extrabold tracking-tight sm:text-2xl">
                        {section.title}
                      </h3>
                    </div>
                    <FilterButton title={section.title} set={set} onClick={() => openFilters(section)} testId="section-filter" />
                    {set > 0 && (
                      <>
                        <FilterMarkers
                          title={section.title}
                          filters={filtersOf(section.id)}
                          facets={data?.facets ?? undefined}
                          onChange={(next) => setFiltersOf(section.id, next)}
                          onMore={() => openFilters(section)}
                        />
                        <TextButton onClick={clear} className="ml-auto shrink-0 text-sm sm:ml-0" />
                      </>
                    )}
                  </div>
                  {section.group === "transfer" && gettingHere && (
                    <div data-testid="getting-here" className="flex max-w-prose items-start gap-3 rounded-control border border-line bg-surface p-3">
                      <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-xl bg-mist text-primary">
                        <FeatureGlyph name="route" className="size-5" />
                      </span>
                      <div className="flex min-w-0 flex-col gap-0.5 text-sm">
                        <p className="font-semibold">Getting here</p>
                        <p className="text-pretty">{gettingHere.route}</p>
                        <p className="text-pretty text-muted">{gettingHere.note}</p>
                      </div>
                    </div>
                  )}
                  {shared.length > 0 && (
                    <p className="-mt-1 flex flex-wrap items-center gap-1.5 text-sm text-muted">
                      All have:
                      {shared.map((chip) => (
                        // Cancellation is trust, in green, as on the rows.
                        <Badge key={chip} tone={/cancel/i.test(chip) ? "emerald" : "fact"} className="min-h-6 px-2.5 text-xs">
                          {chip}
                        </Badge>
                      ))}
                    </p>
                  )}
                  {note && <p className="-mt-1 max-w-prose text-sm text-pretty text-muted">{note}</p>}
                  {dated && data && data.total > 0 && (
                    <p className="-mt-1 text-sm text-muted" data-testid="free-on-dates">
                      {data.total} free on {formatDateRange(dates.from, dates.to)}
                    </p>
                  )}
                  {!data && !(nearIds && nearIds.length === 0) ? (
                    result?.isError ? (
                      <p className="text-sm text-muted">Couldn&apos;t load these just now. Try again in a moment.</p>
                    ) : (
                      <RowsSkeleton count={rows ? 3 : 4} />
                    )
                  ) : cards.length > 0 ? (
                    <CardRow
                      rows={rows}
                      count={cards.length}
                      more={more}
                      loading={fetchingMore}
                      coming={data ? Math.max(1, Math.min(ROW_SIZE, data.total - cards.length)) : 1}
                      onMore={() => loadMore(section)}
                      title={section.title}
                      className={cn("transition-opacity duration-300 ease-calm", rows && busy && "opacity-60")}
                      busy={busy}
                    >
                      {cards.map((card, rowIndex) => (
                        // A search suggestion links straight to its row (#listing-<id>).
                        // A container, so the row lays itself out by its own width: beside the map
                        // it is narrower than the window says.
                        <li
                          key={card.key}
                          id={rowId(section, card)}
                          data-listings={card.listings.map((listing) => listing.id).join(" ")}
                          className={cn(
                            "@container flex scroll-mt-36 flex-col",
                            rows && ROW_CARD,
                            switched && "animate-swap-in",
                          )}
                          style={switched ? { animationDelay: `${Math.min(sectionIndex * 3 + rowIndex + 1, 6) * 60}ms` } : undefined}
                        >
                          {near && (
                            <p className="mb-1.5 px-1 text-sm font-semibold text-primary">
                              {Math.min(...card.listings.map((listing) => near.get(listing.id) ?? 0)).toFixed(1)} km from your pin
                            </p>
                          )}
                          {/* Each row a white card on the pale sheet, so its edge shows at rest, not only when lit. */}
                          <MapHoverTarget
                            pin={card.listings.map((listing) => listingKey(listing.id))}
                            className="flex-1 border border-line bg-surface p-3 shadow-soft"
                          >
                            <BookRow card={card} section={section} slug={slug} dates={dates} shared={shared} />
                          </MapHoverTarget>
                        </li>
                      ))}
                    </CardRow>
                  ) : null}
                  {/* Its own page in a new tab, the whole section 10 a page. */}
                  {rows && data && data.total > ROW_SIZE && (
                    <ButtonLink
                      href={showAllHref(section)}
                      target="_blank"
                      rel="opener"
                      variant="soft"
                      size="touch"
                      arrow
                      data-testid="show-all"
                      aria-label={`Show all ${data.total} in ${section.title} (opens in a new tab)`}
                      className="self-start"
                    >
                      Show all {data.total} in {section.title}
                    </ButtonLink>
                  )}
                  {!rows && data && <Pager page={data.page} perPage={data.per_page} total={data.total} onPage={turnPage(section)} />}
                  {((data && data.total === 0) || (nearIds && nearIds.length === 0)) && (
                    <p className="rounded-card bg-surface p-4 text-sm text-muted card-edge">
                      {nearIds ? (
                        "Nothing in this section is within that distance of your pin."
                      ) : dated && !query && set === 0 ? (
                        "Nothing in this section is free on these dates. Try other dates."
                      ) : set > 0 ? (
                        <>
                          Nothing here matches these filters. <TextButton onClick={clear} />
                        </>
                      ) : (
                        <>Nothing in {section.title} matches “{query}”.</>
                      )}
                    </p>
                  )}
                </div>
              );
            })}
      </div>
      {editingSection && (
        <BookFilterDialog
          slug={slug}
          section={editingSection}
          base={queryOf(editingSection)}
          facets={dataOf(editingSection)?.facets ?? undefined}
          filters={filtersOf(editingSection.id)}
          onApply={(next) => {
            setFiltersOf(editingSection.id, next);
            setEditing(null);
            if (current !== editingSection.id) pick(editingSection.id);
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

// One card: its listings as BusinessRow shows them, built from the API's rows as the place's page
// builds its own (offerOf). A stay's opens its business's page, any other its cheapest listing's.
function BookRow({ card, section, slug, dates, shared }: { card: Card; section: BookSection; slug: string; dates: TripDates; shared: string[] }) {
  const listings = card.listings;
  const first = listings[0];
  const offers = listings.map((listing) => offerOf(listing, { dates, pageSlug: slug, groupTitle: section.title }));
  // Its place, when all its listings here are in one place inside this one.
  const place = listings.every((listing) => listing.area_slug === first.area_slug) && first.area_slug !== slug ? `in ${first.area_name}` : undefined;
  return (
    <BusinessRow
      name={first.business.name}
      title={isTitleCard(first) ? first.title : undefined}
      href={isTitleCard(first) ? titleCardHref(listings, dates, slug) : businessHref(first.business.id, dates, section.id, slug)}
      place={place}
      groupTitle={section.title}
      offers={offers}
      sharedChips={shared}
      tall
    />
  );
}

// A section's filters in a sheet: What to book's panel for its category (FilterPanel), its
// counts from the API with the filters as edited, and "Show N results". Closes freely.
function BookFilterDialog({
  slug,
  section,
  base,
  facets,
  filters,
  onApply,
  onClose,
}: {
  slug: string;
  section: BookSection;
  base: BookQuery;
  facets?: Facets;
  filters: Filters;
  onApply: (next: Filters) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(filters);
  const matching = useBookCards(slug, { ...base, page: 1, perPage: 1, around: null, filters: draft });
  const count = matching.data?.total;
  const shownFacets = matching.data?.facets ?? facets;
  return (
    <Dialog
      open
      placement="sheet"
      title={section.title}
      meta="Filter what shows here"
      onClose={onClose}
      data-testid="filter-dialog"
      summary={
        setCount(draft) > 0 && (
          <TextButton onClick={() => setDraft(NO_FILTERS)} className="text-sm">
            Clear all
          </TextButton>
        )
      }
      actions={
        <Button type="button" data-testid="filter-apply" loading={count === undefined} onClick={() => onApply(draft)}>
          {count === undefined ? "Show results" : `Show ${count} ${count === 1 ? "result" : "results"}`}
        </Button>
      }
    >
      {shownFacets ? (
        <FilterPanel group={section.group} facets={shownFacets} filters={draft} onChange={setDraft} />
      ) : (
        <RowsSkeleton count={3} />
      )}
    </Dialog>
  );
}

// Cards on their way: grey blocks the size of a tall card, in a row (or a sheet's list).
function RowsSkeleton({ count }: { count: number }) {
  return (
    <div aria-hidden className="flex gap-3 overflow-hidden">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="h-96 w-64 shrink-0 rounded-card bg-mist motion-safe:animate-pulse" />
      ))}
    </div>
  );
}

// One of a row's next cards while its page loads: the tall card's frame, photo and lines in grey,
// so › moves on at once and the cards fill in where they stand. In a grid (`grid`) it takes the
// cell's width, standing in for the page being left while the next one loads.
export function RowCardSkeleton({ grid = false }: { grid?: boolean }) {
  const bar = "rounded-full bg-mist";
  return (
    <li aria-hidden className={cn(!grid && ROW_CARD, "flex flex-col")}>
      <div className="flex flex-1 flex-col gap-3 rounded-card border border-line bg-surface p-3 shadow-soft motion-safe:animate-pulse">
        <div className="aspect-[4/3] rounded-xl bg-mist" />
        <div className="flex flex-col gap-2.5 px-1">
          <div className={cn(bar, "h-5 w-4/5")} />
          <div className={cn(bar, "h-4 w-1/2")} />
          <div className="flex gap-2">
            <div className={cn(bar, "h-7 w-24")} />
            <div className={cn(bar, "h-7 w-20")} />
          </div>
          <div className={cn(bar, "mt-4 h-6 w-2/5")} />
          <div className={cn(bar, "h-11 w-32")} />
        </div>
      </div>
    </li>
  );
}

// A section's cards: on What to book one sideways row (`rows`), swiped on a phone, with ‹ › over
// its ends from sm; scrolling near its end, or › at it, asks for the next 6 (`onMore`). On a Show
// all page a grid, 10 a page, two rows of five on a wide screen.
function CardRow({
  rows,
  count,
  more,
  loading,
  coming,
  onMore,
  title,
  busy,
  className,
  children,
}: {
  rows: boolean;
  count: number;
  more: boolean;
  loading: boolean;
  // How many cards the page on its way holds: as many skeletons stand in for them.
  coming: number;
  onMore: () => void;
  title: string;
  busy?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const list = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });
  // › pressed at the end: scroll on as soon as the row grows (skeletons, or cards from the cache).
  const pending = useRef(false);
  const measure = () => {
    const row = list.current;
    if (!row) return;
    const start = row.scrollLeft <= 4;
    const end = row.scrollLeft + row.clientWidth >= row.scrollWidth - 4;
    setEdges((was) => (was.start === start && was.end === end ? was : { start, end }));
    // Within half a screen of the end: the next 6.
    if (more && !loading && row.scrollLeft > 0 && row.scrollLeft + row.clientWidth >= row.scrollWidth - row.clientWidth / 2) onMore();
  };
  useLayoutEffect(() => {
    if (!rows) return;
    const row = list.current;
    if (!row) return;
    if (pending.current) {
      pending.current = false;
      row.scrollBy({ left: stride(row), behavior: still() ? "auto" : "smooth" });
    }
    const start = row.scrollLeft <= 4;
    const end = row.scrollLeft + row.clientWidth >= row.scrollWidth - 4;
    setEdges((was) => (was.start === start && was.end === end ? was : { start, end }));
  }, [rows, count, loading]);
  const step = (direction: 1 | -1) => {
    const row = list.current;
    if (!row) return;
    // Less than a row's width left to show: ask for the next 6 and move on onto their skeletons
    // (already there while a page is loading).
    if (direction === 1 && more && !loading && row.scrollWidth - row.scrollLeft - row.clientWidth < row.clientWidth) {
      pending.current = true;
      onMore();
      return;
    }
    row.scrollBy({ left: direction * stride(row), behavior: still() ? "auto" : "smooth" });
  };

  if (!rows) {
    return (
      <ul aria-busy={busy || undefined} className={cn("grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5", className)}>
        {/* Another page on its way: skeletons where the cards go, not the old page dimmed. */}
        {busy ? Array.from({ length: count }, (_, index) => <RowCardSkeleton key={index} grid />) : children}
      </ul>
    );
  }
  const arrow = "absolute top-1/3 z-20 hidden size-11 items-center justify-center rounded-full bg-surface text-navy shadow-lift card-edge-line sm:flex hover:bg-mist";
  return (
    <div className="relative @container">
      <ul
        ref={list}
        aria-busy={busy || loading || undefined}
        aria-label={title}
        onScroll={measure}
        className={cn(
          // Room for the cards' shadows, which the sideways scroll would clip.
          "-mx-1 -my-2 flex snap-x snap-mandatory scroll-px-1 gap-3 overflow-x-auto overscroll-x-contain px-1 py-2 [scrollbar-width:none]",
          className,
        )}
      >
        {children}
        {loading && Array.from({ length: coming }, (_, index) => <RowCardSkeleton key={index} />)}
      </ul>
      {!edges.start && (
        <button type="button" aria-label={`Back in ${title}`} onClick={() => step(-1)} className={cn(arrow, "-left-3")} data-testid="row-prev">
          <ChevronGlyph direction="left" className="size-5" />
        </button>
      )}
      {(!edges.end || more) && (
        <button type="button" aria-label={`More in ${title}`} onClick={() => step(1)} className={cn(arrow, "-right-3")} data-testid="row-next">
          <ChevronGlyph direction="right" className="size-5" />
        </button>
      )}
    </div>
  );
}

// A card's width in a row: most of a phone with the next peeking, two and a bit from a 32rem row,
// exactly three from 48rem, so › moves on by three.
const ROW_CARD =
  "w-[82%] shrink-0 snap-start @lg:w-[calc((100%_-_0.75rem)/2.15)] @3xl:w-[calc((100%_-_1.5rem)/3)]";

// A whole row's width and the gap after it, so › moves on by exactly the cards in view.
const stride = (row: HTMLElement) => row.clientWidth + 12;
const still = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// A search typed on the page, said back: how many matched here, Clear search, and the same search
// in every place, which is where a place with nothing for it sends the guest.
function SearchedLine({
  query,
  count,
  placeName,
  clearHref,
}: {
  query: string;
  count: number;
  placeName?: string;
  clearHref?: string;
}) {
  const where = placeName ? ` on ${placeName}` : "";
  const everywhere = `/search?q=${encodeURIComponent(query)}`;
  return (
    <div
      role="status"
      data-testid="searched-line"
      className={cn(
        "flex flex-col gap-2 rounded-card p-4 text-sm card-edge sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4",
        count > 0 ? "bg-mist" : "bg-surface",
      )}
    >
      <p className="min-w-0 flex-1 text-pretty text-foreground">
        {count > 0 ? (
          <>
            <span className="font-semibold">
              {count} {count === 1 ? "match" : "matches"} for “{query}”
            </span>
            {where}
          </>
        ) : (
          <>
            <span className="font-semibold">Nothing{where} matches “{query}” yet.</span> Other places may have it.
          </>
        )}
      </p>
      <span className="flex flex-wrap items-center gap-x-4">
        <Link href={everywhere} className="flex min-h-11 items-center font-semibold text-link underline-offset-4 hover:underline">
          Search all places
        </Link>
        {clearHref && (
          <Link
            href={clearHref}
            scroll={false}
            className="flex min-h-11 items-center font-semibold text-link underline-offset-4 hover:underline"
          >
            Clear search
          </Link>
        )}
      </span>
    </div>
  );
}

function TextButton({ onClick, children = "Clear", className }: { onClick: () => void; children?: ReactNode; className?: string }) {
  return (
    <button type="button" onClick={onClick} className={cn("font-semibold text-link underline-offset-4 hover:underline", className)}>
      {children}
    </button>
  );
}

// For the keyboard on a phone, first in What to book: the Map button sits in the floating dock,
// last on the page after the footer. Hidden until focused, like Skip to content, and then shown
// where it is, over What to book's first row. Not from lg, where the map has its Show map at the
// end of the sections' chips, and not for the plan, whose chip comes right after it. On an area
// page only (the map's provider), where the dock is.
function MapSkipLink() {
  if (!useAreaMap()) return null;
  return (
    <a
      href="#floating-dock"
      onClick={(event) => {
        if (focusDock()) event.preventDefault();
      }}
      className="focus-light sr-only rounded-full bg-white font-bold text-navy shadow-lift focus:not-sr-only lg:hidden focus:absolute focus:top-0 focus:left-0 focus:z-30 focus:px-5 focus:py-3"
    >
      Skip to the map
    </a>
  );
}
