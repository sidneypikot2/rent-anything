import type { ListingBody, PartnerListing } from "./use-partner-listings";

const ADDRESS_LABELS = {
  street: "Street",
  city: "City",
  province: "Province",
  region: "Region",
  postal_code: "ZIP code",
} as const;

// "duration_hours" → "Duration hours": how a category's attribute is labelled everywhere.
export function attributeLabel(key: string) {
  return key.charAt(0).toUpperCase() + key.slice(1).replaceAll("_", " ");
}

// One value as a partner reads it.
export function displayValue(value: unknown) {
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
  compare("Category", listing.category.id, body.category_id);
  for (const [key, label] of Object.entries(ADDRESS_LABELS)) {
    const field = key as keyof typeof ADDRESS_LABELS;
    compare(label, listing.address[field], body.address[field]);
  }
  compare("Map pin", pin(listing.location), pin(body.location));

  const attrs = body.attrs ?? {};
  for (const key of new Set([...Object.keys(listing.attrs), ...Object.keys(attrs)])) {
    compare(attributeLabel(key), listing.attrs[key], attrs[key]);
  }
  return changes;
}
