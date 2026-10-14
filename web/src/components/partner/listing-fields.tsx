"use client";

import type { PhAddress } from "@/components/address/ph-address-fields";
import { CheckboxField } from "@/components/ui/checkbox-field";
import { Field } from "@/components/ui/field";
import { attributeLabel } from "./listing-changes";
import type { ListingCategory, PartnerListing } from "./use-partner-listings";

// What a category's attribute_schema can say about one field (the shapes the API seeds).
type AttributeSpec = { type?: string; items?: { type?: string } };
type AttributeSchema = { properties?: Record<string, AttributeSpec>; required?: string[] };
export type AttributeValues = Record<string, string | boolean>;
export type AttributeField = ReturnType<typeof attributeFields>[number];

export const NO_ADDRESS = { street: null, city: null, region: null, province: null, postal_code: null, country: null };

export function attributeFields(category: ListingCategory | undefined) {
  const schema = (category?.attribute_schema ?? {}) as AttributeSchema;
  const required = new Set(schema.required ?? []);
  return Object.entries(schema.properties ?? {}).map(([key, spec]) => ({
    key,
    type: spec.type ?? "string",
    required: required.has(key),
    label: attributeLabel(key),
  }));
}

// The form's values as the attrs the API checks: numbers as numbers, lists split on commas,
// and blank optional fields left out rather than sent empty.
export function toAttrs(fields: AttributeField[], values: AttributeValues) {
  const attrs: Record<string, unknown> = {};
  for (const field of fields) {
    const value = values[field.key];
    if (field.type === "boolean") {
      attrs[field.key] = value === true;
    } else if (typeof value === "string" && value.trim() !== "") {
      if (field.type === "number" || field.type === "integer") attrs[field.key] = Number(value);
      else if (field.type === "array") attrs[field.key] = value.split(",").map((item) => item.trim()).filter(Boolean);
      else attrs[field.key] = value.trim();
    }
  }
  return attrs;
}

// A saved listing's attrs as the form holds them: lists back into comma-separated text.
export function toAttributeValues(attrs: PartnerListing["attrs"]) {
  const values: AttributeValues = {};
  for (const [key, value] of Object.entries(attrs)) {
    if (typeof value === "boolean") values[key] = value;
    else if (Array.isArray(value)) values[key] = value.join(", ");
    else if (value !== null && value !== undefined) values[key] = String(value);
  }
  return values;
}

// The address as one line for Google's geocoder, once every field it needs is filled in.
export function geocodeQuery(address: PhAddress) {
  const { region, province, city, zip, street } = address.values;
  const parts = [street, city, address.hasProvinces ? province : "", region].map((part) => part.trim());
  if (!street.trim() || !city.trim() || !region.trim() || !zip.trim() || (address.hasProvinces && !province.trim())) {
    return undefined;
  }
  return `${parts.filter(Boolean).join(", ")} ${zip.trim()}, Philippines`;
}

// Whether the address differs from a saved one: a saved pin stays where it is until then.
export function addressChanged(address: PhAddress, saved: PartnerListing["address"]) {
  const { region, province, city, zip, street } = address.values;
  return (
    region.trim() !== (saved.region ?? "") ||
    province.trim() !== (saved.province ?? "") ||
    city.trim() !== (saved.city ?? "") ||
    zip.trim() !== (saved.postal_code ?? "") ||
    street.trim() !== (saved.street ?? "")
  );
}

// Whether a listing of this category picks the landmarks it visits (RAA-70): tours and other
// activities do; a photographer works wherever the guest is, so doesn't (RAA-89).
export function visitsLandmarks(category: { booking_type: string; slug: string } | undefined) {
  return category?.booking_type === "activity" && category.slug !== "photographer";
}

// "Vehicle rental › Motorcycle": a bookable category with its parent, as a partner reads it.
export function categoryLabel(category: ListingCategory) {
  return category.parent_name ? `${category.parent_name} › ${category.name}` : category.name;
}

export type CategoryGroup = { name: string; categories: ListingCategory[] };

// The bookable categories under their parents, for the two-level picker. A category without
// a parent is a group of its own.
export function groupCategories(categories: ListingCategory[]) {
  const groups = new Map<string, CategoryGroup>();
  for (const category of categories) {
    const name = category.parent_name ?? category.name;
    const group = groups.get(name) ?? { name, categories: [] };
    group.categories.push(category);
    groups.set(name, group);
  }
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
}

// A title in the partner's own terms for each kind of listing, so a trike isn't shown a tour's.
const TITLE_EXAMPLES: Record<string, string> = {
  motorcycle: "Honda Click 125, automatic, with two helmets",
  bicycle: "Mountain bike for the island loop",
  "e-trike": "E-trike for up to 4, charged daily",
  tricycle: "Tricycle with driver, up to 4 passengers",
  car: "Toyota Vios, automatic, seats 5",
  "van-rental": "Toyota Hiace, seats 12",
  multicab: "Multicab for groups of 8",
  "action-camera": "GoPro Hero 12 with dive housing",
  camera: "Sony mirrorless with a zoom lens",
  "snorkel-gear": "Mask, snorkel and fins set",
  photographer: "Sunset photo shoot at Paradise Beach",
  van: "Hagnaya port to Santa Fe van transfer",
  tour: "Island hopping to Virgin Island and Hilantagaan",
};

export function titleExample(category: ListingCategory | undefined) {
  if (!category) return "Island hopping to Virgin Island and Hilantagaan";
  if (category.booking_type === "stay") return "Beachfront nipa cottage with sunset view";
  return TITLE_EXAMPLES[category.slug] ?? `${category.name} in Bantayan`;
}

export function descriptionHint(category: ListingCategory | undefined) {
  if (category?.booking_type === "rental") return "Its condition, what comes with it, where to pick it up and return it.";
  if (category?.booking_type === "stay") return "The space, the neighbourhood, house rules: anything a guest should know.";
  if (category?.slug === "tour") return "The route, what to bring, anything a traveller should know.";
  if (category?.booking_type === "transfer") return "Where you pick up and drop off, luggage, and how long the ride takes.";
  return "What's included, what to bring, anything a traveller should know.";
}

// The details a category asks for: a checkbox for a yes/no, a field for everything else.
export function AttributeFields({
  fields,
  values,
  onChange,
}: {
  fields: AttributeField[];
  values: AttributeValues;
  onChange: (values: AttributeValues) => void;
}) {
  return fields.map((field) =>
    field.type === "boolean" ? (
      <CheckboxField
        key={field.key}
        label={field.label}
        checked={values[field.key] === true}
        onChange={(event) => onChange({ ...values, [field.key]: event.target.checked })}
      />
    ) : (
      <Field
        key={field.key}
        label={field.required ? field.label : `${field.label} (optional)`}
        type={field.type === "number" || field.type === "integer" ? "number" : "text"}
        step={field.type === "integer" ? 1 : "any"}
        required={field.required}
        hint={field.type === "array" ? "Separate items with commas" : undefined}
        value={typeof values[field.key] === "string" ? (values[field.key] as string) : ""}
        onChange={(event) => onChange({ ...values, [field.key]: event.target.value })}
      />
    ),
  );
}
