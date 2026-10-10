"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { PhAddressFields, usePhAddress, type PhAddress } from "@/components/address/ph-address-fields";
import { Button, ButtonLink } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { SelectField } from "@/components/ui/select-field";
import { TextareaField } from "@/components/ui/textarea-field";
import type { LatLng } from "@/lib/map";
import { listingChanges } from "./listing-changes";
import {
  AttributeFields,
  attributeFields,
  categoryLabel,
  geocodeQuery,
  toAttributeValues,
  toAttrs,
  type AttributeValues,
} from "./listing-fields";
import { LandmarkPicker } from "./landmark-picker";
import { LocationPicker } from "./location-picker";
import {
  AmenityChoice,
  bedCount,
  isStay,
  PlaceTypeChoice,
  PropertyInfoFields,
  toStayAttrs,
  toStayValues,
  type StayValues,
} from "./stay-fields";
import type { PartnerLandmark } from "./use-partner-landmarks";
import { useUpdateListing, type ListingBody, type ListingOptions, type PartnerListing } from "./use-partner-listings";

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

// Changing a listing (RAA-47): what it is, where it is, the landmarks a tour or activity
// visits (RAA-70), and the details its category asks for (an accommodation's own, RAA-83). Saving first shows what changed and asks to confirm. Adding one is the stepped
// ListingWizard (RAA-50).
export function ListingForm({ options, listing }: { options: ListingOptions; listing: PartnerListing }) {
  const router = useRouter();
  const update = useUpdateListing(listing.id);
  const [categoryId, setCategoryId] = useState(String(listing.category.id));
  const [attrValues, setAttrValues] = useState<AttributeValues>(() => toAttributeValues(listing.attrs));
  // An accommodation's details have their own fields (RAA-83).
  const [stay, setStay] = useState<StayValues>(() => toStayValues(listing.attrs));
  const [bedsError, setBedsError] = useState<string>();
  const address = usePhAddress(listing.address);
  const [location, setLocation] = useState<LatLng | null>(listing.location);
  const [locationError, setLocationError] = useState<string>();
  const [landmarks, setLandmarks] = useState<PartnerLandmark[]>(listing.landmarks);
  // The edit waiting for the partner to confirm it, and what it changes.
  const [pending, setPending] = useState<{ body: ListingBody; changes: string[] }>();
  const listingPath = `/partner/listings/${listing.id}`;

  const category = options.categories.find((option) => String(option.id) === categoryId);
  // A saved listing's pin stays where it is until the partner changes the address.
  const addressQuery = addressChanged(address, listing) ? geocodeQuery(address) : undefined;
  const stayCategory = isStay(category);
  const fields = stayCategory ? [] : attributeFields(category);
  // Changing to a category that isn't an activity drops the landmarks when saved.
  const visitsLandmarks = category?.booking_type === "activity";

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!location) {
      setLocationError("Drop a pin on the map");
      return;
    }
    if (stayCategory && bedCount(stay) === 0) {
      setBedsError("Add at least one bed");
      return;
    }
    const form = new FormData(event.currentTarget);
    const body = {
      title: String(form.get("title") ?? ""),
      description: String(form.get("description") ?? ""),
      category_id: Number(categoryId),
      address: address.toBody(),
      location,
      attrs: stayCategory ? toStayAttrs(stay) : toAttrs(fields, attrValues),
      landmark_ids: visitsLandmarks ? landmarks.map((landmark) => landmark.id) : [],
    };
    setPending({ body, changes: listingChanges(listing, body) });
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
      {update.error && (
        <p role="alert" className="text-sm text-danger">
          {update.error.message}
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
            setStay(toStayValues({}));
          }}
          options={[
            { value: "", label: "Choose what you're listing" },
            ...options.categories.map((option) => ({
              value: String(option.id),
              label: categoryLabel(option),
            })),
          ]}
        />
        <Field
          label="Title"
          name="title"
          required
          maxLength={120}
          defaultValue={listing.title}
          placeholder="e.g. Sardine run and turtle snorkel"
        />
        <TextareaField
          label="Description"
          name="description"
          maxLength={5000}
          defaultValue={listing.description}
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

      {visitsLandmarks && (
        <fieldset data-testid="listing-landmarks" className="flex flex-col gap-4">
          <legend className="mb-2 font-display text-2xl font-bold italic">Landmarks it visits</legend>
          <LandmarkPicker value={landmarks} onChange={setLandmarks} near={location} />
        </fieldset>
      )}

      {stayCategory && (
        <>
          <fieldset data-testid="listing-stay-place" className="flex flex-col gap-4">
            <legend className="mb-2 font-display text-2xl font-bold italic">What guests book</legend>
            <PlaceTypeChoice values={stay} onChange={setStay} />
          </fieldset>
          <fieldset data-testid="listing-stay-info" className="flex flex-col gap-4">
            <legend className="mb-2 font-display text-2xl font-bold italic">Property info</legend>
            <PropertyInfoFields
              values={stay}
              onChange={(values) => {
                setStay(values);
                setBedsError(undefined);
              }}
              bedsError={bedsError}
            />
          </fieldset>
          <fieldset className="flex flex-col gap-4">
            <legend className="mb-2 font-display text-2xl font-bold italic">Amenities</legend>
            <AmenityChoice values={stay} onChange={setStay} />
          </fieldset>
        </>
      )}

      {fields.length > 0 && (
        <fieldset data-testid="listing-details" className="flex flex-col gap-4">
          <legend className="mb-2 font-display text-2xl font-bold italic">Details</legend>
          <AttributeFields fields={fields} values={attrValues} onChange={setAttrValues} />
        </fieldset>
      )}

      <div className="flex gap-3">
        <Button type="submit" disabled={update.isPending} data-testid="listing-save">
          {update.isPending ? "Saving…" : "Save changes"}
        </Button>
        <ButtonLink href={listingPath} variant="soft">
          Cancel
        </ButtonLink>
      </div>

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
    </form>
  );
}
