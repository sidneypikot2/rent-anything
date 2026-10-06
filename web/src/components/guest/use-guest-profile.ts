"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import type { components } from "@/api/schema";
import { useSession } from "@/lib/auth/session";

export type GuestProfile = components["schemas"]["guest_profile"];

// One cache entry per signed-in guest: the banner and the profile page share it, so
// saving the profile hides the banner without another request.
export function guestProfileKey(userId: number | undefined) {
  return ["guest-profile", userId] as const;
}

export function useGuestProfile() {
  const session = useSession();
  const userId = session?.user.id;

  return useQuery({
    queryKey: guestProfileKey(userId),
    queryFn: async () => {
      const { data, response } = await apiClient().GET("/api/v1/me/profile");
      if (!data) throw new Error(`profile request failed (${response.status})`);
      return data;
    },
    enabled: userId !== undefined,
  });
}
