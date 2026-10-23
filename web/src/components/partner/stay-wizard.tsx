"use client";

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
import { categoryLabel, descriptionHint, LISTING_TEXT } from "./listing-fields";
import { LocationPicker } from "./location-picker";
import { NewListingPhotos, SAVED_STEPS } from "./new-listing-photos";
import { SameAsBusinessAddress, startingAddress, startingPin, useSameAsBusinessAddress } from "./same-as-business-address";
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
import { useCreateListing, type ListingBody, type ListingCategory, type PartnerListing } from "./use-partner-listings";
import { UNITS_LABEL, UnitsField } from "./units-field";
import { ChangeCategoryLink, WizardCancel } from "./wizard-cancel";
import { WizardActions, WizardLayout, WizardNext, WizardTitle } from "./wizard-steps";

const STEPS = [
  { key: "place", label: "What guests book" },
  { key: "address", label: "Address" },
  { key: "info", label: "Property info" },
  { key: "amenities", label: "Amenities" },
  { key: "basic", label: "Title and description" },
  { key: "pricing", label: "Pricing" },
  { key: "cancellation", label: "Cancellation policy" },
  { key: "units", label: UNITS_LABEL },
  ...SAVED_STEPS,
];

// Adding an accommodation (RAA-83), once its property type is chosen: what guests book,
// the address, the property info for that place type (RAA-95), amenities, the title and description, the
// pricing and fees (RAA-105), the cancellation policy (RAA-89), how many identical rooms or units it has
// (RAA-99), then photos, how guests book it (RAA-133) and, last, the listing status.
// Like ListingWizard, only the current step is on the page, every value is kept here and any
// step already reached opens again (RAA-93); Units saves the draft and then only Photos and Listing status
// are open (RAA-109).
export function StayWizard({
  business,
  category,
  policies,
}: {
  business: PartnerBusiness;
  category: ListingCategory;
  policies: CancellationPolicies;
}) {
  const create = useCreateListing();
  const [stepIndex, setStepIndex] = useState(0);
  const [reached, setReached] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const step = STEPS[stepIndex];
  // The last step before Photos saves the listing.
  const isLast = stepIndex === STEPS.length - SAVED_STEPS.length - 1;
  const [saved, setSaved] = useState<{ listing: PartnerListing; body: ListingBody }>();

  const [stay, setStay] = useState<StayValues>(NEW_STAY);
  const [infoErrors, setInfoErrors] = useState<StayErrors>();
  const [units, setUnits] = useState(1);
  const address = usePhAddress(startingAddress(business));
  const [location, setLocation] = useState<LatLng | null>(() => startingPin(business));
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
    const body: ListingBody = {
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
    };
    create.mutate(body, {
      onSuccess: (listing) => {
        setSaved({ listing, body });
      },
    });
  }

  if (saved) return <NewListingPhotos steps={STEPS} listing={saved.listing} body={saved.body} />;

  return (
    <WizardLayout steps={STEPS} current={stepIndex} reached={reached} onSelect={goTo} cancel={<WizardCancel href="/partner/listings" icon />}>
      <form ref={formRef} data-testid="stay-wizard" onSubmit={onSubmit} className="flex w-full flex-col gap-6">
        {create.error && (
          <p role="alert" className="text-sm text-danger">
            {create.error.message}
          </p>
        )}

        <fieldset data-testid={`listing-step-${step.key}`} className="flex flex-col gap-4">
          <WizardTitle>{step.label}</WizardTitle>

          {step.key === "place" && (
            <>
              <p className="text-sm text-muted">
                Listing a <span className="font-medium text-foreground">{categoryLabel(category)}</span> for{" "}
                <span className="font-medium text-foreground">{business.name}</span>.{" "}
                <ChangeCategoryLink
                  href={`/partner/listings/new?business=${business.id}&category=${category.id}`}
                  dirty={title !== "" || description !== ""}
                  />
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
                areaQuery={sameAddress.areaQuery}
                error={locationError}
                onPinAddress={address.fillFromPlace}
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

          {step.key === "basic" && (
            <>
              <Field
                label="Title"
                name="title"
                required
                minLength={LISTING_TEXT.titleMin}
                maxLength={LISTING_TEXT.titleMax}
                counter={LISTING_TEXT.titleMax}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g. Beachfront nipa cottage with sunset view"
              />
              <TextareaField
                label="Description"
                name="description"
                maxLength={LISTING_TEXT.descriptionMax}
                counter={LISTING_TEXT.descriptionMax}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                hint={descriptionHint(category)}
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
              <Button type="submit" variant="glow" size="pill" disabled={create.isPending} data-testid="listing-save">
                {create.isPending ? "Saving…" : "Save and add photos"}
              </Button>
            ) : (
              <WizardNext />
            )
          }
        />
      </form>
    </WizardLayout>
  );
}
