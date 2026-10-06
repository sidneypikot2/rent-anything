"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { CheckboxField } from "@/components/ui/checkbox-field";
import { Field } from "@/components/ui/field";
import { SelectField } from "@/components/ui/select-field";
import { TextareaField } from "@/components/ui/textarea-field";
import { useCreateListing, type ListingCategory, type ListingOptions } from "./use-partner-listings";

// What a category's attribute_schema can say about one field (the shapes the API seeds).
type AttributeSpec = { type?: string; items?: { type?: string } };
type AttributeSchema = { properties?: Record<string, AttributeSpec>; required?: string[] };
type AttributeValues = Record<string, string | boolean>;

function attributeFields(category: ListingCategory | undefined) {
  const schema = (category?.attribute_schema ?? {}) as AttributeSchema;
  const required = new Set(schema.required ?? []);
  return Object.entries(schema.properties ?? {}).map(([key, spec]) => ({
    key,
    type: spec.type ?? "string",
    required: required.has(key),
    label: key.charAt(0).toUpperCase() + key.slice(1).replaceAll("_", " "),
  }));
}

// The form's values as the attrs the API checks: numbers as numbers, lists split on commas,
// and blank optional fields left out rather than sent empty.
function toAttrs(fields: ReturnType<typeof attributeFields>, values: AttributeValues) {
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

// Adding a listing (RAA-41): what it is, where it is, and the details its category asks for.
// It is saved as a draft.
export function ListingForm({ options }: { options: ListingOptions }) {
  const router = useRouter();
  const create = useCreateListing();
  const [categoryId, setCategoryId] = useState("");
  const [attrValues, setAttrValues] = useState<AttributeValues>({});

  const category = options.categories.find((option) => String(option.id) === categoryId);
  const fields = attributeFields(category);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    create.mutate(
      {
        title: String(form.get("title") ?? ""),
        description: String(form.get("description") ?? ""),
        category_id: Number(categoryId),
        area_slug: String(form.get("area_slug") ?? ""),
        location: { lat: Number(form.get("lat")), lng: Number(form.get("lng")) },
        attrs: toAttrs(fields, attrValues),
      },
      { onSuccess: () => router.push("/partner/listings") },
    );
  }

  return (
    <form data-testid="listing-form" onSubmit={onSubmit} className="flex max-w-2xl flex-col gap-6">
      {create.error && (
        <p role="alert" className="text-sm text-danger">
          {create.error.message}
        </p>
      )}

      <div className="flex flex-col gap-4">
        <SelectField
          label="Category"
          name="category_id"
          required
          value={categoryId}
          onChange={(event) => {
            setCategoryId(event.target.value);
            setAttrValues({});
          }}
          options={[
            { value: "", label: "Choose what you're listing" },
            ...options.categories.map((option) => ({
              value: String(option.id),
              label: option.parent_name ? `${option.parent_name} › ${option.name}` : option.name,
            })),
          ]}
        />
        <Field label="Title" name="title" required maxLength={120} placeholder="e.g. Sardine run and turtle snorkel" />
        <TextareaField
          label="Description"
          name="description"
          maxLength={5000}
          hint="What's included, what to bring, anything a traveller should know."
        />
      </div>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 font-display text-2xl font-bold italic">Where it is</legend>
        <SelectField
          label="Area"
          name="area_slug"
          required
          defaultValue=""
          options={[
            { value: "", label: "Choose an area" },
            ...options.areas.map((area) => ({
              value: area.slug,
              label: area.parent_name ? `${area.name}, ${area.parent_name}` : area.name,
            })),
          ]}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Latitude" name="lat" type="number" step="any" min={-90} max={90} required placeholder="9.9450" />
          <Field label="Longitude" name="lng" type="number" step="any" min={-180} max={180} required placeholder="123.3960" />
        </div>
        <p className="text-xs text-muted">
          Where travellers meet you or pick it up. Travellers see it only after they book.
        </p>
      </fieldset>

      {fields.length > 0 && (
        <fieldset data-testid="listing-details" className="flex flex-col gap-4">
          <legend className="mb-2 font-display text-2xl font-bold italic">Details</legend>
          {fields.map((field) =>
            field.type === "boolean" ? (
              <CheckboxField
                key={field.key}
                label={field.label}
                checked={attrValues[field.key] === true}
                onChange={(event) => setAttrValues({ ...attrValues, [field.key]: event.target.checked })}
              />
            ) : (
              <Field
                key={field.key}
                label={field.required ? field.label : `${field.label} (optional)`}
                type={field.type === "number" || field.type === "integer" ? "number" : "text"}
                step={field.type === "integer" ? 1 : "any"}
                required={field.required}
                hint={field.type === "array" ? "Separate items with commas" : undefined}
                value={typeof attrValues[field.key] === "string" ? (attrValues[field.key] as string) : ""}
                onChange={(event) => setAttrValues({ ...attrValues, [field.key]: event.target.value })}
              />
            ),
          )}
        </fieldset>
      )}

      <div className="flex gap-3">
        <Button type="submit" disabled={create.isPending} data-testid="listing-save">
          {create.isPending ? "Saving…" : "Save as draft"}
        </Button>
        <ButtonLink href="/partner/listings" variant="soft">
          Cancel
        </ButtonLink>
      </div>
    </form>
  );
}
