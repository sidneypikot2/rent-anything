"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import type { components } from "@/api/schema";
import { useSession } from "@/lib/auth/session";

// A business the partner runs (RAA-100), with how many listings it has.
export type PartnerBusiness = components["schemas"]["partner_business"];
// What the form sends to add or change a business.
export type BusinessBody = components["schemas"]["business_body"];

// One cache entry per signed-in partner. Adding, moving or deleting a listing changes the
// counts, so the listing mutations invalidate it too.
export function partnerBusinessesKey(userId: number | undefined) {
  return ["partner-businesses", userId] as const;
}

function partnerBusinessKey(userId: number | undefined, id: number) {
  return ["partner-business", userId, id] as const;
}

function saveError(error: unknown, fallback: string) {
  const errors = error && typeof error === "object" && "errors" in error ? error.errors : undefined;
  return new Error((Array.isArray(errors) && errors.join(". ")) || fallback);
}

// The partner's businesses, ordered by name.
export function usePartnerBusinesses() {
  const userId = useSession()?.user.id;

  return useQuery({
    queryKey: partnerBusinessesKey(userId),
    queryFn: async () => {
      const { data, response } = await apiClient().GET("/api/v1/partner/businesses");
      if (!data) throw new Error(`businesses request failed (${response.status})`);
      return data;
    },
    enabled: userId !== undefined,
  });
}

// One of the partner's businesses; null when it isn't theirs or doesn't exist (a 404).
export function usePartnerBusiness(id: number) {
  const userId = useSession()?.user.id;

  return useQuery({
    queryKey: partnerBusinessKey(userId, id),
    queryFn: async () => {
      const { data, response } = await apiClient().GET("/api/v1/partner/businesses/{id}", {
        params: { path: { id } },
      });
      if (response.status === 404) return null;
      if (!data) throw new Error(`business request failed (${response.status})`);
      return data;
    },
    enabled: userId !== undefined && Number.isInteger(id),
  });
}

export function useCreateBusiness() {
  const userId = useSession()?.user.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: BusinessBody) => {
      const { data, error } = await apiClient().POST("/api/v1/partner/businesses", { body });
      if (!data) throw saveError(error, "Couldn't save the business.");
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: partnerBusinessesKey(userId) }),
  });
}

// A renamed business shows on the partner's listings too, so those are refetched as well.
export function useUpdateBusiness(id: number) {
  const userId = useSession()?.user.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: BusinessBody) => {
      const { data, error } = await apiClient().PATCH("/api/v1/partner/businesses/{id}", {
        params: { path: { id } },
        body,
      });
      if (!data) throw saveError(error, "Couldn't save the changes.");
      return data;
    },
    onSuccess: (business) => {
      queryClient.setQueryData(partnerBusinessKey(userId, id), business);
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: partnerBusinessesKey(userId) }),
        queryClient.invalidateQueries({ queryKey: ["partner-listings", userId] }),
        queryClient.invalidateQueries({ queryKey: ["partner-listing", userId] }),
      ]);
    },
  });
}
