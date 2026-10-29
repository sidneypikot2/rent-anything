import type { components } from "@/api/schema";
import { formatPeso } from "@/lib/money";
import { pricedByText, priceUnitText } from "@/lib/pricing";
import { stayRules } from "./party";
import type { AddPreview } from "./use-trips";

// Whatever the page has of a listing; the add sheet shows the parts it's given.
export type AddListing = {
  id: number;
  title: string;
  booking_type: string;
  // A name, or the listing page's {slug, name}.
  category?: string | { name: string };
  cover_photo_url?: string | null;
  photos?: { card_url: string }[];
  business?: { name: string };
  price_from_cents?: number | null;
  price_unit?: components["schemas"]["price_unit"];
  details?: Record<string, unknown>;
  // A tour's group (the area row's and the listing page's `tour`).
  tour?: { min_guests: number; max_guests: number } | null;
  units_count?: number;
  units_label?: string;
  // Where guests find it (the API's `group`): "gear" is booked by the count.
  group?: string;
  // A rental vehicle's rate: its delivery and pick-up fees (RAA-195).
  vehicle_rate?: { delivery_fee_cents: number | null; return_pickup_fee_cents: number | null } | null;
};

// What the add sheet shows of a listing. Plain, so server pages build it too.
export function addPreview(listing: AddListing, by?: string): AddPreview {
  const unit = listing.price_unit ? priceUnitText(listing.price_unit) : undefined;
  const count = (value: unknown) => (typeof value === "number" && value > 0 ? value : null);
  const cover = listing.cover_photo_url ?? listing.photos?.[0]?.card_url;
  const rentalVehicle = listing.booking_type === "rental" && listing.group !== "gear";
  return {
    category: typeof listing.category === "string" ? listing.category : listing.category?.name,
    by: by ?? (listing.business && `by ${listing.business.name}`),
    photo: cover ? { src: cover, alt: listing.title } : null,
    price: listing.price_from_cents
      ? ["From", formatPeso(listing.price_from_cents), unit].filter(Boolean).join(" ")
      : pricedByText(listing.booking_type),
    // A transfer books one vehicle, so its seats cap the guests; a rental vehicle (RAA-191) books
    // as many as its people need instead.
    seats: rentalVehicle ? null : count(listing.details?.seats),
    vehicleSeats: rentalVehicle ? count(listing.details?.seats) : null,
    deliveryFees:
      rentalVehicle && listing.vehicle_rate
        ? { delivery: listing.vehicle_rate.delivery_fee_cents, returnPickup: listing.vehicle_rate.return_pickup_fee_cents }
        : null,
    sleeps: listing.booking_type === "stay" ? count(listing.details?.guests) : null,
    sharedRoom: listing.details?.place_type === "shared_room",
    tourGuests: listing.tour ? { min: listing.tour.min_guests, max: listing.tour.max_guests } : null,
    unitsCount: listing.units_count,
    unitsLabel: listing.units_label,
    gear: listing.group === "gear",
    stayRules: listing.booking_type === "stay" ? stayRules(listing.details, listing.units_count) : null,
  };
}
