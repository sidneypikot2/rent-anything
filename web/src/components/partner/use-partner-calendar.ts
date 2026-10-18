"use client";

import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { apiClient } from "@/api/client";
import type { components } from "@/api/schema";
import { useSession } from "@/lib/auth/session";
import { todayIso } from "@/lib/dates";
import { addDays, daysBetween } from "./calendar/calendar-dates";
import { saveError } from "./use-partner-listings";

type PartnerCalendar = components["schemas"]["partner_calendar"];
export type CalendarListing = components["schemas"]["calendar_listing"];
export type CalendarDay = components["schemas"]["calendar_day"];
export type CalendarBlock = components["schemas"]["availability_block"];
export type CalendarBooking = components["schemas"]["booking"];
export type CalendarDaysBody = components["schemas"]["calendar_days_body"];
export type OfflineBookingBody = components["schemas"]["offline_booking_body"];

type Window = { from: string; to: string };

// The calendar loads in windows (the API serves at most 92 days at a time): the first from
// two weeks back to six weeks ahead, then a month more each way as the partner scrolls.
const BEFORE_TODAY = 14;
const AFTER_TODAY = 45;
const STEP = 31;

function partnerCalendarKey(userId: number | undefined) {
  return ["partner-calendar", userId] as const;
}

// Every window loaded so far, merged per listing into one run of days with the blocks and
// bookings that touch any of them.
export function usePartnerCalendar() {
  const userId = useSession()?.user.id;

  const query = useInfiniteQuery({
    queryKey: partnerCalendarKey(userId),
    queryFn: async ({ pageParam }: { pageParam: Window }) => {
      const { data, response } = await apiClient().GET("/api/v1/partner/calendar", { params: { query: pageParam } });
      if (!data) throw new Error(`calendar request failed (${response.status})`);
      return data;
    },
    initialPageParam: { from: addDays(todayIso(), -BEFORE_TODAY), to: addDays(todayIso(), AFTER_TODAY) },
    getNextPageParam: (last) => ({ from: addDays(last.to, 1), to: addDays(last.to, STEP) }),
    getPreviousPageParam: (first) => ({ from: addDays(first.from, -STEP), to: addDays(first.from, -1) }),
    enabled: userId !== undefined,
  });

  const calendar = useMemo(() => (query.data ? merge(query.data) : undefined), [query.data]);
  return { ...query, calendar };
}

function merge(data: { pages: PartnerCalendar[] }) {
  const pages = data.pages;
  const byId = new Map<number, CalendarListing>();
  for (const page of pages) {
    for (const listing of page.listings) {
      const seen = byId.get(listing.id);
      if (!seen) {
        byId.set(listing.id, { ...listing, days: [...listing.days] });
        continue;
      }
      seen.days.push(...listing.days);
      seen.blocks = uniqueById([...seen.blocks, ...listing.blocks]);
      seen.bookings = uniqueById([...seen.bookings, ...listing.bookings]);
    }
  }
  // A listing added since the first window has fewer days than the rest: it isn't shown
  // until the calendar reloads, so every row lines up with the header.
  const span = pages.reduce((count, page) => count + 1 + daysBetween(page.from, page.to), 0);
  const listings = [...byId.values()].filter((listing) => listing.days.length === span);
  return { from: pages[0].from, to: pages[pages.length - 1].to, listings };
}

function uniqueById<T extends { id: number }>(items: T[]) {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}

// Each change reloads every window: a booking or block changes the days around it.
function useCalendarMutation<Vars>(mutationFn: (vars: Vars) => Promise<unknown>) {
  const userId = useSession()?.user.id;
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: partnerCalendarKey(userId) }),
  });
}

export function useSetCalendarDays() {
  return useCalendarMutation(async ({ listingId, body }: { listingId: number; body: CalendarDaysBody }) => {
    const { data, error } = await apiClient().PATCH("/api/v1/partner/listings/{listing_id}/calendar_days", {
      params: { path: { listing_id: listingId } },
      body,
    });
    if (!data) throw saveError(error, "Couldn't change those days.");
  });
}

export function useSaveBlock() {
  return useCalendarMutation(
    async ({ listingId, id, body }: { listingId: number; id?: number; body: components["schemas"]["availability_block_body"] }) => {
      const { data, error } = id
        ? await apiClient().PATCH("/api/v1/partner/listings/{listing_id}/availability_blocks/{id}", {
            params: { path: { listing_id: listingId, id } },
            body,
          })
        : await apiClient().POST("/api/v1/partner/listings/{listing_id}/availability_blocks", {
            params: { path: { listing_id: listingId } },
            body,
          });
      if (!data) throw saveError(error, "Couldn't save the block.");
    },
  );
}

export function useRemoveBlock() {
  return useCalendarMutation(async ({ listingId, id }: { listingId: number; id: number }) => {
    const { response, error } = await apiClient().DELETE("/api/v1/partner/listings/{listing_id}/availability_blocks/{id}", {
      params: { path: { listing_id: listingId, id } },
    });
    if (!response.ok) throw saveError(error, "Couldn't unblock those days.");
  });
}

export function useAddBooking() {
  return useCalendarMutation(async ({ listingId, body }: { listingId: number; body: OfflineBookingBody }) => {
    const { data, error } = await apiClient().POST("/api/v1/partner/listings/{listing_id}/bookings", {
      params: { path: { listing_id: listingId } },
      body,
    });
    if (!data) throw saveError(error, "Couldn't add the booking.");
  });
}

export function useCancelBooking() {
  return useCalendarMutation(async ({ listingId, id }: { listingId: number; id: number }) => {
    const { data, error } = await apiClient().PATCH("/api/v1/partner/listings/{listing_id}/bookings/{id}", {
      params: { path: { listing_id: listingId, id } },
      body: { status: "cancelled" },
    });
    if (!data) throw saveError(error, "Couldn't cancel the booking.");
  });
}

// A guest's request answered (RAA-133): accepting takes their payment, so it ends confirmed;
// declining frees its days.
export function useAnswerRequest() {
  return useCalendarMutation(
    async ({ listingId, id, status }: { listingId: number; id: number; status: "accepted" | "declined" }) => {
      const { data, error } = await apiClient().PATCH("/api/v1/partner/listings/{listing_id}/bookings/{id}", {
        params: { path: { listing_id: listingId, id } },
        body: { status },
      });
      if (!data) throw saveError(error, status === "accepted" ? "Couldn't accept the request." : "Couldn't decline the request.");
    },
  );
}

// Not yet confirmed: a request waiting for the partner, or a booking waiting for its payment.
// It holds its days all the same.
export function isPendingBooking(booking: CalendarBooking) {
  return booking.status === "requested" || booking.status === "accepted" || booking.status === "awaiting_payment";
}
