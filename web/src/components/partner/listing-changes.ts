import type { ListingBody, ListingOptions, PartnerListing } from "./use-partner-listings";

export type ListingChange = { label: string; before: string; after: string };

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

// What saving the edit form would change, field by field, for the confirmation modal.
export function listingChanges(listing: PartnerListing, body: ListingBody, options: ListingOptions) {
  const changes: ListingChange[] = [];
  const compare = (label: string, before: unknown, after: unknown) => {
    const [from, to] = [displayValue(before), displayValue(after)];
    if (from !== to) changes.push({ label, before: from, after: to });
  };

  compare("Title", listing.title, body.title);
  compare("Description", listing.description, body.description);
  if (body.category_id !== listing.category.id) {
    const category = options.categories.find((option) => option.id === body.category_id);
    compare("Category", listing.category.name, category?.name ?? "—");
  }
  for (const [key, label] of Object.entries(ADDRESS_LABELS)) {
    const field = key as keyof typeof ADDRESS_LABELS;
    compare(label, listing.address[field], body.address[field]);
  }
  if (pin(listing.location) !== pin(body.location)) {
    changes.push({ label: "Map pin", before: pin(listing.location), after: pin(body.location) });
  }

  const attrs = body.attrs ?? {};
  for (const key of new Set([...Object.keys(listing.attrs), ...Object.keys(attrs)])) {
    compare(attributeLabel(key), listing.attrs[key], attrs[key]);
  }
  return changes;
}
