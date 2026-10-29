"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { stayRules } from "./party";

// A stay's rooms rules (what each room sleeps, its rooms, pets), from its listing, for the sheets
// that change its rooms and guests. Asked only for a stay; null until it loads.
export function useStayRules(listingId: number, stay: boolean) {
  const { data: listing } = useQuery({
    queryKey: ["listing", listingId],
    queryFn: async () => {
      const { data, error } = await apiClient().GET("/api/v1/listings/{id}", { params: { path: { id: listingId } } });
      if (error || !data) throw new Error("Couldn't load this listing");
      return data;
    },
    enabled: stay,
    staleTime: 5 * 60_000,
  });
  return stay && listing ? stayRules(listing.details, listing.units_count, listing.fees) : null;
}
