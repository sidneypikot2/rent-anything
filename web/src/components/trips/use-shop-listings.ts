import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { MAX_PER_PAGE } from "@/api/pages";

export type ShopGroup = "rental" | "gear";

// A business's listings in a category or a group (gear of every kind in one sheet, RAA-255), with
// their units free on the dates (GET /businesses/{id}/listings): the booking card's free count and
// the shop pop-up's models. A rental's are counted from `pickupTime` to its return (RAA-195; left
// out, the shop's default).
export function useShopListings(
  businessId: number,
  { category, group }: { category?: string; group?: ShopGroup },
  from?: string,
  to?: string,
  pickupTime?: string | null,
) {
  return useQuery({
    queryKey: ["shop-listings", businessId, category ?? null, group ?? null, from ?? null, to ?? null, pickupTime ?? null],
    queryFn: async () => {
      const { data, error } = await apiClient().GET("/api/v1/businesses/{business_id}/listings", {
        params: {
          path: { business_id: businessId },
          query: { category, group, per_page: MAX_PER_PAGE, ...(from && to ? { starts_on: from, ends_on: to } : {}), ...(pickupTime ? { pickup_time: pickupTime } : {}) },
        },
      });
      if (error || !data) throw new Error("Couldn't load this shop's rentals");
      return data;
    },
    staleTime: 60_000,
    // New dates or a new pickup time keep the last counts on screen while they are asked again.
    placeholderData: keepPreviousData,
  });
}
