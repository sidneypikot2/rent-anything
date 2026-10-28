"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckboxField } from "@/components/ui/checkbox-field";
import { cn } from "@/components/ui/cn";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { formatPeso } from "@/lib/money";
import { openPlan, usePlanSummary } from "@/components/trips/plan-open";
import { gapGroup, planGaps, stillMissing } from "@/components/trips/trip-missing";
import { useTripAdd } from "@/components/trips/trip-add-provider";
import { useTripHere } from "@/components/trips/use-trip-here";
import { ShownOffersContext } from "./business-row";
import { BOOKING_GROUPS } from "./categories";
import { listingKey, MapHoverTarget, MapSwitch, useAreaMap, useBesideMap } from "./area-map-context";
import type { Feature } from "./listing-features";
import { AlertGlyph, CategoryGlyph, CloseGlyph, FeatureGlyph, FilterGlyph, GridGlyph, ListGlyph, TickGlyph } from "./tag-glyphs";
import { focusDock } from "./floating-dock";
import { useFitRows } from "./use-fit-rows";

// A listing as the filters see it: its "from" price (null while it has none) and the chips it shows.
// `text`: what a search on the page matches (title, kind, partner, place, summary).
export type ListingOffer = {
  id: number;
  priceCents: number | null;
  priceUnit?: string | null;
  features: Feature[];
  text?: string;
};
// A row: a business with its listings in the group (the team's business-first list). `key` is
// its anchor, unique on the page; `content` is the card itself, rendered on the server, which
// shows only the listings the filters leave (ShownOffersContext).
export type ListingItem = { key: string; offers: ListingOffer[]; content: ReactNode };

// What to book's held section order (see ListingBrowser), for this page only.
let heldOrder: { path: string; ids: string[] } | null = null;
const pathnameNow = () => (typeof window === "undefined" ? "" : window.location.pathname);
const heldOrderFor = (path: string) => (heldOrder && heldOrder.path === path ? heldOrder.ids : null);
// `group` (a listing's `group`) tells the area map which pins the group's rows are.
// Under the section's title, once for all its rows: `gettingHere`, how a traveller reaches the
// place at all (Transfers, where they look for the ride); `shared`, the chips every row has
// ("All have"); `note`, one line on how the unpriced ones are priced.
export type ListingGroup = {
  id: string;
  title: string;
  icon: string;
  group?: string;
  gettingHere?: { route: string; note: string };
  shared?: string[];
  note?: string;
  items: ListingItem[];
};

// pets: only stays that take pets (RAA-186), offered in the stays section's filters alone.
type Filters = { free: boolean; pets: boolean; min: string; max: string; includes: string[] };
const NO_FILTERS: Filters = { free: false, pets: false, min: "", max: "", includes: [] };
// Includes listed before "Show all".
const FIRST_INCLUDES = 6;
// Chips that describe a listing (its size, its route, a tour's group) rather than say what comes
// with it: shown on the row, never offered under Includes.
// Pets allowed has its own Pet-friendly choice.
const NOT_INCLUDES = new Set(["guests", "seats", "luggage", "route", "engine", "sizes", "bed", "pets"]);
const takesPets = (offer: ListingOffer) => offer.features.some((feature) => feature.icon === "pets");
// Rows a section shows under "All" before its "Show all N": the page stays short enough to reach
// the places to see below it, on a phone too, and the section's own chip shows the rest.
const FIRST_ROWS = 3;

// A typed price as whole pesos, never below zero ("-5" and "12.5" become "0" and "12").
const wholePesos = (value: string) => (value === "" ? "" : String(Math.max(0, Math.floor(Number(value)) || 0)));

// A search typed on the page (`?q=`): every word somewhere in the listing's text, a plural
// matching its singular ("scooters" finds a scooter).
function matcher(query: string | undefined) {
  const words = (query ?? "")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => (word.length > 3 && word.endsWith("s") ? word.slice(0, -1) : word));
  if (words.length === 0) return null;
  return (offer: ListingOffer) => {
    const text = (offer.text ?? "").toLowerCase();
    return words.every((word) => text.includes(word));
  };
}

const setCount = (filters: Filters) =>
  Number(filters.free) + Number(filters.pets) + Number(Boolean(filters.min || filters.max)) + filters.includes.length;

function passes(item: ListingOffer, filters: Filters, skipIncludes = false) {
  if (filters.free && !item.features.some((feature) => feature.trust)) return false;
  if (filters.pets && !takesPets(item)) return false;
  const min = Number(filters.min) || 0;
  const max = Number(filters.max) || 0;
  if (min || max) {
    if (item.priceCents === null) return false;
    const pesos = item.priceCents / 100;
    if ((min && pesos < min) || (max && pesos > max)) return false;
  }
  if (skipIncludes) return true;
  const labels = item.features.map((feature) => feature.label);
  return filters.includes.every((label) => labels.includes(label));
}

// What to book on an area page (RAA-125): the sections beside the listings. From lg it is a
// rail on the left that stays in view under the header, the sections with their counts and
// the map's switch (the trip and its dates lead the page above it, AreaHero); on a phone the
// sections are a row of chips.
// "All" shows every section under its title; a section shows just its own, still titled.
// Filters belong to one section (RAA-126), so a price set for a motorbike never hides a
// cottage: each title has a filter button opening them in a modal, and what is set shows
// beside it as pills to remove, one row of them with "+N more" for the rest.
// On an area page with its map, the map's pins follow the group and filters shown here, a row
// and its pin light up together, and a distance search narrows the rows to what is in range,
// nearest first, each with how far it is. `initial` is the group to open on (the home hero's
// category pills, RAA-130); one the area doesn't have opens on All, and says so. Under All each
// section shows its first rows and a "Show all N" that picks it. On a phone the chips stick under
// the search bar, so another section is always a tap away; so they do from lg while the map is
// beside the sections, where a rail would leave the rows too narrow to read.
// `query`: a search typed on this page's search bar (`?q=`), which narrows every section to the
// listings matching it and says so, with Clear search (`clearHref`) and a search of every place.
// `placeName` names the place in those lines.
export function ListingBrowser({
  groups,
  empty,
  initial,
  query,
  placeName,
  clearHref,
  tripPlaces = [],
  tripIsland,
}: {
  groups: ListingGroup[];
  empty: ReactNode;
  initial?: string;
  query?: string;
  placeName?: string;
  clearHref?: string;
  // The page's place and the places inside it: a section the guest's trip already has something
  // from here goes to the end, in the rail and the sections, so what the trip still lacks leads.
  tripPlaces?: string[];
  // The island this place is a town of, so its plan counts kinds from anywhere on it (coversHere).
  tripIsland?: string | null;
}) {
  const { trip, has } = useTripHere(tripPlaces);
  // With a trip shown, the plan orders the sections: what it is missing here first (a stay for
  // its nights, a transfer, an item to replace; stillMissing, the banner's count), then the ideas
  // it has nothing of yet, then what it has, and gear, never needed, last. With none, Stays lead.
  const offered = groups.filter((group) => group.group && group.items.length > 0).map((group) => group.group!);
  const gaps = trip ? stillMissing(planGaps(trip, tripPlaces ?? [], offered, [], tripIsland)) : [];
  const lacks = new Set<string>(gaps.map(gapGroup));
  const inTrip = (group: ListingGroup) => Boolean(group.group && has.has(group.group) && !lacks.has(group.group));
  const rank = (group: ListingGroup) =>
    group.group && lacks.has(group.group) ? 0 : inTrip(group) ? 2 : group.group === "gear" ? 3 : 1;
  const stayFirst = (a: ListingGroup, b: ListingGroup) => Number(b.group === "stay") - Number(a.group === "stay");
  const planned = [...groups].sort((a, b) => (trip ? rank(a) - rank(b) : 0) || stayFirst(a, b));
  // Once the guest starts an add, the sections keep their order until another is picked: a stay
  // just added would otherwise drop to the end with "what the trip has" and leave the guest
  // looking at scooters. The dots and ticks still update; only the order holds.
  const { busyListingId, lastAdded } = useTripAdd();
  // Kept outside the component too (heldOrder), as a first add signs a guest in and the page
  // then swaps its sections (SectionOrder), mounting this list afresh.
  const [frozen, setFrozen] = useState<string[] | null>(() => heldOrderFor(pathnameNow()));
  if (busyListingId !== null && frozen === null) setFrozen(planned.map((group) => group.id));
  useEffect(() => {
    heldOrder = frozen && { path: pathnameNow(), ids: frozen };
  }, [frozen]);
  const place = (group: ListingGroup) => (frozen && frozen.includes(group.id) ? frozen.indexOf(group.id) : Number.MAX_SAFE_INTEGER);
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
  // "a transfer", "a place to stay": what a section gives the trip, for its "still needs" line.
  const needOf = (group: ListingGroup) => {
    const need = BOOKING_GROUPS.find((each) => each.group === group.group)?.need ?? group.title;
    return need.charAt(0).toLowerCase() + need.slice(1);
  };
  // What a section's "still needs" line says. A stay or transfer the trip lacks is named as a need;
  // when the section's only gaps are items already in the trip that can't be had (fully booked on
  // their dates, or no date yet), the line names them instead: their nights may well be covered,
  // and "still needs a place to stay" would send the guest looking for a stay they already have.
  const neededLine = (group: ListingGroup) => {
    const here = gaps.filter((gap) => gapGroup(gap) === group.group);
    if (here.some((gap) => gap.kind === "stay" || gap.kind === "need")) return `Your trip still needs ${needOf(group)}`;
    const items = here.flatMap((gap) => (gap.kind === "unavailable" || gap.kind === "undated" ? [gap] : []));
    if (items.length === 1) {
      const [gap] = items;
      return `${gap.item.listing.title}: ${gap.kind === "unavailable" ? gap.reason : "no date yet"}`;
    }
    if (items.length > 1) return `${items.length} in your trip can't be booked as they are. See Your plan`;
    return `Your trip still needs ${needOf(group)}`;
  };
  // A chip's mark: a dot for what's missing, a tick for what the trip has.
  const markOf = (group: ListingGroup) => (group.group && lacks.has(group.group) ? "missing" : inTrip(group) ? "has" : undefined);
  const planSummary = usePlanSummary();
  const [current, setCurrent] = useState<string>(() =>
    initial && groups.some((group) => group.id === initial) ? initial : "all",
  );
  // Once another section is picked, its rows ease in (animate-swap-in), never on the first paint.
  const [seen, setSeen] = useState(current);
  const [switched, setSwitched] = useState(false);
  if (current !== seen) {
    setSeen(current);
    setSwitched(true);
    setFrozen(null);
  }
  const matches = matcher(query);
  const asked = Boolean(query || initial);
  // Passes the page's search and a section's filters.
  const shows = (offer: ListingOffer, filters: Filters) => (!matches || matches(offer)) && passes(offer, filters);
  // The home hero's shortcut to a group this place has nothing in.
  const missing = initial && !groups.some((group) => group.id === initial)
    ? BOOKING_GROUPS.find((group) => group.id === initial)
    : undefined;
  const [filters, setFilters] = useState<Record<string, Filters>>({});
  // The section whose filters are open, and the filters as edited there, applied on Show.
  const [editing, setEditing] = useState<{ id: string; draft: Filters } | null>(null);
  // A link to a section (#need-<group>) picks it and scrolls to it. A link to a row
  // (#listing-<id>: a place to see's "1 tour goes here") shows it even while
  // another section is picked, or past its section's first rows under All, then scrolls to it
  // once it is in the page. "Show all N" scrolls to the section it picks the same way.
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
  useEffect(() => {
    const follow = () => {
      // Arrived from a search or a category (`?q=`, `?show=`): What to book itself, once the page has
      // laid out, rather than the browser's own jump, which the banner's late layout throws off.
      if (window.location.hash === "#listings") {
        if (asked) setReveal({ id: "listings" });
        return;
      }
      // A link to a section (#need-stay: the trip card's "A place to stay") picks it.
      const picked = groups.find((each) => `#${each.id}` === window.location.hash);
      if (picked) {
        setCurrent(picked.id);
        setReveal({ id: `${picked.id}-top` });
        return;
      }
      const id = Number(/^#listing-(\d+)$/.exec(window.location.hash)?.[1]);
      const holds = (item: ListingItem) => item.offers.some((offer) => offer.id === id);
      const group = id ? groups.find((each) => each.items.some(holds)) : undefined;
      if (!group) return;
      const index = group.items.findIndex(holds);
      const early = index < FIRST_ROWS;
      setCurrent((was) => (was === group.id || (was === "all" && early) ? was : group.id));
      setReveal({ id: group.items[index].key });
    };
    follow();
    window.addEventListener("hashchange", follow);
    return () => window.removeEventListener("hashchange", follow);
  }, [groups, asked]);
  useEffect(() => {
    if (reveal === null) return;
    document.getElementById(reveal.id)?.scrollIntoView({ block: "start" });
  }, [reveal]);
  const filtersOf = (id: string) => filters[id] ?? NO_FILTERS;
  const setFiltersOf = (id: string, next: Filters) => setFilters((all) => ({ ...all, [id]: next }));
  const map = useAreaMap();
  const near = map?.near ?? null;
  const rail = !useBesideMap();
  // A business's listings the group's filters leave, and, in a distance search, only those in range.
  const kept = (group: ListingGroup, item: ListingItem) =>
    item.offers.filter((offer) => shows(offer, filtersOf(group.id)) && (!near || near.has(offer.id)));
  // How far a business is: its nearest listing in range.
  const distance = (group: ListingGroup, item: ListingItem) => Math.min(...kept(group, item).map((offer) => near?.get(offer.id) ?? 0));
  const filtered = (group: ListingGroup) =>
    group.items.filter((item) => item.offers.some((offer) => shows(offer, filtersOf(group.id))));
  const visible = (group: ListingGroup) =>
    near
      ? group.items
          .filter((item) => kept(group, item).length > 0)
          .sort((a, b) => distance(group, a) - distance(group, b))
      : filtered(group);

  // Tell the map what is showing: the picked group's pins, without the rows its filters hide.
  const setView = map?.setView;
  const shownGroup = groups.find((group) => group.id === current)?.group ?? null;
  const hiddenIds = groups
    .flatMap((group) => {
      const offers = group.items.flatMap((item) => item.offers);
      return offers.filter((offer) => !shows(offer, filtersOf(group.id))).map((offer) => offer.id);
    })
    .join(",");
  useEffect(() => {
    setView?.({ group: shownGroup, hidden: hiddenIds ? hiddenIds.split(",").map(Number) : [] });
  }, [setView, shownGroup, hiddenIds]);

  const total = groups.reduce((sum, group) => sum + visible(group).length, 0);
  // Under a search, only the sections it found something in (and the one picked).
  const options = [
    { id: "all", title: "All", icon: "", count: total, set: 0, mark: undefined },
    ...ordered
      .map((group) => ({
        id: group.id,
        title: group.title,
        icon: group.icon,
        count: visible(group).length,
        set: setCount(filtersOf(group.id)),
        mark: markOf(group),
      }))
      .filter((option) => !matches || option.count > 0 || option.id === current),
  ];
  // Under a search, All keeps to the sections with a match.
  const shown =
    current === "all"
      ? ordered.filter((group) => !matches || visible(group).length > 0)
      : groups.filter((group) => group.id === current);
  // Arrived on a section from the home page's shortcuts: said once, with the way back to All.
  const opened = initial && current === initial ? groups.find((group) => group.id === initial) : undefined;
  const editingGroup = editing && groups.find((group) => group.id === editing.id);
  const openFilters = (id: string) => setEditing({ id, draft: filtersOf(id) });

  return (
    <div className={cn("relative grid gap-5", rail && "lg:grid-cols-[16rem_minmax(0,1fr)] lg:items-start lg:gap-6")}>
      <MapSkipLink />
      {/* Under the stuck search bar, scrolling on its own if the window is short. */}
      {/* Below lg its contents join the grid, so the chips can stick for the whole list. */}
      <aside
        aria-label="Filter what to book"
        className={cn(
          "contents min-w-0 flex-col gap-4",
          rail && "lg:sticky lg:flex lg:top-(--chrome) lg:max-h-[calc(100dvh-var(--chrome)-1rem)] lg:overflow-y-auto lg:overscroll-contain lg:pb-1",
        )}
      >
        {groups.length > 1 && (
          <div
            ref={chipsRef}
            role="group"
            aria-label="Show"
            className={cn(
              // Stuck under the header (which holds the search). On a phone its background reaches
              // up under the header's foot (z-35, under the header's z-40), so no row shows through
              // the 12px between them.
              "sticky top-(--chrome) z-20 -mx-inset -my-2 flex gap-1.5 overflow-x-auto bg-surface-2 px-inset py-2 [scrollbar-width:none] max-search:top-[calc(var(--chrome)_-_1.25rem)] max-search:-mt-5 max-search:z-35 max-search:pt-5",
              rail && "lg:static lg:mx-0 lg:my-0 lg:flex-col lg:gap-1 lg:overflow-visible lg:rounded-card lg:bg-surface lg:p-2 lg:card-edge-line lg:shadow-soft",
            )}
          >
            {/* The trip's plan, first in the row (and the rail): it says what to look for here. */}
            {planSummary && (
              <button
                type="button"
                onClick={openPlan}
                aria-haspopup="dialog"
                data-testid="trip-plan-button"
                aria-label={planSummary.missing > 0 ? `Your plan: ${planSummary.missing} missing` : "Your plan"}
                className={cn(
                  "flex min-h-11 shrink-0 items-center gap-2 rounded-button bg-surface px-4 text-sm font-semibold whitespace-nowrap text-navy shadow-xs inset-ring-1 inset-ring-line-strong transition-colors duration-150 ease-calm hover:bg-surface-2",
                  rail && "lg:mb-1 lg:bg-surface lg:hover:bg-mist lg:grid lg:grid-cols-[1.75rem_minmax(0,1fr)_auto] lg:gap-2.5 lg:rounded-control lg:border-line lg:px-2.5 lg:py-2 lg:text-left",
                )}
              >
                <span aria-hidden className={cn("flex items-center justify-center", rail && "lg:size-7 lg:rounded-lg lg:bg-navy lg:text-white")}>
                  {planSummary.problem ? <AlertGlyph className={cn("size-4 text-warning", rail && "lg:text-warning-tint")} /> : <ListGlyph className="size-4" />}
                </span>
                <span>Your plan</span>
                {planSummary.missing > 0 && (
                  <span
                    aria-hidden
                    className="grid min-w-6 place-items-center rounded-full bg-aqua px-1.5 text-xs font-bold text-navy tabular-nums"
                  >
                    {planSummary.missing}
                  </span>
                )}
              </button>
            )}
            {options.map((option) => {
              const on = option.id === current;
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setCurrent(option.id)}
                  className={cn(
                    // On a phone each is a chip, so the row reads as something to tap on the pale section.
                    "flex min-h-11 shrink-0 items-center gap-2 rounded-chip px-3.5 text-sm whitespace-nowrap transition-colors duration-150 ease-calm",
                    // In the rail: a row with the count in its own right-aligned column, and a long
                    // name wrapping beside its icon rather than pushing the count out.
                    rail && "lg:grid lg:grid-cols-[1.75rem_minmax(0,1fr)_2.5ch] lg:gap-2.5 lg:rounded-control lg:shadow-none lg:inset-ring-0 lg:px-2.5 lg:py-2 lg:text-left lg:whitespace-normal",
                    on
                      ? cn("bg-primary font-semibold text-white", rail && "lg:bg-lagoon-tint lg:text-lagoon-ink")
                      : cn(
                          // A flat grey tag, as the row's facts are: the outlined teal is for buttons.
                          "bg-tag font-medium text-navy hover:bg-lagoon-tint",
                          rail && "lg:bg-surface lg:text-foreground lg:hover:bg-surface-2",
                        ),
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "hidden size-7 items-center justify-center rounded-lg",
                      rail && "lg:flex",
                      on ? "bg-primary text-white" : "bg-tag text-navy",
                    )}
                  >
                    {option.icon ? <CategoryGlyph name={option.icon} className="size-4" /> : <GridGlyph className="size-4" />}
                  </span>
                  <span className="flex items-center gap-1.5">
                    {option.mark === "missing" && <span aria-hidden className="size-2 shrink-0 rounded-full bg-warning" />}
                    {option.title}
                    {option.mark === "has" && <TickGlyph className={cn("size-3.5 shrink-0", on ? "text-mint" : "text-forest", rail && on && "lg:text-forest")} />}
                    {option.mark && <span className="sr-only">{option.mark === "missing" ? ", missing from your trip" : ", in your trip"}</span>}
                    {option.set > 0 && (
                      <span className={cn("ml-1.5 text-xs font-medium", on ? cn("text-white/80", rail && "lg:text-lagoon-ink") : "text-muted")}>
                        · {option.set} {option.set === 1 ? "filter" : "filters"}
                      </span>
                    )}
                  </span>
                  <span className={cn("tabular-nums", rail && "lg:text-right", on ? cn("text-white/80", rail && "lg:text-lagoon-ink") : "text-muted")}>{option.count}</span>
                </button>
              );
            })}
            {/* What the marks mean, in the rail, once any shows (screen readers hear it on each). */}
            {rail && options.some((option) => option.mark) && (
              <p aria-hidden className="hidden flex-wrap items-center gap-x-3 gap-y-1 border-t border-line px-2.5 pt-2.5 pb-1 text-xs text-muted lg:flex">
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-warning" />
                  Your trip still needs
                </span>
                <span className="flex items-center gap-1.5">
                  <TickGlyph className="size-3.5 text-forest" />
                  In your trip
                </span>
              </p>
            )}
            {/* A fade at the row's right edge while it scrolls, so a cut-off chip reads as more. */}
            <span
              aria-hidden
              className={cn("pointer-events-none sticky -right-inset -ml-1.5 w-12 shrink-0 bg-linear-to-l from-surface-2 from-30% to-transparent", rail && "lg:hidden")}
            />
          </div>
        )}
        {/* Beside the map, the map's own Hide map turns it off. */}
        {rail && <MapSwitch />}
      </aside>
      <div className="flex min-w-0 flex-col gap-8">
        {missing && current === "all" && (
          <p role="status" className="text-sm text-muted">
            Nothing in {missing.title} here yet, so here is everything else.
          </p>
        )}
        {query && (
          <SearchedLine
            query={query}
            count={total}
            placeName={placeName}
            clearHref={clearHref}
          />
        )}
        {!query && opened && (
          <p role="status" data-testid="opened-group" className="flex flex-wrap items-center gap-x-3 text-sm text-muted">
            <span>
              Showing <span className="font-semibold text-foreground">{opened.title}</span>
              {placeName && <> on {placeName}</>}
            </span>
            <TextButton onClick={() => setCurrent("all")} className="min-h-11">
              Show everything
            </TextButton>
          </p>
        )}
        {shown.length === 0
          ? !matches && empty
          : shown.map((group, groupIndex) => {
              const all = visible(group);
              // A distance search lists everything in range, nearest first.
              // A search's matches show whole: they are few, and the point of the search.
              const rows = current === "all" && !near && !matches ? all.slice(0, FIRST_ROWS) : all;
              const set = setCount(filtersOf(group.id));
              const clear = () => setFiltersOf(group.id, NO_FILTERS);
              return (
                <div
                  // Keyed by the pick too, so a new pick plays the rows' arrival again.
                  key={`${current}-${group.id}`}
                  id={`${group.id}-top`}
                  className={cn("flex scroll-mt-(--chrome) flex-col gap-3", switched && "animate-swap-in")}
                  style={switched ? { animationDelay: `${Math.min(groupIndex, 3) * 60}ms` } : undefined}
                >
                  {/* On a phone the pills take a row of their own under the title. */}
                  <div className="flex min-w-0 flex-wrap items-center gap-2.5 sm:flex-nowrap">
                    <h3 id={group.id} className="scroll-mt-36 shrink-0 text-lg font-semibold">
                      {group.title}
                    </h3>
                    {/* A labelled button (a bare icon circle went unnoticed in testing): the outlined
                        second action, tinted while filters are set (data-set, globals.css). */}
                    <Button
                      variant="soft"
                      size="touch"
                      aria-label={`Filter ${group.title}${set > 0 ? `, ${set} set` : ""}`}
                      aria-haspopup="dialog"
                      onClick={() => openFilters(group.id)}
                      data-testid="section-filter"
                      data-set={set > 0 || undefined}
                      className="shrink-0 px-4 text-control"
                    >
                      <FilterGlyph className="size-5" />
                      Filter
                      {set > 0 && (
                        <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-bold text-white tabular-nums">
                          {set}
                        </span>
                      )}
                    </Button>
                    {set > 0 && (
                      <>
                        <FilterMarkers
                          title={group.title}
                          filters={filtersOf(group.id)}
                          onChange={(next) => setFiltersOf(group.id, next)}
                          onMore={() => openFilters(group.id)}
                        />
                        <TextButton onClick={clear} className="ml-auto shrink-0 text-sm sm:ml-0" />
                      </>
                    )}
                  </div>
                  {/* With a trip shown, whether it needs this section: said once under the title. */}
                  {trip && markOf(group) === "missing" && (
                    <p data-testid="section-needed" className="-mt-1 flex items-center gap-2 text-sm font-semibold">
                      <span aria-hidden className="size-2 shrink-0 rounded-full bg-warning" />
                      {neededLine(group)}
                    </p>
                  )}
                  {trip && markOf(group) === "has" && (
                    <p className="-mt-1 flex items-center gap-1.5 text-sm text-muted">
                      <TickGlyph aria-hidden className="size-3.5 text-forest" />
                      In your trip
                    </p>
                  )}
                  {group.gettingHere && (
                    <div data-testid="getting-here" className="flex max-w-prose items-start gap-3 rounded-control border border-line bg-surface p-3">
                      <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-xl bg-mist text-primary">
                        <FeatureGlyph name="route" className="size-5" />
                      </span>
                      <div className="flex min-w-0 flex-col gap-0.5 text-sm">
                        <p className="font-semibold">Getting here</p>
                        <p className="text-pretty">{group.gettingHere.route}</p>
                        <p className="text-pretty text-muted">{group.gettingHere.note}</p>
                      </div>
                    </div>
                  )}
                  {group.shared && group.shared.length > 0 && (
                    <p className="-mt-1 flex flex-wrap items-center gap-1.5 text-sm text-muted">
                      All have:
                      {group.shared.map((chip) => (
                        // Cancellation is trust, in green, as on the rows.
                        <Badge key={chip} tone={/cancel/i.test(chip) ? "emerald" : "fact"} className="min-h-6 px-2.5 text-xs">
                          {chip}
                        </Badge>
                      ))}
                    </p>
                  )}
                  {group.note && <p className="-mt-1 max-w-prose text-sm text-pretty text-muted">{group.note}</p>}
                  {rows.length > 0 ? (
                    <ul className="flex flex-col gap-3">
                      {rows.map((item, rowIndex) => (
                        // A search suggestion links straight to its row (#listing-<id>).
                        // A container, so the row lays itself out by its own width: beside the map
                        // it is narrower than the window says.
                        <li
                          key={item.key}
                          id={item.key}
                          data-listings={item.offers.map((offer) => offer.id).join(" ")}
                          className={cn("@container scroll-mt-36", switched && "animate-swap-in")}
                          style={switched ? { animationDelay: `${Math.min(groupIndex * 3 + rowIndex + 1, 6) * 60}ms` } : undefined}
                        >
                          {near && (
                            <p className="mb-1.5 px-1 text-sm font-semibold text-primary">{distance(group, item).toFixed(1)} km from your pin</p>
                          )}
                          {/* Each row a white card on the pale sheet, so its edge shows at rest, not only when lit. */}
                          <MapHoverTarget
                            pin={item.offers.map((offer) => listingKey(offer.id))}
                            className="border border-line bg-surface p-3 shadow-soft"
                          >
                            <ShownOffersContext.Provider value={new Set(kept(group, item).map((offer) => offer.id))}>
                              {item.content}
                            </ShownOffersContext.Provider>
                          </MapHoverTarget>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {rows.length < all.length && (
                    <Button
                      type="button"
                      variant="soft"
                      size="touch"
                      arrow
                      onClick={() => {
                        setCurrent(group.id);
                        setReveal({ id: `${group.id}-top` });
                      }}
                      className="self-start"
                    >
                      Show all {all.length} in {group.title}
                    </Button>
                  )}
                  {all.length === 0 && (
                    <p className="rounded-card bg-surface p-4 text-sm text-muted card-edge">
                      {near && filtered(group).length > 0 ? (
                        "Nothing in this section is within that distance of your pin."
                      ) : (
                        <>
                          {set > 0 ? (
                            <>
                              Nothing here matches these filters. <TextButton onClick={clear} />
                            </>
                          ) : (
                            <>Nothing in {group.title} matches “{query}”.</>
                          )}
                        </>
                      )}
                    </p>
                  )}
                </div>
              );
            })}
      </div>
      {editing && editingGroup && (
        <Dialog
          open
          placement="sheet"
          title={editingGroup.title}
          meta="Filter what shows here"
          onClose={() => setEditing(null)}
          data-testid="filter-dialog"
          summary={
            setCount(editing.draft) > 0 && (
              <TextButton onClick={() => setEditing({ ...editing, draft: NO_FILTERS })} className="text-sm">
                Clear all
              </TextButton>
            )
          }
          actions={
            <>
              <Button
                type="button"
                data-testid="filter-apply"
                onClick={() => {
                  setFiltersOf(editing.id, editing.draft);
                  setEditing(null);
                }}
              >
                Show {matching(editingGroup, editing.draft, matches)}{" "}
                {matching(editingGroup, editing.draft, matches) === 1 ? "result" : "results"}
              </Button>
            </>
          }
        >
          <FilterPanel group={editingGroup} filters={editing.draft} onChange={(draft) => setEditing({ ...editing, draft })} />
        </Dialog>
      )}
    </div>
  );
}


// How many businesses in a group have a listing the filters (and the page's search) leave.
function matching(group: ListingGroup, filters: Filters, matches: ((offer: ListingOffer) => boolean) | null) {
  return group.items.filter((item) => item.offers.some((offer) => (!matches || matches(offer)) && passes(offer, filters)))
    .length;
}

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

// One section's filters: free cancellation, for stays whether they take pets, a price range on
// its "from" prices, and what its rows include, each with how many businesses would match.
function FilterPanel({
  group,
  filters,
  onChange,
}: {
  group: ListingGroup;
  filters: Filters;
  onChange: (next: Filters) => void;
}) {
  const [allIncludes, setAllIncludes] = useState(false);
  // Prices are its listings'; the counts are businesses, as the section's rows and its "Show N
  // results" count them, so a business with two cottages counts once.
  const offers = group.items.flatMap((item) => item.offers);
  const prices = offers.flatMap((item) => (item.priceCents === null ? [] : [item.priceCents]));
  const units = [...new Set(offers.flatMap((item) => (item.priceUnit ? [item.priceUnit] : [])))];
  const unpriced = offers.some((item) => item.priceCents === null);
  const businesses = group.items.length;
  const free = group.items.filter((item) => item.offers.some((offer) => offer.features.some((feature) => feature.trust))).length;
  const pets = group.group === "stay" ? group.items.filter((item) => item.offers.some(takesPets)).length : 0;

  // What the rows include, counted among the businesses the other filters leave. A choice every
  // business has filters nothing (the section's note already says it), so it isn't offered, nor is
  // a size or a route, which describe a listing rather than say what comes with it. One already
  // ticked stays listed even when nothing left has it.
  const counts = new Map<string, number>();
  for (const item of group.items) {
    const labels = new Set(
      item.offers
        .filter((offer) => passes(offer, filters, true))
        .flatMap((offer) => offer.features.filter((feature) => !feature.trust && !NOT_INCLUDES.has(feature.icon)))
        .map((feature) => feature.label),
    );
    for (const label of labels) counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  for (const [label, count] of counts) if (count === businesses && !filters.includes.includes(label)) counts.delete(label);
  for (const label of filters.includes) if (!counts.has(label)) counts.set(label, 0);
  const includes = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const listed = allIncludes ? includes : includes.slice(0, FIRST_INCLUDES);
  const toggle = (label: string, on: boolean) =>
    onChange({ ...filters, includes: on ? [...filters.includes, label] : filters.includes.filter((l) => l !== label) });

  return (
    <div className="flex flex-col gap-4" data-testid="listing-filter-panel">
      {free > 0 && (free < businesses || filters.free) && (
        <CheckboxField
          label="Free cancellation"
          aside={free}
          checked={filters.free}
          onChange={(event) => onChange({ ...filters, free: event.target.checked })}
        />
      )}
      {(pets > 0 || filters.pets) && (
        <CheckboxField
          label="Pet-friendly"
          aside={pets}
          checked={filters.pets}
          onChange={(event) => onChange({ ...filters, pets: event.target.checked })}
          data-testid="pet-friendly-filter"
        />
      )}
      {prices.length > 0 && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-semibold">
            Price from, ₱{units.length === 1 && <span className="font-normal text-muted"> {units[0]}</span>}
          </legend>
          <div className="grid grid-cols-2 gap-2">
            <Field
              label="Min"
              type="number"
              inputMode="numeric"
              min={0}
              step={100}
              placeholder={formatPeso(Math.min(...prices))}
              value={filters.min}
              onChange={(event) => onChange({ ...filters, min: wholePesos(event.target.value) })}
            />
            <Field
              label="Max"
              type="number"
              inputMode="numeric"
              min={0}
              step={100}
              placeholder={formatPeso(Math.max(...prices))}
              value={filters.max}
              onChange={(event) => onChange({ ...filters, max: wholePesos(event.target.value) })}
            />
          </div>
          {Number(filters.min) > 0 && Number(filters.max) > 0 && Number(filters.min) > Number(filters.max) && (
            <p role="alert" className="text-xs text-danger">The lowest price is above the highest, so nothing matches. Lower Min or raise Max.</p>
          )}
          {unpriced && (filters.min || filters.max) && (
            <p className="text-xs text-muted">Ones without a price yet are hidden while a price is set.</p>
          )}
        </fieldset>
      )}
      {includes.length > 0 && (
        <fieldset className="flex flex-col gap-0">
          <legend className="mb-2 text-sm font-semibold">Includes</legend>
          {listed.map(([label, count]) => (
            <CheckboxField
              key={label}
              label={label}
              aside={count}
              checked={filters.includes.includes(label)}
              onChange={(event) => toggle(label, event.target.checked)}
            />
          ))}
          {includes.length > FIRST_INCLUDES && (
            <TextButton onClick={() => setAllIncludes(!allIncludes)}>
              {allIncludes ? "Show fewer" : `Show all ${includes.length}`}
            </TextButton>
          )}
        </fieldset>
      )}
    </div>
  );
}

// What is set in a section's filters, as pills each removing its own, kept to one row: what
// doesn't fit is counted in "+N more", which opens the filters.
function FilterMarkers({
  title,
  filters,
  onChange,
  onMore,
}: {
  title: string;
  filters: Filters;
  onChange: (next: Filters) => void;
  onMore: () => void;
}) {
  const min = Number(filters.min) || 0;
  const max = Number(filters.max) || 0;
  const peso = (amount: number) => formatPeso(amount * 100);
  const markers = [
    filters.free && { key: "free", label: "Free cancellation", remove: () => onChange({ ...filters, free: false }) },
    filters.pets && { key: "pets", label: "Pet-friendly", remove: () => onChange({ ...filters, pets: false }) },
    (min || max) && {
      key: "price",
      label: min && max ? `${peso(min)}–${peso(max)}` : max ? `Up to ${peso(max)}` : `From ${peso(min)}`,
      remove: () => onChange({ ...filters, min: "", max: "" }),
    },
    ...filters.includes.map((label) => ({
      key: `includes:${label}`,
      label,
      remove: () => onChange({ ...filters, includes: filters.includes.filter((l) => l !== label) }),
    })),
  ].filter((marker) => marker !== false && marker !== 0);
  const { list, more, shown, hidden } = useFitRows<HTMLUListElement, HTMLLIElement>(
    1,
    markers.length,
    markers.map((marker) => marker.key).join("|"),
  );
  const visible = shown === null ? markers : markers.slice(0, shown);

  return (
    <ul
      ref={list}
      aria-label={`${title} filters`}
      className="order-last flex min-w-0 basis-full flex-wrap gap-1.5 sm:order-none sm:flex-1 sm:basis-auto"
    >
      {visible.map((marker) => (
        <li key={marker.key}>
          <span className="flex min-h-8 items-center gap-1 rounded-full bg-mist pr-1 pl-3 text-xs font-semibold whitespace-nowrap text-primary">
            {marker.label}
            <button
              type="button"
              aria-label={`Remove ${marker.label}`}
              onClick={marker.remove}
              // A 24px circle with a 44px-tall hit area, so the pill stays slim on a phone.
              className="relative flex size-6 items-center justify-center rounded-full before:absolute before:-inset-x-1.5 before:-inset-y-2.5 hover:bg-surface"
            >
              <CloseGlyph className="size-3.5" />
            </button>
          </span>
        </li>
      ))}
      {hidden > 0 && (
        <li ref={more}>
          <button
            type="button"
            onClick={onMore}
            className="relative flex min-h-8 items-center rounded-full bg-tag px-3 text-xs font-semibold whitespace-nowrap text-navy/80 before:absolute before:inset-x-0 before:-inset-y-1.5 hover:bg-lagoon-tint"
          >
            +{hidden} more
          </button>
        </li>
      )}
    </ul>
  );
}

// For the keyboard on a phone, first in What to book: the Map button sits in the floating dock,
// last on the page after the footer. Hidden until focused, like Skip to content, and then shown
// where it is, over What to book's first row. Not from lg, where the map has its switch in the
// rail beside the sections, and not for the plan, whose chip comes right after it. On an area
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
