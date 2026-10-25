"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import type { components } from "@/api/schema";
import { useErrorToast } from "@/components/ui/toast";
import { tripError } from "./use-trips";

export type TripShare = components["schemas"]["trip_share"];

const shareKey = (tripId: number) => ["trip-share", tripId];

// The page a share link opens (RAA-178): /trips/shared/<token>, on this site.
export function sharedTripUrl(share: TripShare) {
  return share.path ? `${window.location.origin}${share.path}` : null;
}

// GET /trips/:id/share: the trip's view-only link, or none while it isn't shared.
export function useTripShare(tripId: number) {
  return useQuery({
    queryKey: shareKey(tripId),
    queryFn: async () => {
      const { data, error } = await apiClient().GET("/api/v1/trips/{trip_id}/share", {
        params: { path: { trip_id: tripId } },
      });
      if (!data) throw tripError(error, "Couldn't load the share link. Try again.");
      return data;
    },
  });
}

// POST makes the link, or a new one in place of the old, which stops working; DELETE stops
// sharing. Both answer with the trip's share as it now is.
export function useChangeTripShare(tripId: number) {
  const queryClient = useQueryClient();
  const failed = useErrorToast();
  return useMutation({
    mutationFn: async (change: "create" | "stop"): Promise<TripShare> => {
      const params = { params: { path: { trip_id: tripId } } };
      if (change === "stop") {
        const { response, error } = await apiClient().DELETE("/api/v1/trips/{trip_id}/share", params);
        if (!response.ok) throw tripError(error, "Couldn't stop sharing. Try again.");
        return { token: null, path: null };
      }
      const { data, error } = await apiClient().POST("/api/v1/trips/{trip_id}/share", params);
      if (!data) throw tripError(error, "Couldn't make the share link. Try again.");
      return data;
    },
    onSuccess: (share) => queryClient.setQueryData(shareKey(tripId), share),
    onError: failed,
  });
}
