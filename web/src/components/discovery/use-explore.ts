"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import type { Explore } from "@/api/discovery";
import type { LatLng } from "@/lib/map";

// What is around a map pin (RAA-57): listings within km, island-clipped on the server,
// nearby destinations and recommended ones. null skips the request. The previous result
// stays on screen while a new radius loads, so the lists don't flash empty.
export function useExplore(pin: LatLng | null, km: number) {
  return useQuery({
    queryKey: ["explore", pin?.lat, pin?.lng, km],
    queryFn: async (): Promise<Explore> => {
      const { data, error } = await apiClient().GET("/api/v1/explore", {
        params: { query: { lat: pin!.lat, lng: pin!.lng, km } },
      });
      if (error || !data) throw new Error("Couldn't load what's nearby");
      return data;
    },
    enabled: pin !== null,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}
