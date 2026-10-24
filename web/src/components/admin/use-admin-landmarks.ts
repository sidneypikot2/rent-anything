"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import type { components } from "@/api/schema";
import { saveError } from "@/components/partner/use-partner-listings";

export type AdminLandmark = components["schemas"]["admin_landmark"];
export type AdminLandmarkRow = components["schemas"]["admin_landmark_row"];
export type AdminLandmarkBody = components["schemas"]["admin_landmark_body"];
export type LandmarkStatus = AdminLandmark["status"];

export type LandmarkFilters = { q: string; status: LandmarkStatus | ""; page: number };

// What the API's list serves at once (Admin::LandmarksController::PER_PAGE).
export const LANDMARKS_PER_PAGE = 50;

const LIST_KEY = ["admin-landmarks"] as const;
const landmarkKey = (slug: string) => ["admin-landmark", slug] as const;

// Every landmark (place to see), drafts included (GET /admin/landmarks, RAA-164): published
// first, then by name; `q` matches the name, slug or an alias. The last page stays shown while
// the next loads.
export function useAdminLandmarks({ q, status, page }: LandmarkFilters) {
  return useQuery({
    queryKey: [...LIST_KEY, q, status, page],
    queryFn: async () => {
      const { data } = await apiClient().GET("/api/v1/admin/landmarks", {
        params: { query: { q: q || undefined, status: status || undefined, page } },
      });
      if (!data) throw new Error("Couldn't load the places to see. Try again.");
      return data;
    },
    placeholderData: keepPreviousData,
  });
}

export function useAdminLandmark(slug: string | undefined) {
  return useQuery({
    queryKey: landmarkKey(slug ?? ""),
    queryFn: async () => {
      const { data } = await apiClient().GET("/api/v1/admin/landmarks/{slug}", { params: { path: { slug: slug! } } });
      if (!data) throw new Error("Couldn't load the place to see. Try again.");
      return data;
    },
    enabled: slug !== undefined,
  });
}

// Adds a landmark (no slug yet) or changes one: on a change, a field left out is kept. The
// slug can change too, so the saved landmark is cached under the slug it comes back with.
export function useSaveLandmark() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ slug, body }: { slug?: string; body: AdminLandmarkBody }) => {
      const client = apiClient();
      const { data, error } = slug
        ? await client.PATCH("/api/v1/admin/landmarks/{slug}", { params: { path: { slug } }, body })
        : await client.POST("/api/v1/admin/landmarks", { body });
      if (!data) throw saveError(error, "Couldn't save the place to see.");
      return data;
    },
    onSuccess: (landmark) => {
      queryClient.setQueryData(landmarkKey(landmark.slug), landmark);
      return queryClient.invalidateQueries({ queryKey: LIST_KEY });
    },
  });
}
