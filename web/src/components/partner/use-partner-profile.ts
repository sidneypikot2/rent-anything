"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import type { components } from "@/api/schema";
import { useSession } from "@/lib/auth/session";

export type PartnerProfile = components["schemas"]["partner_profile"];

// One cache entry per signed-in partner: the banner and the profile page share it, so
// saving the profile hides the banner without another request.
export function partnerProfileKey(userId: number | undefined) {
  return ["partner-profile", userId] as const;
}

export function usePartnerProfile() {
  const session = useSession();
  const userId = session?.user.id;

  return useQuery({
    queryKey: partnerProfileKey(userId),
    queryFn: async () => {
      const { data, response } = await apiClient().GET("/api/v1/partner/profile");
      if (!data) throw new Error(`profile request failed (${response.status})`);
      return data;
    },
    enabled: userId !== undefined,
  });
}
