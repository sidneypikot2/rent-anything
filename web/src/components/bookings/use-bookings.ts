"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import type { components } from "@/api/schema";
import { tripError, tripsKey } from "@/components/trips/use-trips";
import { useErrorToast } from "@/components/ui/toast";
import { useSession } from "@/lib/auth/session";

export type GuestBooking = components["schemas"]["guest_booking"];
export type BookingStatus = components["schemas"]["booking_status"];
export type Checkout = components["schemas"]["checkout"];
export type Payment = components["schemas"]["payment_with_bookings"];

export function bookingsKey(userId: number | undefined) {
  return ["bookings", userId] as const;
}

export function paymentKey(userId: number | undefined) {
  return ["payment", userId] as const;
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

// One of the guest's bookings with its history (GET /bookings/:id), for the cart's item panel.
export function useBooking(id: number | undefined) {
  const userId = useSession()?.user.id;
  return useQuery({
    queryKey: [...bookingsKey(userId), id],
    queryFn: async () => {
      const { data } = await apiClient().GET("/api/v1/bookings/{id}", { params: { path: { id: id! } } });
      if (!data) throw new Error("Couldn't load this booking. Try again.");
      return data;
    },
    enabled: userId !== undefined && id !== undefined,
  });
}

export type BookingChanges = components["schemas"]["booking_change_body"];

// PATCH /bookings/:id (RAA-134): new dates or guests. The booking goes back to its partner as
// a request, holding the new dates until they answer; its trip item follows.
export function useChangeBooking() {
  const invalidate = useInvalidateBookings();
  const failed = useErrorToast();
  return useMutation({
    mutationFn: async ({ id, changes }: { id: number; changes: BookingChanges }) => {
      const { data, error } = await apiClient().PATCH("/api/v1/bookings/{id}", {
        params: { path: { id } },
        body: changes,
      });
      if (!data) throw tripError(error, "Couldn't send the change. Try again.");
      return data;
    },
    onSuccess: invalidate,
    onError: failed,
  });
}

export type Contact = { name: string; email: string; phone: string; terms_accepted: boolean };
export type CheckoutRequest = { tripId: number; itemIds: number[]; idempotencyKey: string; contact?: Contact };

// A guest without an account gave an email another guest has (409): the API emailed it a
// code, and the checkout goes ahead once they sign in with it (RAA-177).
export class CodeRequiredError extends Error {}

// POST /checkouts: books the trip's items, all or nothing. The key is made once per
// confirmation, so a retry after a dropped connection returns the same checkout instead of
// booking twice.
export function useCheckout() {
  const invalidate = useInvalidateBookings();
  const failed = useErrorToast();
  return useMutation({
    mutationFn: async ({ tripId, itemIds, idempotencyKey, contact }: CheckoutRequest) => {
      const { data, error, response } = await apiClient().POST("/api/v1/checkouts", {
        body: { trip_id: tripId, item_ids: itemIds, idempotency_key: idempotencyKey, ...(contact && { contact }) },
      });
      if (response.status === 409) throw new CodeRequiredError((error as { error?: string } | undefined)?.error);
      if (!data) throw tripError(error, "Couldn't book those. Try again.");
      return data;
    },
    onSuccess: invalidate,
    // The sheet asks for the code itself.
    onError: (error) => error instanceof CodeRequiredError || failed(error),
  });
}

// POST /bookings/pay (RAA-143): pays for bookings held for payment, all or nothing. With
// PayMongo set up (test mode: no real money moves) it answers a pending payment whose
// checkout_url the guest pays on; otherwise (or when nothing is charged) the bookings come back
// confirmed and payment is null.
export function usePayBookings() {
  const invalidate = useInvalidateBookings();
  const failed = useErrorToast();
  return useMutation({
    mutationFn: async (bookingIds: number[]) => {
      const { data, error } = await apiClient().POST("/api/v1/bookings/pay", { body: { booking_ids: bookingIds } });
      if (!data) throw tripError(error, "Couldn't pay for those. Try again.");
      return data;
    },
    onSuccess: invalidate,
    onError: failed,
  });
}

// The cart asks again every POLL_MS, at most POLLS times, after a payment still pending:
// PayMongo's webhook can lag behind the guest coming back.
const POLL_MS = 2000;
const POLLS = 30;

// GET /payments/:id: a payment the guest came back to the cart with from PayMongo
// (`/cart?payment=<id>`). Asked again while pending, for up to a minute; paid, the cart and
// bookings are fetched again.
export function usePayment(id: number | undefined) {
  const invalidate = useInvalidateBookings();
  const userId = useSession()?.user.id;
  return useQuery({
    queryKey: [...paymentKey(userId), id],
    queryFn: async () => {
      const { data } = await apiClient().GET("/api/v1/payments/{id}", { params: { path: { id: id! } } });
      if (!data) throw new Error("Couldn't load that payment. Try again.");
      if (data.status !== "pending") await invalidate();
      return data;
    },
    enabled: userId !== undefined && id !== undefined,
    refetchInterval: (query) =>
      query.state.data?.status === "pending" && query.state.dataUpdateCount < POLLS ? POLL_MS : false,
  });
}

// POST /bookings/:id/cancel, with an optional reason.
export function useCancelBooking() {
  const invalidate = useInvalidateBookings();
  const failed = useErrorToast();
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
    onError: failed,
  });
}

// A fresh key for one checkout.
export function newIdempotencyKey() {
  return `checkout-${crypto.randomUUID()}`;
}
