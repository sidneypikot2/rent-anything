"use client";

import { useState, type FormEvent } from "react";
import { PhAddressFields, usePhAddress } from "@/components/address/ph-address-fields";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { TextareaField } from "@/components/ui/textarea-field";
import type { LatLng } from "@/lib/map";
import { addressChanged, geocodeQuery, NO_ADDRESS } from "./listing-fields";
import { LocationPicker } from "./location-picker";
import type { BusinessBody, PartnerBusiness } from "./use-partner-businesses";

// Adding or changing one of the partner's businesses (RAA-101): its name, which travellers
// see on its listings ("by Basilia Guest House"), an optional description, and its address
// and map pin, which a new listing can copy ("Same as Business Address"). The API checks
// the name is unique among the partner's businesses.
export function BusinessForm({
  business,
  onSave,
  saving,
  error,
  cancelHref,
}: {
  business?: PartnerBusiness;
  onSave: (body: BusinessBody) => void;
  saving: boolean;
  error?: Error | null;
  cancelHref: string;
}) {
  const [name, setName] = useState(business?.name ?? "");
  const [description, setDescription] = useState(business?.description ?? "");
  const address = usePhAddress(business?.address ?? NO_ADDRESS);
  const [location, setLocation] = useState<LatLng | null>(business?.location ?? null);
  const [locationError, setLocationError] = useState<string>();
  // A saved pin stays where it is until the partner changes the address.
  const addressQuery =
    !business?.location || addressChanged(address, business.address) ? geocodeQuery(address) : undefined;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!location) {
      setLocationError("Drop a pin on the map");
      return;
    }
    onSave({ name: name.trim(), description: description.trim(), address: address.toBody(), location });
  }

  return (
    <form data-testid="business-form" onSubmit={onSubmit} className="flex max-w-2xl flex-col gap-6">
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error.message}
        </p>
      )}
      <Field
        label="Business name"
        name="name"
        required
        maxLength={80}
        value={name}
        onChange={(event) => setName(event.target.value)}
        hint="Travellers see it on every listing of this business."
        placeholder="e.g. Basilia Guest House"
      />
      <TextareaField
        label="Description (optional)"
        name="description"
        maxLength={2000}
        value={description}
        onChange={(event) => setDescription(event.target.value)}
      />
      <PhAddressFields address={address} />
      <LocationPicker
        label="Pin the business"
        value={location}
        onChange={(point) => {
          setLocation(point);
          setLocationError(undefined);
        }}
        geocodeQuery={addressQuery}
        error={locationError}
      />
      <div className="flex gap-3">
        <Button type="submit" data-testid="business-save" disabled={saving}>
          {saving ? "Saving…" : business ? "Save changes" : "Add business"}
        </Button>
        <ButtonLink href={cancelHref} variant="soft">
          Cancel
        </ButtonLink>
      </div>
    </form>
  );
}
