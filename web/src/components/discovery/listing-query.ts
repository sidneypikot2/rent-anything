import { apiClient } from "@/api/client";

// A listing's own endpoint, fetched once and kept for whoever needs it next.
export function listingQuery(listingId: number) {
  return {
    queryKey: ["listing", listingId],
    queryFn: async () => {
      const { data, error } = await apiClient().GET("/api/v1/listings/{id}", { params: { path: { id: listingId } } });
      if (error || !data) throw new Error("Couldn't load this listing");
      return data;
    },
    staleTime: 5 * 60_000,
  };
}
