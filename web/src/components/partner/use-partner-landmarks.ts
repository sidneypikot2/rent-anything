"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import type { components } from "@/api/schema";
import type { LatLng } from "@/lib/map";
import { useSession } from "@/lib/auth/session";

export type PartnerLandmark = components["schemas"]["partner_landmark"];

// The landmarks a tour can visit (RAA-70): matching `q`, in one destination when `area`
// is set, nearest the listing's pin first. Every destination with landmarks comes too.
export function usePartnerLandmarks({ q, area, near }: { q: string; area?: string; near: LatLng | null }) {
  const userId = useSession()?.user.id;

  return useQuery({
    queryKey: ["partner-landmarks", userId, q, area, near?.lat, near?.lng],
    queryFn: async () => {
      const { data, response } = await apiClient().GET("/api/v1/partner/landmarks", {
        params: { query: { q: q || undefined, area, lat: near?.lat, lng: near?.lng } },
      });
      if (!data) throw new Error(`landmarks request failed (${response.status})`);
      return data;
    },
    enabled: userId !== undefined,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}
