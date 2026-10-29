import { keepPreviousData, useQueries } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import type { components } from "@/api/schema";
import type { Room } from "./party";

export type ListingPrice = components["schemas"]["listing_price"];

// One listing as the add sheet would add it: its dates, the people (or gear's count), a rental
// vehicle's chosen units, a stay's rooms and pets.
export type PriceRequest = {
  listingId: number;
  startsOn?: string;
  endsOn?: string;
  quantity: number;
  units?: number;
  roomGuests?: Room[] | null;
  pets?: number;
  // A vehicle rental's pickup time ("08:30", RAA-195); left out, the shop's default.
  pickupTime?: string | null;
};

// What adding listings would cost (GET /listings/{id}/price, RAA-191), one query each: a single
// add, or each item of a mix. The API prices them as checkout would; the browser only adds the
// totals up. Nothing is asked without both dates.
export function useListingPrices(requests: PriceRequest[]) {
  return useQueries({
    queries: requests.map((request) => ({
      queryKey: ["listing-price", request] as const,
      enabled: Boolean(request.startsOn && request.endsOn),
      staleTime: 60_000,
      // A changed pickup time or count keeps the last answer on screen while it is asked again.
      placeholderData: keepPreviousData,
      queryFn: async () => {
        const { data, error } = await apiClient().GET("/api/v1/listings/{listing_id}/price", {
          params: {
            path: { listing_id: request.listingId },
            query: {
              starts_on: request.startsOn ?? "",
              ends_on: request.endsOn ?? "",
              quantity: request.quantity,
              ...(request.units ? { units: request.units } : {}),
              ...(request.roomGuests ? { room_guests: JSON.stringify(request.roomGuests) } : {}),
              ...(request.pets ? { pets: request.pets } : {}),
              ...(request.pickupTime ? { pickup_time: request.pickupTime } : {}),
            },
          },
        });
        if (error || !data) throw new Error("Couldn't price this");
        return data;
      },
    })),
  });
}
