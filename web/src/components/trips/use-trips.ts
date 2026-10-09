"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { apiClient } from "@/api/client";
import type { components } from "@/api/schema";
import { useSession } from "@/lib/auth/session";

export type Trip = components["schemas"]["trip"];
export type TripItem = components["schemas"]["trip_item"];
export type TripSuggestion = components["schemas"]["trip_suggestion"];

// What the guest is adding: a listing with the dates and guests it was picked for.
export type AddRequest = {
  listingId: number;
  title: string;
  // Range bookings (rentals, stays) take from–to; the others a single day.
  range: boolean;
  startsOn?: string;
  endsOn?: string;
  quantity: number;
};

export function tripsKey(userId: number | undefined) {
  return ["trips", userId] as const;
}

// The API's message for a failed write, or the fallback.
export function tripError(error: unknown, fallback: string) {
  const errors = error && typeof error === "object" && "errors" in error ? error.errors : undefined;
  return new Error((Array.isArray(errors) && errors.join(". ")) || fallback);
}

// Trips the guest can still add to: GET /trips also lists ended ones until they're
// deleted, so the deletion notice can show; those have `deletes_on` set.
export function currentTrips(trips: Trip[] | undefined) {
  return (trips ?? []).filter((trip) => trip.deletes_on === null);
}

function tripsQuery(userId: number | undefined) {
  return {
    queryKey: tripsKey(userId),
    queryFn: async () => {
      const { data } = await apiClient().GET("/api/v1/trips");
      if (!data) throw new Error("Couldn't load your trips. Try again.");
      return data;
    },
  };
}

// The signed-in guest's trips (the cart), when `enabled`.
export function useTrips(enabled: boolean) {
  const userId = useSession()?.user.id;
  return useQuery({ ...tripsQuery(userId), enabled: enabled && userId !== undefined });
}

// The same list, fetched now if it isn't cached: the add flow needs it before it can
// decide whether to ask which trip.
export function useFetchTrips() {
  const queryClient = useQueryClient();
  return useCallback(
    (userId: number) => queryClient.fetchQuery({ ...tripsQuery(userId), staleTime: 0 }),
    [queryClient],
  );
}

// Which trip this item would go to (Trips::Suggest on the server), for the which-trip sheet.
export function useTripSuggestion(
  listingId: number,
  startsOn: string | undefined,
  endsOn: string | undefined,
  enabled: boolean,
) {
  const userId = useSession()?.user.id;
  return useQuery({
    queryKey: ["trip-suggestion", userId, listingId, startsOn ?? null, endsOn ?? null],
    queryFn: async () => {
      const query =
        startsOn && endsOn
          ? { listing_id: listingId, starts_on: startsOn, ends_on: endsOn }
          : { listing_id: listingId };
      const { data, response } = await apiClient().GET("/api/v1/trips/suggestion", { params: { query } });
      if (!data) throw new Error(`suggestion request failed (${response.status})`);
      return data;
    },
    enabled: enabled && userId !== undefined,
  });
}

function useInvalidateTrips() {
  const queryClient = useQueryClient();
  const userId = useSession()?.user.id;
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: tripsKey(userId) }),
      queryClient.invalidateQueries({ queryKey: ["trip-suggestion", userId] }),
    ]);
}

// POST /trip_items: into `tripId`, or a new trip named by the server when it's null.
export function useAddTripItem() {
  const invalidate = useInvalidateTrips();
  return useMutation({
    mutationFn: async ({ request, tripId }: { request: AddRequest; tripId: number | null }) => {
      const { data, error } = await apiClient().POST("/api/v1/trip_items", {
        body: {
          listing_id: request.listingId,
          starts_on: request.startsOn ?? null,
          ends_on: request.endsOn ?? null,
          quantity: request.quantity,
          trip_id: tripId,
        },
      });
      if (!data) throw tripError(error, "Couldn't add it to your trip. Try again.");
      return data;
    },
    onSuccess: invalidate,
  });
}

export type TripChanges = { name: string; guests: number; starts_on?: string | null; ends_on?: string | null };

// PATCH /trips/:id: rename, re-date or change the guests.
export function useUpdateTrip() {
  const invalidate = useInvalidateTrips();
  return useMutation({
    mutationFn: async ({ id, changes }: { id: number; changes: TripChanges }) => {
      const { data, error } = await apiClient().PATCH("/api/v1/trips/{id}", {
        params: { path: { id } },
        body: changes,
      });
      if (!data) throw tripError(error, "Couldn't save the trip. Try again.");
      return data;
    },
    onSuccess: invalidate,
  });
}

// Items in trips the guest is still planning: what the header's cart badge counts.
export function cartItemCount(trips: Trip[] | undefined) {
  return currentTrips(trips).reduce((count, trip) => count + trip.items.length, 0);
}

export type NewTrip = { name: string; guests: number; starts_on: string | null; ends_on: string | null };

// POST /trips: a named trip planned before anything is in it ("Plan a new trip").
export function useCreateTrip() {
  const invalidate = useInvalidateTrips();
  return useMutation({
    mutationFn: async (trip: NewTrip) => {
      const { data, error } = await apiClient().POST("/api/v1/trips", { body: trip });
      if (!data) throw tripError(error, "Couldn't create the trip. Try again.");
      return data;
    },
    onSuccess: invalidate,
  });
}

// DELETE /trips/:id, with its items.
export function useDeleteTrip() {
  const invalidate = useInvalidateTrips();
  return useMutation({
    mutationFn: async (id: number) => {
      const { response, error } = await apiClient().DELETE("/api/v1/trips/{id}", { params: { path: { id } } });
      if (!response.ok) throw tripError(error, "Couldn't delete the trip. Try again.");
    },
    onSuccess: invalidate,
  });
}

// POST /trips/:id/merge: every item of `id` moves into `intoTripId`, and `id` is deleted.
export function useMergeTrip() {
  const invalidate = useInvalidateTrips();
  return useMutation({
    mutationFn: async ({ id, intoTripId }: { id: number; intoTripId: number }) => {
      const { data, error } = await apiClient().POST("/api/v1/trips/{id}/merge", {
        params: { path: { id } },
        body: { into_trip_id: intoTripId },
      });
      if (!data) throw tripError(error, "Couldn't merge the trips. Try again.");
      return data;
    },
    onSuccess: invalidate,
  });
}

export type ItemChanges = { starts_on?: string | null; ends_on?: string | null; move_to_trip_id?: number };

// PATCH /trip_items/:id: re-date an item or move it to another trip. Answers with the trip
// it ends up in.
export function useUpdateTripItem() {
  const invalidate = useInvalidateTrips();
  return useMutation({
    mutationFn: async ({ id, changes }: { id: number; changes: ItemChanges }) => {
      const { data, error } = await apiClient().PATCH("/api/v1/trip_items/{id}", {
        params: { path: { id } },
        body: changes,
      });
      if (!data) throw tripError(error, "Couldn't change the item. Try again.");
      return data;
    },
    onSuccess: invalidate,
  });
}

// DELETE /trip_items/:id.
export function useRemoveTripItem() {
  const invalidate = useInvalidateTrips();
  return useMutation({
    mutationFn: async (id: number) => {
      const { response, error } = await apiClient().DELETE("/api/v1/trip_items/{id}", { params: { path: { id } } });
      if (!response.ok) throw tripError(error, "Couldn't remove it. Try again.");
    },
    onSuccess: invalidate,
  });
}
