import { stayDisplayValue } from "./stay-fields";
import type { ListingBody, PartnerListing } from "./use-partner-listings";

const ADDRESS_LABELS = {
  street: "Street",
  city: "City",
  province: "Province",
  region: "Region",
  postal_code: "ZIP code",
} as const;

// A stay's rooms are its beds, by bedroom (RAA-95).
const LABELS: Record<string, string> = { engine_cc: "Engine size (cc)", rooms: "Beds" };

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
    changes.push(`Units: ${listing.units_count} → ${body.units_count}`);
  }
  if (body.cancellation_policy) compare("Cancellation policy", listing.cancellation_policy, body.cancellation_policy);
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
  const fees = (list: { name: string; amount_cents: number; charged_per: string; required?: boolean }[]) =>
    JSON.stringify(list.map(({ name, amount_cents, charged_per, required }) => [name, amount_cents, charged_per, required ?? true]));
  if (body.fees && fees(listing.fees) !== fees(body.fees)) changes.push("Fees");

  const attrs = body.attrs ?? {};
  for (const key of new Set([...Object.keys(listing.attrs), ...Object.keys(attrs)])) {
    if (displayValue(listing.attrs[key], key) !== displayValue(attrs[key], key)) changes.push(attributeLabel(key));
  }
  return changes;
}
