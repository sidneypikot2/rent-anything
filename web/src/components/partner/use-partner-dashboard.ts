"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import type { components } from "@/api/schema";
import { useSession } from "@/lib/auth/session";

export type PartnerDashboard = components["schemas"]["partner_dashboard"];
export type DashboardActivity = PartnerDashboard["activity"][number];

export function partnerDashboardKey(userId: number | undefined) {
  return ["partner-dashboard", userId] as const;
}

// The partner dashboard's figures and to-dos in one call (RAA-266, RAA-284). Anything that
// changes a booking, a listing or the partner's setup invalidates it with the queries it already
// refreshes.
export function usePartnerDashboard() {
  const userId = useSession()?.user.id;
  return useQuery({
    queryKey: partnerDashboardKey(userId),
    queryFn: async () => {
      const { data, response } = await apiClient().GET("/api/v1/partner/dashboard");
      if (!data) throw new Error(`dashboard request failed (${response.status})`);
      return data;
    },
    enabled: userId !== undefined,
  });
}
