"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import type { components } from "@/api/schema";
import { tripError, tripsKey } from "@/components/trips/use-trips";
import { useSession } from "@/lib/auth/session";

export type GuestBooking = components["schemas"]["guest_booking"];
export type BookingStatus = components["schemas"]["booking_status"];
export type Checkout = components["schemas"]["checkout"];

export function bookingsKey(userId: number | undefined) {
  return ["bookings", userId] as const;
}

// A checkout changes the guest's bookings and the cart's items (each now shows its booking).
function useInvalidateBookings() {
  const queryClient = useQueryClient();
  const userId = useSession()?.user.id;
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: bookingsKey(userId) }),
      queryClient.invalidateQueries({ queryKey: tripsKey(userId) }),
    ]);
}

// The signed-in guest's bookings, upcoming first (GET /bookings, RAA-133).
export function useBookings() {
  const userId = useSession()?.user.id;
  return useQuery({
    queryKey: bookingsKey(userId),
    queryFn: async () => {
      const { data } = await apiClient().GET("/api/v1/bookings");
      if (!data) throw new Error("Couldn't load your bookings. Try again.");
      return data;
    },
    enabled: userId !== undefined,
  });
}

export type CheckoutRequest = { tripId: number; itemIds: number[]; idempotencyKey: string };

// POST /checkouts: books the trip's items, all or nothing. The key is made once per
// confirmation, so a retry after a dropped connection returns the same checkout instead of
// booking twice.
export function useCheckout() {
  const invalidate = useInvalidateBookings();
  return useMutation({
    mutationFn: async ({ tripId, itemIds, idempotencyKey }: CheckoutRequest) => {
      const { data, error } = await apiClient().POST("/api/v1/checkouts", {
        body: { trip_id: tripId, item_ids: itemIds, idempotency_key: idempotencyKey },
      });
      if (!data) throw tripError(error, "Couldn't book those. Try again.");
      return data;
    },
    onSuccess: invalidate,
  });
}

// POST /bookings/:id/cancel, with an optional reason.
export function useCancelBooking() {
  const invalidate = useInvalidateBookings();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason?: string }) => {
      const { data, error } = await apiClient().POST("/api/v1/bookings/{id}/cancel", {
        params: { path: { id } },
        body: reason ? { reason } : {},
      });
      if (!data) throw tripError(error, "Couldn't cancel the booking. Try again.");
      return data;
    },
    onSuccess: invalidate,
  });
}

// A fresh key for one checkout.
export function newIdempotencyKey() {
  return `checkout-${crypto.randomUUID()}`;
}
