"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import type { components } from "@/api/schema";
import { useSession } from "@/lib/auth/session";
import { partnerBusinessesKey } from "./use-partner-businesses";

export type PartnerListing = components["schemas"]["partner_listing"];
export type ListingOptions = components["schemas"]["listing_options"];
export type ListingCategory = ListingOptions["categories"][number];
// What the form sends to add or change a listing.
export type ListingBody = components["schemas"]["listing_body"];

// One cache entry per signed-in partner, so a listing added on /partner/listings/new is on
// the list when the partner lands back there.
function partnerListingsKey(userId: number | undefined) {
  return ["partner-listings", userId] as const;
}

export function partnerListingKey(userId: number | undefined, id: number) {
  return ["partner-listing", userId, id] as const;
}

export function saveError(error: unknown, fallback: string) {
  const errors = error && typeof error === "object" && "errors" in error ? error.errors : undefined;
  return new Error((Array.isArray(errors) && errors.join(". ")) || fallback);
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
    mutationFn: async (body: ListingBody) => {
      const { data, error } = await apiClient().POST("/api/v1/partner/listings", { body });
      if (!data) throw saveError(error, "Couldn't save the listing.");
      return data;
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: partnerListingsKey(userId) }),
        queryClient.invalidateQueries({ queryKey: partnerBusinessesKey(userId) }),
      ]),
  });
}

// One of the partner's listings; null when it isn't theirs or no longer exists (a 404).
// While a photo is confirmed but not ready (being stripped and sized, RAA-106), it is asked
// for again every two seconds, so the photo's sizes replace the original as soon as they exist.
export function usePartnerListing(id: number) {
  const userId = useSession()?.user.id;

  return useQuery({
    queryKey: partnerListingKey(userId, id),
    queryFn: async () => {
      const { data, response } = await apiClient().GET("/api/v1/partner/listings/{id}", {
        params: { path: { id } },
      });
      if (response.status === 404) return null;
      if (!data) throw new Error(`listing request failed (${response.status})`);
      return data;
    },
    enabled: userId !== undefined && Number.isInteger(id),
    refetchInterval: (query) => (query.state.data?.photos.some((photo) => photo.uploaded && !photo.ready) ? 2000 : false),
  });
}

export function useUpdateListing(id: number) {
  const userId = useSession()?.user.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: ListingBody) => {
      const { data, error } = await apiClient().PATCH("/api/v1/partner/listings/{id}", {
        params: { path: { id } },
        body,
      });
      if (!data) throw saveError(error, "Couldn't save the changes.");
      return data;
    },
    onSuccess: (listing) => {
      queryClient.setQueryData(partnerListingKey(userId, id), listing);
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: partnerListingsKey(userId) }),
        queryClient.invalidateQueries({ queryKey: partnerBusinessesKey(userId) }),
      ]);
    },
  });
}

export function useDeleteListing(id: number) {
  const userId = useSession()?.user.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { response } = await apiClient().DELETE("/api/v1/partner/listings/{id}", { params: { path: { id } } });
      if (!response.ok) throw new Error("Couldn't delete the listing.");
    },
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: partnerListingKey(userId, id) });
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: partnerListingsKey(userId) }),
        queryClient.invalidateQueries({ queryKey: partnerBusinessesKey(userId) }),
      ]);
    },
  });
}
