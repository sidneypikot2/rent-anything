"use client";

import { useState } from "react";
import { CheckboxField } from "@/components/ui/checkbox-field";
import { Field } from "@/components/ui/field";
import { Pill } from "@/components/ui/pill";
import { transmissionLabel } from "@/components/listings/vehicle-labels";
import { formatPeso } from "@/lib/money";
import { priceUnitText } from "@/lib/pricing";
import { FilterPill, priceRangeLabel } from "./filter-controls";
import { includeLabel } from "./listing-features";
import type { Facets, Filters, VehicleFilters } from "./filters";
import { useFitRows } from "./use-fit-rows";

// The sheet's own: the checks a rental's shop offers, how many includes show before "Show all",
// and what a group's from-price is per.
const VEHICLE_CHECKS = [
  { key: "delivery", facet: "delivery", label: "Drops off at your stay" },
  { key: "pickup", facet: "pickup", label: "Picks up at the end" },
  { key: "childHelmets", facet: "child_helmets", label: "Child helmets" },
] as const;
const FIRST_INCLUDES = 6;
// Things to do mix groups and people, so they say no unit.
const PRICE_UNIT: Record<string, "night" | "day" | "trip"> = { stay: "night", rental: "day", gear: "day", transfer: "trip" };

// A typed price as whole pesos, never below zero ("-5" and "12.5" become "0" and "12").
const wholePesos = (value: string) => (value === "" ? "" : String(Math.max(0, Math.floor(Number(value)) || 0)));

// One section's filters from its facets: free cancellation, for stays whether they take pets, a
// rental's vehicle and handover, a price range on its "from" prices, and what its listings
// include, each with how many cards would match. A choice every card has filters nothing (the
// section's "All have:" says it), so it isn't offered; one already picked always stays.
export function FilterPanel({
  group,
  facets,
  filters,
  onChange,
}: {
  // The guest group ("stay", "rental", …).
  group?: string;
  facets: Facets;
  filters: Filters;
  onChange: (next: Filters) => void;
}) {
  const [allIncludes, setAllIncludes] = useState(false);
  const cards = facets.cards;
  const unit = group && PRICE_UNIT[group] ? priceUnitText(PRICE_UNIT[group]) : undefined;
  const includes = facets.includes
    .filter((each) => filters.includes.includes(each.key) || (each.count < cards && includeLabel(each.key)))
    .map((each) => ({ ...each, label: includeLabel(each.key) ?? each.key }));
  const listed = allIncludes ? includes : includes.slice(0, FIRST_INCLUDES);
  const toggle = (key: string, on: boolean) =>
    onChange({ ...filters, includes: on ? [...filters.includes, key] : filters.includes.filter((each) => each !== key) });

  return (
    <div className="flex flex-col gap-4" data-testid="listing-filter-panel">
      {facets.free_cancellation > 0 && (facets.free_cancellation < cards || filters.free) && (
        <CheckboxField
          label="Free cancellation"
          aside={facets.free_cancellation}
          checked={filters.free}
          onChange={(event) => onChange({ ...filters, free: event.target.checked })}
        />
      )}
      {group === "stay" && (facets.pets > 0 || filters.pets) && (
        <CheckboxField
          label="Pet-friendly"
          aside={facets.pets}
          checked={filters.pets}
          onChange={(event) => onChange({ ...filters, pets: event.target.checked })}
          data-testid="pet-friendly-filter"
        />
      )}
      {(group === "rental" || group === "gear") && (
        <VehicleFilterFields group={group} facets={facets} filters={filters.vehicle} onChange={(vehicle) => onChange({ ...filters, vehicle })} />
      )}
      {facets.price_min_cents !== null && facets.price_max_cents !== null && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-semibold">
            Price from, ₱{unit && <span className="font-normal text-muted"> {unit}</span>}
          </legend>
          <div className="grid grid-cols-2 gap-2">
            <Field
              label="Min"
              type="number"
              inputMode="numeric"
              min={0}
              step={100}
              placeholder={formatPeso(facets.price_min_cents)}
              value={filters.min}
              onChange={(event) => onChange({ ...filters, min: wholePesos(event.target.value) })}
            />
            <Field
              label="Max"
              type="number"
              inputMode="numeric"
              min={0}
              step={100}
              placeholder={formatPeso(facets.price_max_cents)}
              value={filters.max}
              onChange={(event) => onChange({ ...filters, max: wholePesos(event.target.value) })}
            />
          </div>
          {Number(filters.min) > 0 && Number(filters.max) > 0 && Number(filters.min) > Number(filters.max) && (
            <p role="alert" className="text-xs text-danger">The lowest price is above the highest, so nothing matches. Lower Min or raise Max.</p>
          )}
          {facets.unpriced && (filters.min || filters.max) && (
            <p className="text-xs text-muted">Ones without a price yet are hidden while a price is set.</p>
          )}
        </fieldset>
      )}
      {includes.length > 0 && (
        <fieldset className="flex flex-col gap-0">
          <legend className="mb-2 text-sm font-semibold">Includes</legend>
          {listed.map((each) => (
            <CheckboxField
              key={each.key}
              label={each.label}
              aside={each.count}
              checked={filters.includes.includes(each.key)}
              onChange={(event) => toggle(each.key, event.target.checked)}
            />
          ))}
          {includes.length > FIRST_INCLUDES && (
            <button
              type="button"
              onClick={() => setAllIncludes(!allIncludes)}
              className="self-start font-semibold text-link underline-offset-4 hover:underline"
            >
              {allIncludes ? "Show fewer" : `Show all ${includes.length}`}
            </button>
          )}
        </fieldset>
      )}
    </div>
  );
}

// Vehicle rental's and Gear's own filters (RAA-205): the kind of vehicle and its transmission as
// pills, any of those picked, then what the shop offers. Each shows only when it splits the
// section (or is set), with how many cards have it.
function VehicleFilterFields({
  group,
  facets,
  filters,
  onChange,
}: {
  group: string;
  facets: Facets;
  filters: VehicleFilters;
  onChange: (next: VehicleFilters) => void;
}) {
  const toggle = (list: string[], value: string) => (list.includes(value) ? list.filter((each) => each !== value) : [...list, value]);
  const withPicked = (values: { value: string; label?: string; count: number }[], picked: string[]) => [
    ...values,
    ...picked.filter((value) => !values.some((each) => each.value === value)).map((value) => ({ value, count: 0 })),
  ];
  const pills = (legend: string, values: { value: string; label?: string; count: number }[], picked: string[], label: (value: string) => string, set: (next: string[]) => void) =>
    values.length > 1 || picked.length > 0 ? (
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold">{legend}</legend>
        <div className="flex flex-wrap gap-2">
          {values.map((each) => (
            <Pill key={each.value} on={picked.includes(each.value)} onClick={() => set(toggle(picked, each.value))}>
              {each.label ?? label(each.value)} <span className="font-normal text-muted">{each.count}</span>
            </Pill>
          ))}
        </div>
      </fieldset>
    ) : null;

  return (
    <>
      {pills(group === "gear" ? "Type" : "Vehicle", withPicked(facets.kinds, filters.kinds), filters.kinds, (kind) => kind, (next) =>
        onChange({ ...filters, kinds: next }),
      )}
      {pills(
        "Transmission",
        withPicked(facets.transmissions, filters.transmissions),
        filters.transmissions,
        (value) => transmissionLabel(value) ?? value,
        (next) => onChange({ ...filters, transmissions: next }),
      )}
      {VEHICLE_CHECKS.map((check) => {
        const count = facets[check.facet];
        if (!filters[check.key] && (count === 0 || count === facets.cards)) return null;
        return (
          <CheckboxField
            key={check.key}
            label={check.label}
            aside={count}
            checked={filters[check.key]}
            onChange={(event) => onChange({ ...filters, [check.key]: event.target.checked })}
            data-testid={`vehicle-filter-${check.key}`}
          />
        );
      })}
    </>
  );
}

// What is set in a section's filters, as pills each removing its own, kept to one row: what
// doesn't fit is counted in "+N more", which opens the filters. `facets` names the kinds.
export function FilterMarkers({
  title,
  filters,
  facets,
  onChange,
  onMore,
}: {
  title: string;
  filters: Filters;
  facets?: Facets;
  onChange: (next: Filters) => void;
  onMore: () => void;
}) {
  const min = Number(filters.min) || 0;
  const max = Number(filters.max) || 0;
  const peso = (amount: number) => formatPeso(amount * 100);
  const kindLabel = (kind: string) => facets?.kinds.find((each) => each.value === kind)?.label ?? kind;
  const markers = [
    filters.free && { key: "free", label: "Free cancellation", remove: () => onChange({ ...filters, free: false }) },
    filters.pets && { key: "pets", label: "Pet-friendly", remove: () => onChange({ ...filters, pets: false }) },
    (min || max) && { key: "price", label: priceRangeLabel(min, max, peso), remove: () => onChange({ ...filters, min: "", max: "" }) },
    ...filters.vehicle.kinds.map((kind) => ({
      key: `kind:${kind}`,
      label: kindLabel(kind),
      remove: () => onChange({ ...filters, vehicle: { ...filters.vehicle, kinds: filters.vehicle.kinds.filter((each) => each !== kind) } }),
    })),
    ...filters.vehicle.transmissions.map((value) => ({
      key: `transmission:${value}`,
      label: transmissionLabel(value) ?? value,
      remove: () =>
        onChange({ ...filters, vehicle: { ...filters.vehicle, transmissions: filters.vehicle.transmissions.filter((each) => each !== value) } }),
    })),
    ...VEHICLE_CHECKS.filter((check) => filters.vehicle[check.key]).map((check) => ({
      key: `vehicle:${check.key}`,
      label: check.label,
      remove: () => onChange({ ...filters, vehicle: { ...filters.vehicle, [check.key]: false } }),
    })),
    ...filters.includes.map((key) => ({
      key: `includes:${key}`,
      label: includeLabel(key) ?? key,
      remove: () => onChange({ ...filters, includes: filters.includes.filter((each) => each !== key) }),
    })),
  ].filter((marker) => marker !== false && marker !== 0);
  const { list, more, shown, hidden } = useFitRows<HTMLUListElement, HTMLLIElement>(1, markers.length, markers.map((marker) => marker.key).join("|"));
  const visible = shown === null ? markers : markers.slice(0, shown);

  return (
    <ul ref={list} aria-label={`${title} filters`} className="order-last flex min-w-0 basis-full flex-wrap gap-1.5 sm:order-none sm:flex-1 sm:basis-auto">
      {visible.map((marker) => (
        <li key={marker.key}>
          <FilterPill label={marker.label} onRemove={marker.remove} />
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

// "All have:" under a section's title, from its facets: what every listing shares, as words.
export function sharedLabels(facets: Facets): string[] {
  const { shared } = facets;
  const cancellation = shared.cancellation_policy ? CANCELLATION_WORDS[shared.cancellation_policy] : undefined;
  return [
    ...shared.includes.flatMap((key) => includeLabel(key) ?? []),
    ...(shared.pets ? ["Pets allowed"] : []),
    ...(cancellation ? [cancellation] : []),
  ];
}

const CANCELLATION_WORDS: Record<string, string> = {
  free_cancellation: "Free cancellation",
  seven_days: "Free cancellation up to 7 days",
  fourteen_days: "Free cancellation up to 14 days",
};
