import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";

// A business's listings in a category, with their units free on the dates (GET
// /businesses/{id}/listings): the booking card's free count and the shop pop-up's models.
export function useShopListings(businessId: number, category: string, from?: string, to?: string) {
  return useQuery({
    queryKey: ["shop-listings", businessId, category, from ?? null, to ?? null],
    queryFn: async () => {
      const { data, error } = await apiClient().GET("/api/v1/businesses/{business_id}/listings", {
        params: {
          path: { business_id: businessId },
          query: { category, ...(from && to ? { starts_on: from, ends_on: to } : {}) },
        },
      });
      if (error || !data) throw new Error("Couldn't load this shop's vehicles");
      return data;
    },
    staleTime: 60_000,
  });
}
