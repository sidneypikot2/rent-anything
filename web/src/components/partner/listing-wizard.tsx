"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { PhAddressFields, usePhAddress } from "@/components/address/ph-address-fields";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { TextareaField } from "@/components/ui/textarea-field";
import type { LatLng } from "@/lib/map";
import {
  AttributeFields,
  attributeFields,
  categoryLabel,
  NO_ADDRESS,
  toAttrs,
  visitsLandmarks,
  type AttributeValues,
} from "./listing-fields";
import {
  CancellationPolicyChoice,
  DEFAULT_CANCELLATION_POLICY,
  type CancellationPolicies,
  type CancellationPolicy,
} from "./cancellation-policy";
import { LandmarkPicker } from "./landmark-picker";
import { LocationPicker } from "./location-picker";
import { NewListingPhotos } from "./new-listing-photos";
import { SameAsBusinessAddress, useSameAsBusinessAddress } from "./same-as-business-address";
import type { PartnerBusiness } from "./use-partner-businesses";
import { useCreateListing, type ListingBody, type ListingCategory, type PartnerListing } from "./use-partner-listings";
import { UnitsField } from "./units-field";
import { isVehicle, NEW_VEHICLE, toVehicleAttrs, VehicleFields, type VehicleValues } from "./vehicle-fields";
import { WizardCancel } from "./wizard-cancel";
import { WizardActions, WizardLayout } from "./wizard-steps";
import type { PartnerLandmark } from "./use-partner-landmarks";

type StepKey = "basic" | "location" | "route" | "details" | "vehicle" | "photos" | "rate" | "cancellation" | "units";

// Adding a listing of the chosen category (RAA-50), one step at a time: Basic, Location,
// Route (the landmarks a tour visits, RAA-70; not a photographer, RAA-89), the category's
// own details (skipped when it has none; a vehicle's make, model, engine and color, RAA-89),
// Rate, the cancellation policy (RAA-89), how many identical units it has (RAA-99) and,
// last, photos. Only the current step is on the page, so the browser's required checks
// cover just that step; every value is kept here, so going back loses nothing, and any step
// already reached opens again (RAA-93). Units saves the listing as a draft, since a photo
// needs a listing to belong to (RAA-109); then only Photos is open (NewListingPhotos).
// Accommodation has its own steps (StayWizard).
export function ListingWizard({
  business,
  category,
  policies,
}: {
  business: PartnerBusiness;
  category: ListingCategory;
  policies: CancellationPolicies;
}) {
  const create = useCreateListing();
  const vehicle = isVehicle(category);
  const fields = vehicle ? [] : attributeFields(category);
  const withLandmarks = visitsLandmarks(category);
  const steps: { key: StepKey; label: string }[] = [
    { key: "basic", label: "Basic" },
    { key: "location", label: "Location" },
    ...(withLandmarks ? [{ key: "route" as const, label: "Route" }] : []),
    ...(fields.length > 0 ? [{ key: "details" as const, label: `${category.name} details` }] : []),
    ...(vehicle ? [{ key: "vehicle" as const, label: "Vehicle details" }] : []),
    { key: "rate", label: "Rate" },
    { key: "cancellation", label: "Cancellation policy" },
    { key: "units", label: "Units" },
    { key: "photos", label: "Photos" },
  ];
  const [stepIndex, setStepIndex] = useState(0);
  const [reached, setReached] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const step = steps[stepIndex];
  // The last step before Photos saves the listing.
  const isLast = stepIndex === steps.length - 2;
  const [saved, setSaved] = useState<{ listing: PartnerListing; body: ListingBody }>();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [units, setUnits] = useState(1);
  const address = usePhAddress(NO_ADDRESS);
  const [location, setLocation] = useState<LatLng | null>(null);
  const [locationError, setLocationError] = useState<string>();
  const sameAddress = useSameAsBusinessAddress(business, address, (point) => {
    setLocation(point);
    setLocationError(undefined);
  });
  const [attrValues, setAttrValues] = useState<AttributeValues>({});
  const [landmarks, setLandmarks] = useState<PartnerLandmark[]>([]);
  const [vehicleValues, setVehicleValues] = useState<VehicleValues>(NEW_VEHICLE);
  const [policy, setPolicy] = useState<CancellationPolicy>(DEFAULT_CANCELLATION_POLICY);
  // Shown and checked, not saved yet: the API has no pricing until its own ticket.
  const [dailyRate, setDailyRate] = useState("");

  // The current step's checks: the browser's required fields, then the map pin.
  function stepIsValid() {
    if (!formRef.current?.reportValidity()) return false;
    if (step.key === "location" && !location) {
      setLocationError("Drop a pin on the map");
      return false;
    }
    return true;
  }

  // Back is always open; forward (Next, or a step already reached) checks this step first.
  function goTo(index: number) {
    if (index > stepIndex && !stepIsValid()) return;
    setStepIndex(index);
    setReached((furthest) => Math.max(furthest, index));
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isLast) {
      goTo(stepIndex + 1);
      return;
    }
    if (!stepIsValid()) return;
    if (!location) return;
    const body: ListingBody = {
      title: title.trim(),
      description: description.trim(),
      business_id: business.id,
      category_id: category.id,
      address: address.toBody(),
      location,
      attrs: vehicle ? toVehicleAttrs(vehicleValues) : toAttrs(fields, attrValues),
      cancellation_policy: policy,
      units_count: units,
      ...(withLandmarks && { landmark_ids: landmarks.map((landmark) => landmark.id) }),
    };
    create.mutate(body, {
      onSuccess: (listing) => {
        setSaved({ listing, body });
        setStepIndex(steps.length - 1);
        setReached(steps.length - 1);
      },
    });
  }

  if (saved) {
    return (
      <WizardLayout steps={steps} current={stepIndex} reached={reached} onSelect={goTo} locked>
        <NewListingPhotos listing={saved.listing} body={saved.body} />
      </WizardLayout>
    );
  }

  return (
    <WizardLayout steps={steps} current={stepIndex} reached={reached} onSelect={goTo}>
      <form ref={formRef} data-testid="listing-wizard" onSubmit={onSubmit} className="relative flex w-full flex-col gap-6">
        <WizardCancel href="/partner/listings" className="absolute right-0 top-0" />
        {create.error && (
          <p role="alert" className="text-sm text-danger">
            {create.error.message}
          </p>
        )}

        <fieldset data-testid={`listing-step-${step.key}`} className="flex flex-col gap-4">
          <legend className="mb-2 pr-20 font-display text-2xl font-extrabold tracking-tight">{step.label}</legend>

          {step.key === "basic" && (
            <>
              <p className="text-sm text-muted">
                Listing a <span className="font-medium text-foreground">{categoryLabel(category)}</span> for{" "}
                <span className="font-medium text-foreground">{business.name}</span>.{" "}
                <Link
                  href={`/partner/listings/new?business=${business.id}&category=${category.id}`}
                  className="text-link underline"
                  data-testid="listing-change-category"
                >
                  Change
                </Link>
              </p>
              <Field
                label="Title"
                name="title"
                required
                maxLength={120}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g. Sardine run and turtle snorkel"
              />
              <TextareaField
                label="Description"
                name="description"
                maxLength={5000}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                hint="What's included, what to bring, anything a traveller should know."
              />
            </>
          )}

          {step.key === "location" && (
            <>
              <SameAsBusinessAddress business={business} checked={sameAddress.same} onChange={sameAddress.change} />
              <PhAddressFields address={address} disabled={sameAddress.same} />
              <LocationPicker
                value={location}
                readOnly={sameAddress.same}
                onChange={(point) => {
                  setLocation(point);
                  setLocationError(undefined);
                }}
                geocodeQuery={sameAddress.geocodeQuery}
                error={locationError}
              />
            </>
          )}

          {step.key === "route" && (
            <>
              <p className="text-sm text-muted">
                The landmarks this {category.name.toLowerCase()} visits. Travellers find it from each one.
              </p>
              <LandmarkPicker value={landmarks} onChange={setLandmarks} near={location} />
            </>
          )}

          {step.key === "details" && <AttributeFields fields={fields} values={attrValues} onChange={setAttrValues} />}

          {step.key === "vehicle" && <VehicleFields values={vehicleValues} onChange={setVehicleValues} />}

          {step.key === "rate" && (
            <Field
              label="Daily rate (₱)"
              name="daily_rate"
              type="number"
              min={0}
              step="any"
              value={dailyRate}
              onChange={(event) => setDailyRate(event.target.value)}
              hint="Rates aren't saved yet — you'll set them on the listing once pricing is available."
            />
          )}

          {step.key === "cancellation" && <CancellationPolicyChoice policies={policies} value={policy} onChange={setPolicy} />}

          {step.key === "units" && <UnitsField bookingType={category.booking_type} value={units} onChange={setUnits} />}
        </fieldset>

        <WizardActions
          onBack={stepIndex > 0 ? () => goTo(stepIndex - 1) : undefined}
          next={
            isLast ? (
              <Button type="submit" disabled={create.isPending} data-testid="listing-save">
                {create.isPending ? "Saving…" : "Save and add photos"}
              </Button>
            ) : (
              <Button type="submit" data-testid="listing-next">
                Next
              </Button>
            )
          }
        />
      </form>
    </WizardLayout>
  );
}
