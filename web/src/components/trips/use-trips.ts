"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { apiClient } from "@/api/client";
import type { components } from "@/api/schema";
import { useErrorToast } from "@/components/ui/toast";
import { useSession } from "@/lib/auth/session";
import { formatPeso } from "@/lib/money";
import type { Room, StayRules } from "./party";

export type Trip = components["schemas"]["trip"];
export type TripItem = components["schemas"]["trip_item"];
export type TripSuggestion = components["schemas"]["trip_suggestion"];
export type TripQuote = components["schemas"]["trip_quote"];
export type ItemQuote = TripQuote["items"][number];

// What the guest is adding: a listing with the dates and guests it was picked for.
export type AddRequest = {
  listingId: number;
  title: string;
  // Range bookings (rentals, stays) take from–to; the others a single day.
  range: boolean;
  bookingType?: string;
  startsOn?: string;
  endsOn?: string;
  quantity: number;
  // Of the guests, the children and infants, and pets beside them: the page's party (RAA-184).
  children?: number;
  infants?: number;
  pets?: number;
  // A stay's split into rooms as the add sheet sends it; null or left out: spread evenly.
  roomGuests?: Room[] | null;
  // What the add sheet shows of the listing, as much as the page that started the add knows.
  preview?: AddPreview;
  // Several of one partner's room types added together (RAA-188, a mix from its panel): each its
  // own item, all added or none. The request's own listing is the first of them.
  mix?: MixItem[];
};

export type MixItem = {
  listingId: number;
  title: string;
  quantity: number;
  roomGuests: Room[] | null;
  pets: number;
  shared: boolean;
};

export type AddPreview = {
  category?: string;
  // "by Santa Fe Island Adventures · in Santa Fe"
  by?: string;
  photo?: { src: string; alt: string } | null;
  // "From ₱1,500 / night", or how an unpriced listing is priced.
  price?: string;
  // A transfer's seats per vehicle, a stay's guests per room (not a shared room's: its guests
  // take a bed each), and how many of them the partner lists ("2 vans", "3 rooms").
  seats?: number | null;
  sleeps?: number | null;
  sharedRoom?: boolean;
  // A tour's group: the fewest guests it runs for and the most it takes.
  tourGuests?: { min: number; max: number } | null;
  unitsCount?: number;
  unitsLabel?: string;
  // A stay's rules for its rooms and guests (party.ts), from its details.
  stayRules?: StayRules | null;
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

// The Trips page's trips (RAA-140): every one with a booked item, whenever it was, latest
// first. Under the cart's key, so whatever refreshes the cart refreshes these too.
export function useBookedTrips() {
  const userId = useSession()?.user.id;
  return useQuery({
    queryKey: [...tripsKey(userId), "booked"],
    queryFn: async () => {
      const { data } = await apiClient().GET("/api/v1/trips", { params: { query: { view: "booked" } } });
      if (!data) throw new Error("Couldn't load your trips. Try again.");
      return data;
    },
    enabled: userId !== undefined,
  });
}

// What a trip's items would cost if booked now, and what stands in the way (GET
// /trips/:id/quote, RAA-139). Under the cart's key, so it is quoted again after any change.
export function useTripQuote(tripId: number) {
  const userId = useSession()?.user.id;
  return useQuery({
    queryKey: [...tripsKey(userId), "quote", tripId],
    queryFn: async () => {
      const { data } = await apiClient().GET("/api/v1/trips/{id}/quote", { params: { path: { id: tripId } } });
      if (!data) throw new Error("Couldn't price this trip.");
      return data;
    },
    enabled: userId !== undefined,
  });
}

// The quote of one item, by id, once the trip's quote has loaded.
export function itemQuote(quote: TripQuote | undefined, item: TripItem) {
  return quote?.items.find((line) => line.trip_item_id === item.id);
}

// "₱12,300", with what is priced with the partner after it: "₱12,300 + 1 to agree".
export function quoteTotal(totalCents: number, toBeAgreed: number) {
  if (toBeAgreed === 0) return formatPeso(totalCents);
  if (totalCents > 0) return `${formatPeso(totalCents)} + ${toBeAgreed} to agree with the partner`;
  return toBeAgreed === 1 ? "Price to agree with the partner" : `${toBeAgreed} prices to agree with the partner`;
}

// What the picked items come to, from the trip's quote.
export function pickedTotal(quote: TripQuote | undefined, items: TripItem[]) {
  const lines = items.flatMap((item) => {
    const line = itemQuote(quote, item);
    return line && !line.problem ? [line] : [];
  });
  if (!quote || lines.length < items.length) return null;
  return quoteTotal(
    lines.reduce((sum, line) => sum + (line.total_cents ?? 0), 0),
    lines.filter((line) => line.to_be_agreed).length,
  );
}

// An item's price on its own: the quote's total, or "Price to agree" for a rental or transfer;
// null while the quote loads or when the item has a problem.
export function itemPriceLabel(quote: ItemQuote | undefined) {
  if (!quote || quote.problem || quote.total_cents === null) return null;
  return quote.to_be_agreed ? "Price to agree" : formatPeso(quote.total_cents);
}

// Why an item can't be booked as it is: its listing is off (from the trip itself, so it
// shows before the quote), or the quote's problem. A booked item has none.
export function itemProblem(item: TripItem, quote: ItemQuote | undefined) {
  if (item.booking) return null;
  if (!item.listing_active) return "Isn't available to book any more";
  return quote?.problem ?? (item.unavailable ? `Not available: ${item.unavailable}` : null);
}

export type CopyChanges = { name: string; guests: number; starts_on?: string };

// POST /trips/:id/copy: the trip again from a new start date (RAA-139), nothing booked.
// Answers with the new trip and the items left out.
export function useCopyTrip() {
  const invalidate = useInvalidateTrips();
  const failed = useErrorToast();
  return useMutation({
    mutationFn: async ({ id, changes }: { id: number; changes: CopyChanges }) => {
      const { data, error } = await apiClient().POST("/api/v1/trips/{id}/copy", {
        params: { path: { id } },
        body: changes,
      });
      if (!data) throw tripError(error, "Couldn't plan the trip again. Try again.");
      return data;
    },
    onSuccess: invalidate,
    onError: failed,
  });
}

// The trip a signed-in guest comes back to on the home page (RAA-130): their first current one,
// as GET /trips puts dated trips first, soonest first. Undefined for anyone else, or until loaded.
export function useContinueTrip() {
  const isGuest = useSession()?.user.role === "guest";
  const trips = useTrips(isGuest);
  return isGuest ? currentTrips(trips.data)[0] : undefined;
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

// POST /trip_items: into `tripId`, or a new trip when it's null: named `tripName` if the guest
// typed one, otherwise by the server (after the destination and dates).
export function useAddTripItem() {
  const invalidate = useInvalidateTrips();
  const failed = useErrorToast();
  return useMutation({
    mutationFn: async ({
      request,
      tripId,
      tripName,
    }: {
      request: AddRequest;
      tripId: number | null;
      tripName?: string;
    }) => {
      const trip = {
        trip_id: tripId,
        ...(tripId === null && tripName?.trim() ? { trip_name: tripName.trim() } : {}),
      };
      const dates = { starts_on: request.startsOn ?? null, ends_on: request.endsOn ?? null };
      // A mix (RAA-188) goes in one request, all its items or none.
      const body = request.mix
        ? {
            items: request.mix.map((item) => ({
              listing_id: item.listingId,
              ...dates,
              quantity: item.quantity,
              ...(item.roomGuests ? { room_guests: item.roomGuests } : {}),
              ...(item.pets ? { pets: item.pets } : {}),
            })),
            ...trip,
          }
        : null;
      const { data, error } = await apiClient().POST("/api/v1/trip_items", {
        body: body ?? {
          listing_id: request.listingId,
          starts_on: request.startsOn ?? null,
          ends_on: request.endsOn ?? null,
          quantity: request.quantity,
          ...(request.roomGuests ? { room_guests: request.roomGuests } : {}),
          ...(request.pets ? { pets: request.pets } : {}),
          ...trip,
        },
      });
      if (!data) throw tripError(error, "Couldn't add it to your trip. Try again.");
      return data;
    },
    onSuccess: invalidate,
    onError: failed,
  });
}

export type TripChanges = {
  name: string;
  guests: number;
  children?: number;
  infants?: number;
  pets?: number;
  starts_on?: string | null;
  ends_on?: string | null;
};

// PATCH /trips/:id: rename, re-date or change the guests.
export function useUpdateTrip() {
  const invalidate = useInvalidateTrips();
  const failed = useErrorToast();
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
    onError: failed,
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
  const failed = useErrorToast();
  return useMutation({
    mutationFn: async (trip: NewTrip) => {
      const { data, error } = await apiClient().POST("/api/v1/trips", { body: trip });
      if (!data) throw tripError(error, "Couldn't create the trip. Try again.");
      return data;
    },
    onSuccess: invalidate,
    onError: failed,
  });
}

// DELETE /trips/:id, with its items.
export function useDeleteTrip() {
  const invalidate = useInvalidateTrips();
  const failed = useErrorToast();
  return useMutation({
    mutationFn: async (id: number) => {
      const { response, error } = await apiClient().DELETE("/api/v1/trips/{id}", { params: { path: { id } } });
      if (!response.ok) throw tripError(error, "Couldn't delete the trip. Try again.");
    },
    onSuccess: invalidate,
    onError: failed,
  });
}

// POST /trips/:id/merge: every item of `id` moves into `intoTripId`, and `id` is deleted.
export function useMergeTrip() {
  const invalidate = useInvalidateTrips();
  const failed = useErrorToast();
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
    onError: failed,
  });
}

export type ItemChanges = {
  starts_on?: string | null;
  ends_on?: string | null;
  quantity?: number;
  // A stay's split into rooms (null: spread evenly) and its pets (RAA-184).
  room_guests?: Room[] | null;
  pets?: number;
  move_to_trip_id?: number;
};

// PATCH /trip_items/:id: re-date an item or move it to another trip. Answers with the trip
// it ends up in.
export function useUpdateTripItem() {
  const invalidate = useInvalidateTrips();
  const failed = useErrorToast();
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
    onError: failed,
  });
}

// DELETE /trip_items/:id.
export function useRemoveTripItem() {
  const invalidate = useInvalidateTrips();
  const failed = useErrorToast();
  return useMutation({
    mutationFn: async (id: number) => {
      const { response, error } = await apiClient().DELETE("/api/v1/trip_items/{id}", { params: { path: { id } } });
      if (!response.ok) throw tripError(error, "Couldn't remove it. Try again.");
    },
    onSuccess: invalidate,
    onError: failed,
  });
}
