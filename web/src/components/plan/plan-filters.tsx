"use client";

import { useState } from "react";
import { FilterMarkers, FilterPanel } from "@/components/discovery/filter-panel";
import { NO_FILTERS, setCount, type Facets, type Filters } from "@/components/discovery/filters";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { RowKey } from "./plan-data";
import { usePlanBusinesses } from "./use-plan-businesses";

// A plan step's filters (2026-11-10) are What to book's for its category, the same panel
// (FilterPanel): free cancellation, pet-friendly stays, a price range, a rental's vehicle,
// transmission, drop-off and pick-up, what the listings include. The server applies them
// (plan_businesses, Discovery::ListingFilters) and counts the choices (`facets`).

// The step's filters in What to book's sheet: its panel, Clear all, and "Show N results" counted
// by the server with the filters as edited. Closes freely: nothing is lost but an unapplied choice.
export function PlanFilterDialog({
  title,
  slug,
  stepKey,
  hearted,
  facets,
  filters,
  dates,
  onApply,
  onClose,
}: {
  title: string;
  // The trip's dates, so the count matches the step's (RAA-315).
  dates?: { from?: string | null; to?: string | null };
  slug: string;
  stepKey: RowKey;
  hearted: Set<string>;
  facets: Facets;
  filters: Filters;
  onApply: (next: Filters) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(filters);
  const matching = usePlanBusinesses(slug, stepKey, 1, hearted, undefined, true, draft, dates);
  const count = matching.data?.total;
  return (
    <Dialog
      open
      placement="sheet"
      title={title}
      meta="Filter what shows here"
      onClose={onClose}
      data-testid="plan-filter-dialog"
      summary={
        setCount(draft) > 0 && (
          <button
            type="button"
            onClick={() => setDraft(NO_FILTERS)}
            className="text-sm font-semibold text-link underline-offset-4 hover:underline"
          >
            Clear all
          </button>
        )
      }
      actions={
        <Button type="button" loading={count === undefined} onClick={() => onApply(draft)} data-testid="plan-filter-apply">
          {count === undefined ? "Show results" : `Show ${count} ${count === 1 ? "result" : "results"}`}
        </Button>
      }
    >
      {/* The facets of the step before the draft: counts that don't jump while ticking. */}
      <FilterPanel group={stepKey} facets={matching.data?.facets ?? facets} filters={draft} onChange={setDraft} />
    </Dialog>
  );
}

// What is set in a step's filters, as What to book's pills (one row, "+N more" opens the
// filters), then Clear.
export function PlanFilterPills({
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
  if (setCount(filters) === 0) return null;
  return (
    <div className="flex min-w-0 items-center gap-2" data-testid="plan-filter-pills">
      <FilterMarkers title={title} filters={filters} facets={facets} onChange={onChange} onMore={onMore} />
      <button
        type="button"
        onClick={() => onChange(NO_FILTERS)}
        className="shrink-0 text-sm font-semibold text-link underline-offset-4 hover:underline"
      >
        Clear
      </button>
    </div>
  );
}
