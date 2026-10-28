import { stayDisplayValue } from "./stay-fields";
import { UNITS_LABEL } from "./units-field";
import type { ListingBody, PartnerListing } from "./use-partner-listings";

const ADDRESS_LABELS = {
  street: "Street",
  city: "City",
  province: "Province",
  region: "Region",
  postal_code: "ZIP code",
} as const;

// A stay's rooms are its beds, by bedroom (RAA-95); its guest rules say who takes a bed (RAA-186).
const LABELS: Record<string, string> = {
  engine_cc: "Engine size (cc)",
  rooms: "Beds",
  children_count: "Children count toward capacity",
  infants_count: "Infants count toward capacity",
};

// "duration_hours" → "Duration hours": how a category's attribute is labelled everywhere.
export function attributeLabel(key: string) {
  if (LABELS[key]) return LABELS[key];
  return key.charAt(0).toUpperCase() + key.slice(1).replaceAll("_", " ");
}

// One value as a partner reads it; `key` names the attr, for an accommodation's own ones.
export function displayValue(value: unknown, key?: string) {
  const stay = key === undefined ? undefined : stayDisplayValue(key, value);
  if (stay !== undefined) return stay || "—";
  if (value === undefined || value === null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.length > 0 ? value.join(", ") : "—";
  return String(value);
}

function pin(point: { lat: number; lng: number }) {
  return `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`;
}

// The fields saving the edit form would change, by label, for the confirmation modal.
export function listingChanges(listing: PartnerListing, body: ListingBody) {
  const changes: string[] = [];
  const compare = (label: string, before: unknown, after: unknown) => {
    if (displayValue(before) !== displayValue(after)) changes.push(label);
  };

  compare("Title", listing.title, body.title);
  compare("Description", listing.description, body.description);
  if (body.business_id !== undefined) compare("Business", listing.business.id, body.business_id);
  compare("Category", listing.category.id, body.category_id);
  for (const [key, label] of Object.entries(ADDRESS_LABELS)) {
    const field = key as keyof typeof ADDRESS_LABELS;
    compare(label, listing.address[field], body.address[field]);
  }
  compare("Map pin", pin(listing.location), pin(body.location));
  if (body.units_count !== undefined && body.units_count !== listing.units_count) {
    changes.push(`${UNITS_LABEL}: ${listing.units_count} → ${body.units_count}`);
  }
  if (body.cancellation_policy) compare("Cancellation policy", listing.cancellation_policy, body.cancellation_policy);
  if (body.booking_mode) compare("Booking", listing.booking_mode, body.booking_mode);
  if (body.photos && body.photos.join(",") !== listing.photos.map((photo) => photo.id).join(",")) {
    changes.push("Photo order");
  }
  const landmarkIds = (ids: number[]) => [...ids].sort((a, b) => a - b).join(",");
  if (body.landmark_ids && landmarkIds(listing.landmarks.map((landmark) => landmark.id)) !== landmarkIds(body.landmark_ids)) {
    changes.push("Landmarks");
  }

  // A stay's price and fees (RAA-105), as a whole: the rate's defaults fill what the form leaves out.
  if (body.stay_rate) {
    const rate = { weekend_price_cents: null, max_nights: null, ...body.stay_rate };
    const saved = listing.stay_rate ?? {};
    if (Object.entries(rate).some(([key, value]) => saved[key as keyof typeof saved] !== value)) changes.push("Pricing");
  }
  // A vehicle's price (RAA-150), the same way.
  if (body.vehicle_rate) {
    const saved = listing.vehicle_rate ?? {};
    if (Object.entries(body.vehicle_rate).some(([key, value]) => saved[key as keyof typeof saved] !== value)) changes.push("Pricing");
  }
  // Gear's or a transfer's one price (RAA-191).
  if (body.flat_rate && body.flat_rate.price_cents !== listing.flat_rate?.price_cents) changes.push("Pricing");
  const fees = (list: { name: string; amount_cents: number; charged_per: string; required?: boolean }[]) =>
    JSON.stringify(list.map(({ name, amount_cents, charged_per, required }) => [name, amount_cents, charged_per, required ?? true]));
  if (body.fees && fees(listing.fees) !== fees(body.fees)) changes.push("Fees");

  // A tour's details (RAA-111), by part: the body replaces them whole.
  if (body.tour) {
    const saved = listing.tour;
    const tour = body.tour;
    const same = (before: unknown, after: unknown) => JSON.stringify(before) === JSON.stringify(after);
    const inclusions = (list: { kind: string; options?: string[]; note?: string | null; price_per_head_cents?: number }[]) =>
      [...list]
        .sort((a, b) => a.kind.localeCompare(b.kind))
        .map((inclusion) => [inclusion.kind, inclusion.options ?? [], inclusion.note ?? null, inclusion.price_per_head_cents ?? 0]);
    if (saved?.tour_type !== tour.tour_type) changes.push("Tour type");
    if (
      !same(
        [saved?.min_guests, saved?.max_guests, saved?.max_groups_per_day, saved?.duration_value, saved?.duration_unit],
        [tour.min_guests, tour.max_guests, tour.max_groups_per_day, tour.duration_value, tour.duration_unit],
      )
    ) {
      changes.push("Group and duration");
    }
    if (!same(inclusions(saved?.inclusions ?? []), inclusions(tour.inclusions ?? []))) changes.push("Inclusions");
    if (saved?.base_price_cents !== tour.base_price_cents) changes.push("Price");
  }

  const attrs = body.attrs ?? {};
  for (const key of new Set([...Object.keys(listing.attrs), ...Object.keys(attrs)])) {
    if (displayValue(listing.attrs[key], key) !== displayValue(attrs[key], key)) changes.push(attributeLabel(key));
  }
  return changes;
}
