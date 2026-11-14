"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import type { PlanBusinessesPage } from "@/api/discovery";
import { filterQuery, NO_FILTERS, setCount, type Facets, type Filters } from "@/components/discovery/filters";
import { todayIso } from "@/components/trips/format";
import { toPlanBusiness, type PlanBusiness, type RowKey } from "./plan-data";

export type PlanPage = { businesses: PlanBusiness[]; total: number; page: number; perPage: number; heartedTotal: number; facets: Facets };

export function toPlanPage(data: PlanBusinessesPage): PlanPage {
  return {
    businesses: data.businesses.map(toPlanBusiness),
    total: data.total,
    page: data.page,
    perPage: data.per_page,
    heartedTotal: data.hearted_total,
    facets: data.facets,
  };
}

// One page of the businesses offering a step in a place, from the API
// (GET /areas/{slug}/plan_businesses): stays and Things to do send the trip's hearted places, so
// the stays closest to them and the businesses with tours to them lead. The page shown stays
// while the next page (or a filter change) of the same step loads; another step shows its skeleton. `initial`: page 1 the server already fetched, for the step it opened on.
// `enabled`: off on Places to see, which has no options. `filters`: the step's own (What to book's
// for its category), applied on the server, so every page, the total and the pins follow them.
// `dates`: the trip's (RAA-315): only listings free on at least one of its days, so a rental booked
// out on every one of them isn't offered; the server's page 1, fetched without them, isn't used then.
export function usePlanBusinesses(
  slug: string,
  key: RowKey,
  page: number,
  hearted: Set<string>,
  initial?: { key: RowKey; data: PlanBusinessesPage },
  enabled = true,
  filters: Filters = NO_FILTERS,
  dates?: { from?: string | null; to?: string | null; people?: number },
) {
  // A trip under way counts from today (the API takes no past dates); one already over, not at all.
  const today = todayIso();
  const dated =
    dates?.from && dates.to && dates.to >= today
      ? { from: dates.from < today ? today : dates.from, to: dates.to, ...(dates.people ? { people: dates.people } : {}) }
      : null;
  const slugs = key === "activity" || key === "stay" ? [...hearted].sort() : [];
  const filtered = filterQuery(filters);
  return useQuery({
    enabled,
    queryKey: ["plan-businesses", slug, key, page, slugs, filtered, dated],
    queryFn: async () => {
      const { data, error } = await apiClient().GET("/api/v1/areas/{slug}/plan_businesses", {
        params: { path: { slug }, query: { group: key, page, ...(slugs.length > 0 ? { "hearted[]": slugs } : {}), ...filtered, ...(dated ?? {}) } },
      });
      if (error || !data) throw new Error("Couldn't load these options");
      return toPlanPage(data);
    },
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === slug && previousQuery?.queryKey[2] === key ? previous : undefined,
    staleTime: 60_000,
    // The server's page 1 needs no hearted order (a stay, or no hearts yet) and no filters.
    initialData:
      initial && initial.key === key && page === 1 && slugs.length === 0 && setCount(filters) === 0 && !dated
        ? toPlanPage(initial.data)
        : undefined,
  });
}
