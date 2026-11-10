"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import type { components } from "@/api/schema";

export type AdminOverview = components["schemas"]["admin_overview"];
export type OverviewDays = AdminOverview["days"];
export type OverviewMetric = keyof AdminOverview["totals"];

// How the app is doing per Manila day (GET /admin/overview, RAA-290). Switching range keeps the
// last range on screen until the new one loads, so the chart doesn't blink empty.
export function useAdminOverview(days: OverviewDays) {
  return useQuery({
    queryKey: ["admin-overview", days],
    queryFn: async () => {
      const { data } = await apiClient().GET("/api/v1/admin/overview", { params: { query: { days: String(days) as "7" | "30" | "90" } } });
      if (!data) throw new Error("Couldn't load the overview. Try again.");
      return data;
    },
    placeholderData: keepPreviousData,
  });
}
