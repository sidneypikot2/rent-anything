"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import type { components } from "@/api/schema";
import { saveError } from "@/components/partner/use-partner-listings";

export type AdminBooking = components["schemas"]["admin_booking"];
export type AdminBookingFilter = components["schemas"]["booking_status"] | "all";

const KEY = ["admin-bookings"] as const;

// Every partner's bookings with one status, or all of them (GET /admin/bookings, RAA-141):
// requests come soonest to expire first.
export function useAdminBookings(status: AdminBookingFilter) {
  return useQuery({
    queryKey: [...KEY, status],
    queryFn: async () => {
      const { data } = await apiClient().GET("/api/v1/admin/bookings", { params: { query: { status } } });
      if (!data) throw new Error("Couldn't load the bookings. Try again.");
      return data;
    },
  });
}

// The team's answer to a request on its partner's behalf: accepting takes the guest's payment
// (a stub), so it ends confirmed; declining frees its days. Either way the lists are stale.
export function useAnswerBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, reason }: { id: number; status: "accepted" | "declined"; reason?: string }) => {
      const { data, error } = await apiClient().PATCH("/api/v1/admin/bookings/{id}", {
        params: { path: { id } },
        body: { status, reason },
      });
      if (!data) throw saveError(error, status === "accepted" ? "Couldn't accept the request." : "Couldn't decline the request.");
      return data;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}
