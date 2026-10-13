"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { PhAddressFields, usePhAddress } from "@/components/address/ph-address-fields";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { TextareaField } from "@/components/ui/textarea-field";
import type { LatLng } from "@/lib/map";
import {
  CancellationPolicyChoice,
  DEFAULT_CANCELLATION_POLICY,
  type CancellationPolicies,
  type CancellationPolicy,
} from "./cancellation-policy";
import { categoryLabel, NO_ADDRESS } from "./listing-fields";
import { LocationPicker } from "./location-picker";
import { PhotoUploadSkeleton } from "./photo-upload-skeleton";
import { SameAsBusinessAddress, useSameAsBusinessAddress } from "./same-as-business-address";
import {
  NEW_PRICING,
  pricingErrors,
  StayPricingFields,
  toFeesBody,
  toStayRateBody,
  type PricingErrors,
  type PricingValues,
} from "./stay-pricing-fields";
import {
  AmenityChoice,
  NEW_STAY,
  PlaceTypeChoice,
  PropertyInfoFields,
  stayErrors,
  toStayAttrs,
  type StayErrors,
  type StayValues,
} from "./stay-fields";
import type { PartnerBusiness } from "./use-partner-businesses";
import { useCreateListing, type ListingCategory } from "./use-partner-listings";
import { UnitsField } from "./units-field";
import { WizardCancel } from "./wizard-cancel";
import { WizardActions, WizardLayout } from "./wizard-steps";

const STEPS = [
  { key: "place", label: "What guests book" },
  { key: "address", label: "Address" },
  { key: "info", label: "Property info" },
  { key: "amenities", label: "Amenities" },
  { key: "photos", label: "Photos" },
  { key: "basic", label: "Title and description" },
  { key: "pricing", label: "Pricing" },
  { key: "cancellation", label: "Cancellation policy" },
  { key: "units", label: "Units" },
];

// Adding an accommodation (RAA-83), once its property type is chosen: what guests book,
// the address, the property info for that place type (RAA-95), amenities, photos (a placeholder until the API
// stores them), the title and description, the pricing and fees (RAA-105), the cancellation policy (RAA-89)
// and how many identical rooms or units it has (RAA-99).
// Like ListingWizard, only the current step is on the page, every value is kept here and any
// step already reached opens again (RAA-93).
export function StayWizard({
  business,
  category,
  policies,
}: {
  business: PartnerBusiness;
  category: ListingCategory;
  policies: CancellationPolicies;
}) {
  const router = useRouter();
  const create = useCreateListing();
  const [stepIndex, setStepIndex] = useState(0);
  const [reached, setReached] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const step = STEPS[stepIndex];
  const isLast = stepIndex === STEPS.length - 1;

  const [stay, setStay] = useState<StayValues>(NEW_STAY);
  const [infoErrors, setInfoErrors] = useState<StayErrors>();
  const [units, setUnits] = useState(1);
  const address = usePhAddress(NO_ADDRESS);
  const [location, setLocation] = useState<LatLng | null>(null);
  const [locationError, setLocationError] = useState<string>();
  const sameAddress = useSameAsBusinessAddress(business, address, (point) => {
    setLocation(point);
    setLocationError(undefined);
  });
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [policy, setPolicy] = useState<CancellationPolicy>(DEFAULT_CANCELLATION_POLICY);
  const [pricing, setPricing] = useState<PricingValues>(NEW_PRICING);
  const [priceErrors, setPriceErrors] = useState<PricingErrors>();

  // The current step's checks: the browser's required fields, the map pin and the beds.
  function stepIsValid() {
    if (!formRef.current?.reportValidity()) return false;
    if (step.key === "address" && !location) {
      setLocationError("Drop a pin on the map");
      return false;
    }
    if (step.key === "info" && stayErrors(stay)) {
      setInfoErrors(stayErrors(stay));
      return false;
    }
    if (step.key === "pricing" && pricingErrors(pricing)) {
      setPriceErrors(pricingErrors(pricing));
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
    create.mutate(
      {
        title: title.trim(),
        description: description.trim(),
        business_id: business.id,
        category_id: category.id,
        address: address.toBody(),
        location,
        attrs: toStayAttrs(stay),
        cancellation_policy: policy,
        units_count: units,
        stay_rate: toStayRateBody(pricing, stay.placeType, stay.guests),
        fees: toFeesBody(pricing),
      },
      { onSuccess: () => router.push("/partner/listings") },
    );
  }

  return (
    <WizardLayout steps={STEPS} current={stepIndex} reached={reached} onSelect={goTo}>
      <form ref={formRef} data-testid="stay-wizard" onSubmit={onSubmit} className="relative flex w-full flex-col gap-6">
        <WizardCancel href="/partner/listings" className="absolute right-0 top-0" />
        {create.error && (
          <p role="alert" className="text-sm text-danger">
            {create.error.message}
          </p>
        )}

        <fieldset data-testid={`listing-step-${step.key}`} className="flex flex-col gap-4">
          <legend className="mb-2 pr-20 font-display text-2xl font-extrabold tracking-tight">{step.label}</legend>

          {step.key === "place" && (
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
              <PlaceTypeChoice values={stay} onChange={setStay} />
            </>
          )}

          {step.key === "address" && (
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

          {step.key === "info" && (
            <>
              <PropertyInfoFields
                values={stay}
                onChange={(values) => {
                  setStay(values);
                  setInfoErrors(undefined);
                }}
                errors={infoErrors}
              />
            </>
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

          {step.key === "pricing" && (
            <StayPricingFields
              values={pricing}
              onChange={(values) => {
                setPricing(values);
                setPriceErrors(undefined);
              }}
              placeType={stay.placeType}
              sleeps={stay.guests}
              errors={priceErrors}
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
            )
          }
        />
      </form>
    </WizardLayout>
  );
}
