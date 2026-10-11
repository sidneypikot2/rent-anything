"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { PhAddressFields, usePhAddress } from "@/components/address/ph-address-fields";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { TextareaField } from "@/components/ui/textarea-field";
import type { LatLng } from "@/lib/map";
import {
  CancellationPolicyChoice,
  DEFAULT_CANCELLATION_POLICY,
  type CancellationPolicies,
  type CancellationPolicy,
} from "./cancellation-policy";
import { categoryLabel, geocodeQuery, NO_ADDRESS } from "./listing-fields";
import { LocationPicker } from "./location-picker";
import { PhotoUploadSkeleton } from "./photo-upload-skeleton";
import {
  AmenityChoice,
  bedCount,
  NEW_STAY,
  PlaceTypeChoice,
  PropertyInfoFields,
  toStayAttrs,
  type StayValues,
} from "./stay-fields";
import { useCreateListing, type ListingCategory } from "./use-partner-listings";
import { WizardLayout } from "./wizard-steps";

const STEPS = [
  { key: "place", label: "What guests book" },
  { key: "address", label: "Address" },
  { key: "info", label: "Property info" },
  { key: "amenities", label: "Amenities" },
  { key: "photos", label: "Photos" },
  { key: "basic", label: "Title and description" },
  { key: "cancellation", label: "Cancellation policy" },
  { key: "rate", label: "Rate" },
];

// Adding an accommodation (RAA-83), once its property type is chosen: what guests book,
// the address, beds, guests and bathrooms, amenities, photos (a placeholder until the API
// stores them), the title and description, the cancellation policy (RAA-89) and the nightly rate (shown, not saved yet).
// Like ListingWizard, only the current step is on the page and every value is kept here.
export function StayWizard({ category, policies }: { category: ListingCategory; policies: CancellationPolicies }) {
  const router = useRouter();
  const create = useCreateListing();
  const [stepIndex, setStepIndex] = useState(0);
  const step = STEPS[stepIndex];
  const isLast = stepIndex === STEPS.length - 1;

  const [stay, setStay] = useState<StayValues>(NEW_STAY);
  const [bedsError, setBedsError] = useState<string>();
  const address = usePhAddress(NO_ADDRESS);
  const [location, setLocation] = useState<LatLng | null>(null);
  const [locationError, setLocationError] = useState<string>();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [policy, setPolicy] = useState<CancellationPolicy>(DEFAULT_CANCELLATION_POLICY);
  // Shown and checked, not saved yet: the API has no pricing until its own ticket.
  const [nightlyRate, setNightlyRate] = useState("");

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step.key === "address" && !location) {
      setLocationError("Drop a pin on the map");
      return;
    }
    if (step.key === "info" && bedCount(stay) === 0) {
      setBedsError("Add at least one bed");
      return;
    }
    if (!isLast) {
      setStepIndex(stepIndex + 1);
      return;
    }
    if (!location) return;
    create.mutate(
      {
        title: title.trim(),
        description: description.trim(),
        category_id: category.id,
        address: address.toBody(),
        location,
        attrs: toStayAttrs(stay),
        cancellation_policy: policy,
      },
      { onSuccess: () => router.push("/partner/listings") },
    );
  }

  return (
    <WizardLayout steps={STEPS} current={stepIndex} onSelect={setStepIndex}>
      <form data-testid="stay-wizard" onSubmit={onSubmit} className="flex w-full flex-col gap-6">
        {create.error && (
          <p role="alert" className="text-sm text-danger">
            {create.error.message}
          </p>
        )}

        <fieldset data-testid={`listing-step-${step.key}`} className="flex flex-col gap-4">
          <legend className="mb-2 font-display text-2xl font-bold italic">{step.label}</legend>

          {step.key === "place" && (
            <>
              <p className="text-sm text-muted">
                Listing a <span className="font-medium text-foreground">{categoryLabel(category)}</span>.{" "}
                <Link
                  href={`/partner/listings/new?category=${category.id}`}
                  className="text-link underline"
                  data-testid="listing-change-category"
                >
                  Change
                </Link>
              </p>
              <PlaceTypeChoice values={stay} onChange={setStay} />
            </>
          )}

          {step.key === "address" && (
            <>
              <PhAddressFields address={address} />
              <LocationPicker
                value={location}
                onChange={(point) => {
                  setLocation(point);
                  setLocationError(undefined);
                }}
                geocodeQuery={geocodeQuery(address)}
                error={locationError}
              />
            </>
          )}

          {step.key === "info" && (
            <PropertyInfoFields
              values={stay}
              onChange={(values) => {
                setStay(values);
                setBedsError(undefined);
              }}
              bedsError={bedsError}
            />
          )}

          {step.key === "amenities" && (
            <>
              <p className="text-sm text-muted">Tick what guests can use. These are what travellers search for most.</p>
              <AmenityChoice values={stay} onChange={setStay} />
            </>
          )}

          {step.key === "photos" && <PhotoUploadSkeleton />}

          {step.key === "basic" && (
            <>
              <Field
                label="Title"
                name="title"
                required
                maxLength={120}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g. Beachfront nipa cottage with sunset view"
              />
              <TextareaField
                label="Description"
                name="description"
                maxLength={5000}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                hint="The space, the neighbourhood, house rules — anything a guest should know."
              />
            </>
          )}

          {step.key === "cancellation" && <CancellationPolicyChoice policies={policies} value={policy} onChange={setPolicy} />}

          {step.key === "rate" && (
            <Field
              label="Nightly rate (₱)"
              name="nightly_rate"
              type="number"
              min={0}
              step="any"
              value={nightlyRate}
              onChange={(event) => setNightlyRate(event.target.value)}
              hint="Rates aren't saved yet — you'll set them on the listing once pricing is available."
            />
          )}
        </fieldset>

        <div className="flex flex-wrap gap-3">
          {stepIndex > 0 && (
            <Button type="button" variant="soft" onClick={() => setStepIndex(stepIndex - 1)} data-testid="listing-back">
              Back
            </Button>
          )}
          {isLast ? (
            <Button type="submit" disabled={create.isPending} data-testid="listing-save">
              {create.isPending ? "Saving…" : "Save as draft"}
            </Button>
          ) : step.key === "photos" ? (
            <Button type="submit" variant="soft" data-testid="listing-skip-photos">
              Skip for now
            </Button>
          ) : (
            <Button type="submit" data-testid="listing-next">
              Next
            </Button>
          )}
          <ButtonLink href="/partner/listings" variant="soft">
            Cancel
          </ButtonLink>
        </div>
      </form>
    </WizardLayout>
  );
}
