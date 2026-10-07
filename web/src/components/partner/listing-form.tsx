"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { PhAddressFields, usePhAddress, type PhAddress } from "@/components/address/ph-address-fields";
import { Button, ButtonLink } from "@/components/ui/button";
import { CheckboxField } from "@/components/ui/checkbox-field";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { SelectField } from "@/components/ui/select-field";
import { TextareaField } from "@/components/ui/textarea-field";
import type { LatLng } from "@/lib/map";
import { attributeLabel, listingChanges } from "./listing-changes";
import { LocationPicker } from "./location-picker";
import {
  useCreateListing,
  useUpdateListing,
  type ListingBody,
  type ListingCategory,
  type ListingOptions,
  type PartnerListing,
} from "./use-partner-listings";

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
    label: attributeLabel(key),
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

// A saved listing's attrs as the form holds them: lists back into comma-separated text.
function toAttributeValues(attrs: PartnerListing["attrs"]) {
  const values: AttributeValues = {};
  for (const [key, value] of Object.entries(attrs)) {
    if (typeof value === "boolean") values[key] = value;
    else if (Array.isArray(value)) values[key] = value.join(", ");
    else if (value !== null && value !== undefined) values[key] = String(value);
  }
  return values;
}

const NO_ADDRESS = { street: null, city: null, region: null, province: null, postal_code: null, country: null };

// The address as one line for Google's geocoder, once every field it needs is filled in.
function geocodeQuery(address: PhAddress) {
  const { region, province, city, zip, street } = address.values;
  const parts = [street, city, address.hasProvinces ? province : "", region].map((part) => part.trim());
  if (!street.trim() || !city.trim() || !region.trim() || !zip.trim() || (address.hasProvinces && !province.trim())) {
    return undefined;
  }
  return `${parts.filter(Boolean).join(", ")} ${zip.trim()}, Philippines`;
}

function addressChanged(address: PhAddress, listing: PartnerListing) {
  const { region, province, city, zip, street } = address.values;
  const saved = listing.address;
  return (
    region.trim() !== (saved.region ?? "") ||
    province.trim() !== (saved.province ?? "") ||
    city.trim() !== (saved.city ?? "") ||
    zip.trim() !== (saved.postal_code ?? "") ||
    street.trim() !== (saved.street ?? "")
  );
}

// Adding a listing (RAA-41): what it is, where it is, and the details its category asks for.
// It is saved as a draft. Given a listing, the form changes it instead (RAA-47): saving first
// shows what changed and asks to confirm.
export function ListingForm({ options, listing }: { options: ListingOptions; listing?: PartnerListing }) {
  const router = useRouter();
  const create = useCreateListing();
  const update = useUpdateListing(listing?.id ?? NaN);
  const save = listing ? update : create;
  const [categoryId, setCategoryId] = useState(listing ? String(listing.category.id) : "");
  const [attrValues, setAttrValues] = useState<AttributeValues>(() => (listing ? toAttributeValues(listing.attrs) : {}));
  const address = usePhAddress(listing?.address ?? NO_ADDRESS);
  const [location, setLocation] = useState<LatLng | null>(listing?.location ?? null);
  const [locationError, setLocationError] = useState<string>();
  // The edit waiting for the partner to confirm it, and what it changes.
  const [pending, setPending] = useState<{ body: ListingBody; changes: string[] }>();
  const listingPath = listing ? `/partner/listings/${listing.id}` : "/partner/listings";

  const category = options.categories.find((option) => String(option.id) === categoryId);
  // A saved listing's pin stays where it is until the partner changes the address.
  const addressQuery = listing && !addressChanged(address, listing) ? undefined : geocodeQuery(address);
  const fields = attributeFields(category);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!location) {
      setLocationError("Drop a pin on the map");
      return;
    }
    const form = new FormData(event.currentTarget);
    const body = {
      title: String(form.get("title") ?? ""),
      description: String(form.get("description") ?? ""),
      category_id: Number(categoryId),
      address: address.toBody(),
      location,
      attrs: toAttrs(fields, attrValues),
    };
    if (listing) setPending({ body, changes: listingChanges(listing, body) });
    else create.mutate(body, { onSuccess: () => router.push(listingPath) });
  }

  function confirmEdit() {
    if (!pending) return;
    update.mutate(pending.body, {
      onSuccess: () => router.push(listingPath),
      onSettled: () => setPending(undefined),
    });
  }

  return (
    <form data-testid="listing-form" onSubmit={onSubmit} className="flex max-w-2xl flex-col gap-6">
      {save.error && (
        <p role="alert" className="text-sm text-danger">
          {save.error.message}
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
        <Field
          label="Title"
          name="title"
          required
          maxLength={120}
          defaultValue={listing?.title}
          placeholder="e.g. Sardine run and turtle snorkel"
        />
        <TextareaField
          label="Description"
          name="description"
          maxLength={5000}
          defaultValue={listing?.description}
          hint="What's included, what to bring, anything a traveller should know."
        />
      </div>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 font-display text-2xl font-bold italic">Where it is</legend>
        <PhAddressFields address={address} />
        <LocationPicker
          value={location}
          onChange={(point) => {
            setLocation(point);
            setLocationError(undefined);
          }}
          geocodeQuery={addressQuery}
          error={locationError}
        />
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
        <Button type="submit" disabled={save.isPending} data-testid="listing-save">
          {save.isPending ? "Saving…" : listing ? "Save changes" : "Save as draft"}
        </Button>
        <ButtonLink href={listingPath} variant="soft">
          Cancel
        </ButtonLink>
      </div>

      {listing && (
        <Dialog
          open={pending !== undefined}
          onClose={() => setPending(undefined)}
          title="Save these changes?"
          data-testid="listing-save-confirm"
          actions={
            <>
              <Button type="button" variant="soft" onClick={() => setPending(undefined)}>
                Keep editing
              </Button>
              <Button
                type="button"
                onClick={confirmEdit}
                disabled={!pending?.changes.length || update.isPending}
                data-testid="listing-save-confirm-button"
              >
                {update.isPending ? "Saving…" : "Save changes"}
              </Button>
            </>
          }
        >
          {pending?.changes.length ? (
            <div className="flex flex-col gap-2 text-sm">
              <p className="text-muted">You changed:</p>
              <ul data-testid="listing-changes" className="flex list-disc flex-col gap-1 pl-5">
                {pending.changes.map((label) => (
                  <li key={label}>{label}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-muted">Nothing has changed yet.</p>
          )}
        </Dialog>
      )}
    </form>
  );
}
