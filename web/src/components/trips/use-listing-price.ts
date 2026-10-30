import { useQueries, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import type { components } from "@/api/schema";
import type { Delivery } from "./delivery-options";
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
  // A vehicle rental's delivery and pick-up (RAA-195): each adds the shop's fee per vehicle, by its pin's zone.
  delivery?: Delivery | null;
  // A motorcycle rental's child helmets (RAA-205): the shop's fee for each a day.
  childHelmets?: number;
};

// What adding listings would cost (GET /listings/{id}/price, RAA-191), one query each: a single
// add, or each item of a mix. The API prices them as checkout would; the browser only adds the
// totals up. Nothing is asked without both dates.
export function useListingPrices(requests: PriceRequest[]) {
  const client = useQueryClient();
  return useQueries({
    queries: requests.map((request) => ({
      queryKey: ["listing-price", request] as const,
      enabled: Boolean(request.startsOn && request.endsOn),
      staleTime: 60_000,
      // A changed pickup time or count keeps the last answer on screen while it is asked again:
      // a new key is a new query here, with no previous data of its own, so the listing's latest.
      placeholderData: (previous: ListingPrice | undefined) => previous ?? latestPrice(client, request.listingId),
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
              ...(request.delivery?.delivery ? { delivery: true } : {}),
              ...(request.delivery?.returnPickup ? { return_pickup: true } : {}),
              // The guest's pin (RAA-205): the fee of the zone it is in, `unavailable` beyond the shop's reach.
              ...((request.delivery?.delivery || request.delivery?.returnPickup) && request.delivery.location
                ? { delivery_lat: request.delivery.location.lat, delivery_lng: request.delivery.location.lng }
                : {}),
              ...(request.childHelmets ? { child_helmets: request.childHelmets } : {}),
            },
          },
        });
        if (error || !data) throw new Error("Couldn't price this");
        return data;
      },
    })),
  });
}

// The listing's most recently answered price, whatever it was asked with.
function latestPrice(client: QueryClient, listingId: number) {
  const [latest] = client
    .getQueryCache()
    .findAll({ queryKey: ["listing-price"] })
    .filter((query) => (query.queryKey[1] as PriceRequest | undefined)?.listingId === listingId && query.state.data !== undefined)
    .sort((a, b) => b.state.dataUpdatedAt - a.state.dataUpdatedAt);
  return latest?.state.data as ListingPrice | undefined;
}
