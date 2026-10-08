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

// "Rentals › Motorcycle": a bookable category with its parent, as a partner reads it.
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
