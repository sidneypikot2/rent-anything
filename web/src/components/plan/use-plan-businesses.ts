"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import type { PlanBusinessesPage } from "@/api/discovery";
import { toPlanBusiness, type PlanBusiness, type RowKey } from "./plan-data";

export type PlanPage = { businesses: PlanBusiness[]; total: number; page: number; perPage: number; heartedTotal: number };

export function toPlanPage(data: PlanBusinessesPage): PlanPage {
  return {
    businesses: data.businesses.map(toPlanBusiness),
    total: data.total,
    page: data.page,
    perPage: data.per_page,
    heartedTotal: data.hearted_total,
  };
}

// One page of the businesses offering a step in a place, from the API
// (GET /areas/{slug}/plan_businesses): Things to do send the trip's hearted places, so the
// businesses with tours to them lead. The page shown stays while the next loads. `initial`:
// page 1 the server already fetched, for the step it opened on.
export function usePlanBusinesses(
  slug: string,
  key: RowKey,
  page: number,
  hearted: Set<string>,
  initial?: { key: RowKey; data: PlanBusinessesPage },
) {
  const slugs = key === "activity" ? [...hearted].sort() : [];
  return useQuery({
    queryKey: ["plan-businesses", slug, key, page, slugs],
    queryFn: async () => {
      const { data, error } = await apiClient().GET("/api/v1/areas/{slug}/plan_businesses", {
        params: { path: { slug }, query: { group: key, page, ...(slugs.length > 0 ? { "hearted[]": slugs } : {}) } },
      });
      if (error || !data) throw new Error("Couldn't load these options");
      return toPlanPage(data);
    },
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    // The server's page 1 needs no hearted order (a stay, or no hearts yet).
    initialData: initial && initial.key === key && page === 1 && slugs.length === 0 ? toPlanPage(initial.data) : undefined,
  });
}
