import type { components } from "@/api/schema";

// A section's filters on What to book and a plan step (2026-11-10): applied on the server
// (Discovery::ListingFilters), listing by listing, so a card keeps only its listings that pass;
// the sheet's choices and their counts (in cards) are the API's `facets` (FilterPanel).
// pets: only stays that take pets (RAA-186), offered for stays alone. vehicle: Vehicle rental's
// and Gear's own (RAA-205): the kinds (category slugs) and transmissions picked (any of them), and
// what the shop must offer — drop-off, pick-up at the end, child helmets. includes: keys.
export type Facets = components["schemas"]["listing_facets"];
export type VehicleFilters = { kinds: string[]; transmissions: string[]; delivery: boolean; pickup: boolean; childHelmets: boolean };
export type Filters = { free: boolean; pets: boolean; min: string; max: string; includes: string[]; vehicle: VehicleFilters };
const NO_VEHICLE_FILTERS: VehicleFilters = { kinds: [], transmissions: [], delivery: false, pickup: false, childHelmets: false };
export const NO_FILTERS: Filters = { free: false, pets: false, min: "", max: "", includes: [], vehicle: NO_VEHICLE_FILTERS };

const vehicleCount = ({ kinds, transmissions, delivery, pickup, childHelmets }: VehicleFilters) =>
  kinds.length + transmissions.length + Number(delivery) + Number(pickup) + Number(childHelmets);

export const setCount = (filters: Filters) =>
  Number(filters.free) + Number(filters.pets) + Number(Boolean(filters.min || filters.max)) + filters.includes.length + vehicleCount(filters.vehicle);

export const filtered = (filters: Filters | undefined) => Boolean(filters && setCount(filters) > 0);

// The filters as the API's query (only what is set), for a stable query key too.
export function filterQuery(filters: Filters) {
  const min = Number(filters.min) || 0;
  const max = Number(filters.max) || 0;
  const { vehicle } = filters;
  return {
    ...(filters.free ? { free_cancellation: true } : {}),
    ...(filters.pets ? { pets: true } : {}),
    ...(min ? { min_price_cents: min * 100 } : {}),
    ...(max ? { max_price_cents: max * 100 } : {}),
    ...(vehicle.kinds.length ? { "kinds[]": [...vehicle.kinds].sort() } : {}),
    ...(vehicle.transmissions.length ? { "transmissions[]": [...vehicle.transmissions].sort() } : {}),
    ...(vehicle.delivery ? { delivery: true } : {}),
    ...(vehicle.pickup ? { pickup: true } : {}),
    ...(vehicle.childHelmets ? { child_helmets: true } : {}),
    ...(filters.includes.length ? { "includes[]": [...filters.includes].sort() } : {}),
  };
}
