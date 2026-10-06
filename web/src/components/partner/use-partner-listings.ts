"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import type { components, paths } from "@/api/schema";
import { useSession } from "@/lib/auth/session";

export type PartnerListing = components["schemas"]["partner_listing"];
export type ListingOptions = components["schemas"]["listing_options"];
export type ListingCategory = ListingOptions["categories"][number];
export type NewListing = NonNullable<
  paths["/api/v1/partner/listings"]["post"]["requestBody"]
>["content"]["application/json"];

// One cache entry per signed-in partner, so a listing added on /partner/listings/new is on
// the list when the partner lands back there.
function partnerListingsKey(userId: number | undefined) {
  return ["partner-listings", userId] as const;
}

export function usePartnerListings() {
  const userId = useSession()?.user.id;

  return useQuery({
    queryKey: partnerListingsKey(userId),
    queryFn: async () => {
      const { data, response } = await apiClient().GET("/api/v1/partner/listings");
      if (!data) throw new Error(`listings request failed (${response.status})`);
      return data;
    },
    enabled: userId !== undefined,
  });
}

// The categories and areas the add-listing form offers.
export function useListingOptions() {
  const userId = useSession()?.user.id;

  return useQuery({
    queryKey: ["partner-listing-options", userId],
    queryFn: async () => {
      const { data, response } = await apiClient().GET("/api/v1/partner/listing_options");
      if (!data) throw new Error(`listing options request failed (${response.status})`);
      return data;
    },
    enabled: userId !== undefined,
  });
}

export function useCreateListing() {
  const userId = useSession()?.user.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: NewListing) => {
      const { data, error } = await apiClient().POST("/api/v1/partner/listings", { body });
      if (!data) {
        const message = (error && "errors" in error && error.errors?.join(". ")) || "Couldn't save the listing.";
        throw new Error(message);
      }
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: partnerListingsKey(userId) }),
  });
}
