"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { CheckboxField } from "@/components/ui/checkbox-field";
import { cn } from "@/components/ui/cn";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { formatPeso } from "@/lib/money";
import { listingKey, MapHoverTarget, MapSwitch, useAreaMap } from "./area-map-context";
import type { Feature } from "./listing-features";
import { CategoryGlyph, CloseGlyph, FilterGlyph, GridGlyph } from "./tag-glyphs";
import { useFitRows } from "./use-fit-rows";

// A row as the filters see it: its "from" price (null while it has none) and the chips it
// shows. `content` is the row itself, rendered on the server.
export type ListingItem = { id: number; priceCents: number | null; priceUnit?: string | null; features: Feature[]; content: ReactNode };
// `bookingType` tells the area map which pins the group's rows are.
export type ListingGroup = { id: string; title: string; icon: string; bookingType?: string; items: ListingItem[] };

type Filters = { free: boolean; min: string; max: string; includes: string[] };
const NO_FILTERS: Filters = { free: false, min: "", max: "", includes: [] };
// Includes listed before "Show all".
const FIRST_INCLUDES = 6;

const setCount = (filters: Filters) =>
  Number(filters.free) + Number(Boolean(filters.min || filters.max)) + filters.includes.length;

function passes(item: ListingItem, filters: Filters, skipIncludes = false) {
  if (filters.free && !item.features.some((feature) => feature.trust)) return false;
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
// rail on the left that stays in view under the search bar, the trip dates over the sections
// with their counts; on a phone the dates come first, then the sections as a row of chips.
// "All" shows every section under its title; a section shows just its own, still titled.
// Filters belong to one section (RAA-126), so a price set for a motorbike never hides a
// cottage: each title has a filter button opening them in a modal, and what is set shows
// beside it as pills to remove, one row of them with "+N more" for the rest.
// On an area page with its map, the map's pins follow the group and filters shown here, a row
// and its pin light up together, and a distance search narrows the rows to what is in range,
// nearest first, each with how far it is. `initial` is the group to open on (the home hero's
// category pills, RAA-130); one the area doesn't have opens on All.
export function ListingBrowser({
  groups,
  dates,
  empty,
  initial,
}: {
  groups: ListingGroup[];
  dates: ReactNode;
  empty: ReactNode;
  initial?: string;
}) {
  const [current, setCurrent] = useState<string>(() =>
    initial && groups.some((group) => group.id === initial) ? initial : "all",
  );
  const [filters, setFilters] = useState<Record<string, Filters>>({});
  // The section whose filters are open, and the filters as edited there, applied on Show.
  const [editing, setEditing] = useState<{ id: string; draft: Filters } | null>(null);
  const filtersOf = (id: string) => filters[id] ?? NO_FILTERS;
  const setFiltersOf = (id: string, next: Filters) => setFilters((all) => ({ ...all, [id]: next }));
  const map = useAreaMap();
  const near = map?.near ?? null;
  const filtered = (group: ListingGroup) => group.items.filter((item) => passes(item, filtersOf(group.id)));
  const visible = (group: ListingGroup) =>
    near
      ? filtered(group)
          .filter((item) => near.has(item.id))
          .sort((a, b) => (near.get(a.id) ?? 0) - (near.get(b.id) ?? 0))
      : filtered(group);

  // Tell the map what is showing: the picked group's pins, without the rows its filters hide.
  const setView = map?.setView;
  const bookingType = groups.find((group) => group.id === current)?.bookingType ?? null;
  const hiddenIds = groups
    .flatMap((group) => {
      const kept = new Set(filtered(group).map((item) => item.id));
      return group.items.filter((item) => !kept.has(item.id)).map((item) => item.id);
    })
    .join(",");
  useEffect(() => {
    setView?.({ bookingType, hidden: hiddenIds ? hiddenIds.split(",").map(Number) : [] });
  }, [setView, bookingType, hiddenIds]);

  const total = groups.reduce((sum, group) => sum + visible(group).length, 0);
  const options = [{ id: "all", title: "All", icon: "", count: total, set: 0 }, ...groups.map((group) => ({
    id: group.id,
    title: group.title,
    icon: group.icon,
    count: visible(group).length,
    set: setCount(filtersOf(group.id)),
  }))];
  const shown = current === "all" ? groups : groups.filter((group) => group.id === current);
  const editingGroup = editing && groups.find((group) => group.id === editing.id);
  const openFilters = (id: string) => setEditing({ id, draft: filtersOf(id) });

  return (
    <div className="grid gap-5 lg:grid-cols-[16rem_minmax(0,1fr)] lg:items-start lg:gap-6">
      {/* Under the stuck search bar, scrolling on its own if the window is short. */}
      <aside
        aria-label="Filter what to book"
        className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-(--chrome) lg:max-h-[calc(100dvh-var(--chrome)-1rem)] lg:overflow-y-auto lg:overscroll-contain lg:pb-1"
      >
        {dates}
        {groups.length > 1 && (
          <div
            role="group"
            aria-label="Show"
            className="-mx-1 flex gap-1.5 overflow-x-auto px-1 py-0.5 [scrollbar-width:none] lg:mx-0 lg:flex-col lg:gap-1 lg:overflow-visible lg:rounded-card lg:bg-surface lg:p-2 lg:card-edge lg:shadow-soft"
          >
            {options.map((option) => {
              const on = option.id === current;
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setCurrent(option.id)}
                  className={cn(
                    "flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold whitespace-nowrap transition-colors duration-300 ease-calm",
                    // In the rail: a row with the count in its own right-aligned column, and a long
                    // name wrapping beside its icon rather than pushing the count out.
                    "lg:grid lg:grid-cols-[1.75rem_minmax(0,1fr)_2.5ch] lg:gap-2.5 lg:rounded-control lg:border-0 lg:px-2.5 lg:py-2 lg:text-left lg:whitespace-normal",
                    on
                      ? "border-navy bg-navy text-white lg:bg-mist lg:text-primary"
                      : "border-line bg-surface text-foreground hover:border-line-strong lg:hover:bg-surface-2",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "hidden size-7 items-center justify-center rounded-lg lg:flex",
                      on ? "bg-surface text-primary" : "bg-mist text-primary",
                    )}
                  >
                    {option.icon ? <CategoryGlyph name={option.icon} className="size-4" /> : <GridGlyph className="size-4" />}
                  </span>
                  <span>
                    {option.title}
                    {option.set > 0 && (
                      <span className={cn("ml-1.5 text-xs font-medium", on ? "lg:text-primary" : "text-link")}>
                        · {option.set} {option.set === 1 ? "filter" : "filters"}
                      </span>
                    )}
                  </span>
                  <span className={cn("tabular-nums lg:text-right", on ? "lg:text-primary" : "text-muted")}>{option.count}</span>
                </button>
              );
            })}
          </div>
        )}
        <MapSwitch />
      </aside>
      <div className="flex min-w-0 flex-col gap-8">
        {shown.length === 0
          ? empty
          : shown.map((group) => {
              const rows = visible(group);
              const set = setCount(filtersOf(group.id));
              const clear = () => setFiltersOf(group.id, NO_FILTERS);
              return (
                <div key={group.id} className="flex flex-col gap-3">
                  {/* On a phone the pills take a row of their own under the title. */}
                  <div className="flex min-w-0 flex-wrap items-center gap-2.5 sm:flex-nowrap">
                    <h3 id={group.id} className="scroll-mt-36 shrink-0 text-lg font-semibold">
                      {group.title}
                    </h3>
                    <button
                      type="button"
                      aria-label={`Filter ${group.title}${set > 0 ? `, ${set} set` : ""}`}
                      aria-haspopup="dialog"
                      onClick={() => openFilters(group.id)}
                      data-testid="section-filter"
                      className={cn(
                        "relative flex size-11 shrink-0 items-center justify-center rounded-full border text-primary transition-colors duration-300 ease-calm",
                        set > 0 ? "border-line-2 bg-mist" : "border-line bg-surface hover:border-line-strong",
                      )}
                    >
                      <FilterGlyph className="size-5" />
                      {set > 0 && (
                        <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-bold text-white tabular-nums">
                          {set}
                        </span>
                      )}
                    </button>
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
                  {rows.length > 0 ? (
                    <ul className="flex flex-col gap-3">
                      {rows.map((item) => (
                        // A search suggestion links straight to its row (#listing-<id>).
                        // A container, so the row lays itself out by its own width: beside the map
                        // it is narrower than the window says.
                        <li key={item.id} id={`listing-${item.id}`} className="@container scroll-mt-36">
                          {near?.has(item.id) && (
                            <p className="mb-1.5 px-1 text-sm font-semibold text-primary">{near.get(item.id)?.toFixed(1)} km from your pin</p>
                          )}
                          <MapHoverTarget pin={listingKey(item.id)}>{item.content}</MapHoverTarget>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="rounded-card bg-surface p-4 text-sm text-muted card-edge">
                      {near && filtered(group).length > 0 ? (
                        "Nothing in this section is within that distance of your pin."
                      ) : (
                        <>
                          Nothing here matches these filters. <TextButton onClick={clear} />
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
          title={`Filter ${editingGroup.title}`}
          onClose={() => setEditing(null)}
          data-testid="filter-dialog"
          actions={
            <>
              {setCount(editing.draft) > 0 && (
                <TextButton onClick={() => setEditing({ ...editing, draft: NO_FILTERS })} className="mr-auto self-center text-sm">
                  Clear all
                </TextButton>
              )}
              <Button
                type="button"
                data-testid="filter-apply"
                onClick={() => {
                  setFiltersOf(editing.id, editing.draft);
                  setEditing(null);
                }}
              >
                Show {editingGroup.items.filter((item) => passes(item, editing.draft)).length}{" "}
                {editingGroup.items.filter((item) => passes(item, editing.draft)).length === 1 ? "result" : "results"}
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

function TextButton({ onClick, children = "Clear", className }: { onClick: () => void; children?: ReactNode; className?: string }) {
  return (
    <button type="button" onClick={onClick} className={cn("font-semibold text-link underline-offset-4 hover:underline", className)}>
      {children}
    </button>
  );
}

// One section's filters: free cancellation, a price range on its "from" prices, and what its
// rows include, each with how many rows would match.
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
  const prices = group.items.flatMap((item) => (item.priceCents === null ? [] : [item.priceCents]));
  const units = [...new Set(group.items.flatMap((item) => (item.priceUnit ? [item.priceUnit] : [])))];
  const unpriced = group.items.some((item) => item.priceCents === null);
  const free = group.items.filter((item) => item.features.some((feature) => feature.trust)).length;

  // What the rows include, counted among the rows the other filters leave; one already ticked
  // stays listed even when nothing left has it.
  const pool = group.items.filter((item) => passes(item, filters, true));
  const counts = new Map<string, number>();
  for (const item of pool)
    for (const feature of item.features) if (!feature.trust) counts.set(feature.label, (counts.get(feature.label) ?? 0) + 1);
  for (const label of filters.includes) if (!counts.has(label)) counts.set(label, 0);
  const includes = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const listed = allIncludes ? includes : includes.slice(0, FIRST_INCLUDES);
  const toggle = (label: string, on: boolean) =>
    onChange({ ...filters, includes: on ? [...filters.includes, label] : filters.includes.filter((l) => l !== label) });

  return (
    <div className="flex flex-col gap-4" data-testid="listing-filter-panel">
      {free > 0 && (
        <CheckboxField
          label="Free cancellation"
          aside={free}
          checked={filters.free}
          onChange={(event) => onChange({ ...filters, free: event.target.checked })}
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
              onChange={(event) => onChange({ ...filters, min: event.target.value })}
            />
            <Field
              label="Max"
              type="number"
              inputMode="numeric"
              min={0}
              step={100}
              placeholder={formatPeso(Math.max(...prices))}
              value={filters.max}
              onChange={(event) => onChange({ ...filters, max: event.target.value })}
            />
          </div>
          {unpriced && (filters.min || filters.max) && (
            <p className="text-xs text-muted">Ones without a price yet are hidden while a price is set.</p>
          )}
        </fieldset>
      )}
      {includes.length > 0 && (
        <fieldset className="flex flex-col gap-2.5">
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
              className="flex size-6 items-center justify-center rounded-full hover:bg-surface"
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
            className="flex min-h-8 items-center rounded-full border border-line bg-surface px-3 text-xs font-semibold whitespace-nowrap hover:border-line-strong"
          >
            +{hidden} more
          </button>
        </li>
      )}
    </ul>
  );
}
