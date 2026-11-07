"use client";

import { useRef, useState, type FormEvent } from "react";
import { PhAddressFields, usePhAddress } from "@/components/address/ph-address-fields";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { TextareaField } from "@/components/ui/textarea-field";
import type { LatLng } from "@/lib/map";
import {
  ActivityInclusionFields,
  ActivityPricingFields,
  activityErrors,
  activityReviewRows,
  ActivityRunFields,
  ACTIVITY_SECTIONS,
  newActivityValues,
  toActivityBody,
  type ActivityCatalogues,
  type ActivityErrors,
  type ActivitySection,
  type ActivityValues,
} from "./activity-fields";
import {
  cancellationPolicyName,
  CancellationPolicyChoice,
  DEFAULT_CANCELLATION_POLICY,
  type CancellationPolicies,
  type CancellationPolicy,
} from "./cancellation-policy";
import { categoryLabel, descriptionHint, LISTING_TEXT } from "./listing-fields";
import { LocationPicker } from "./location-picker";
import { NewListingPhotos, SAVED_STEPS } from "./new-listing-photos";
import { SameAsBusinessAddress, startingAddress, startingPin, useSameAsBusinessAddress } from "./same-as-business-address";
import { UnitsField, UNITS_LABEL } from "./units-field";
import type { PartnerBusiness } from "./use-partner-businesses";
import { useCreateListing, type ListingBody, type ListingCategory, type PartnerListing } from "./use-partner-listings";
import { ChangeCategoryLink, WizardCancel } from "./wizard-cancel";
import { WizardActions, WizardLayout, WizardNext, WizardTitle } from "./wizard-steps";

const STEPS = [
  { key: "basics", label: "The activity" },
  { key: "meeting", label: "Where guests start" },
  { key: "runs", label: "How it runs" },
  { key: "pricing", label: "Pricing" },
  { key: "inclusions", label: "Inclusions" },
  { key: "units", label: UNITS_LABEL },
  { key: "cancellation", label: "Cancellation policy" },
  { key: "review", label: "Review" },
  ...SAVED_STEPS,
] as const;

type StepKey = (typeof STEPS)[number]["key"];

const INTROS: Partial<Record<StepKey, string>> = {
  meeting: "Where guests meet you, and what drop-off distances are measured from. Guests see the area, not the pin.",
  inclusions: "What every guest gets, at no extra cost.",
  review: "Check it over. Saving keeps it as a draft; then add photos.",
};

const isActivityStep = (key: StepKey): key is ActivitySection => key in ACTIVITY_SECTIONS;

// Adding a water activity (RAA-272): what it is, where guests start, how it is sold and when it
// runs, its pricing (rates of a length, a price and the riders on one unit; drop-off zones;
// add-ons from a fixed list), what it includes, how many units, the cancellation policy, then a review
// that saves the draft, photos, booking and status. Pre-filled from the category's builder
// defaults (RAA-270); otherwise it works like the tour wizard: only the current step is on the
// page, every value is kept here and any step already reached opens again.
export function ActivityWizard({
  business,
  category,
  policies,
  catalogues,
}: {
  business: PartnerBusiness;
  category: ListingCategory;
  policies: CancellationPolicies;
  catalogues: ActivityCatalogues;
}) {
  const create = useCreateListing();
  const [stepIndex, setStepIndex] = useState(0);
  const [reached, setReached] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const step = STEPS[stepIndex];
  // Review, the step before Photos, saves the listing.
  const isLast = stepIndex === STEPS.length - SAVED_STEPS.length - 1;
  const [saved, setSaved] = useState<{ listing: PartnerListing; body: ListingBody }>();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const address = usePhAddress(startingAddress(business));
  const [location, setLocation] = useState<LatLng | null>(() => startingPin(business));
  const [locationError, setLocationError] = useState<string>();
  const sameAddress = useSameAsBusinessAddress(business, address, (point) => {
    setLocation(point);
    setLocationError(undefined);
  });
  const [activity, setActivity] = useState<ActivityValues>(() => newActivityValues(category.activity_defaults));
  const [errors, setErrors] = useState<ActivityErrors>();
  const [units, setUnits] = useState(1);
  const [policy, setPolicy] = useState<CancellationPolicy>(DEFAULT_CANCELLATION_POLICY);

  const changeActivity = (values: ActivityValues) => {
    setActivity(values);
    setErrors(undefined);
  };

  // The current step's checks: the browser's required fields, the map pin and the activity's own.
  function stepIsValid() {
    if (!formRef.current?.reportValidity()) return false;
    if (step.key === "meeting" && !location) {
      setLocationError("Drop a pin on the map");
      return false;
    }
    if (isActivityStep(step.key)) {
      const found = activityErrors(activity, step.key);
      setErrors(found);
      if (found) return false;
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
    if (!location) return;
    // A step reached earlier may no longer hold (open hours shortened under a long rate): open
    // the first that doesn't.
    const broken = (Object.keys(ACTIVITY_SECTIONS) as ActivitySection[]).find((key) => activityErrors(activity, key));
    if (broken) {
      setStepIndex(STEPS.findIndex((other) => other.key === broken));
      setErrors(activityErrors(activity, broken));
      return;
    }
    const body: ListingBody = {
      title: title.trim(),
      description: description.trim(),
      business_id: business.id,
      category_id: category.id,
      address: address.toBody(),
      location,
      cancellation_policy: policy,
      units_count: units,
      activity: toActivityBody(activity),
    };
    create.mutate(body, { onSuccess: (listing) => setSaved({ listing, body }) });
  }

  const steps = [...STEPS];
  if (saved) return <NewListingPhotos steps={steps} listing={saved.listing} body={saved.body} />;

  return (
    <WizardLayout steps={steps} current={stepIndex} reached={reached} onSelect={goTo} cancel={<WizardCancel href="/partner/listings" icon />}>
      <form ref={formRef} data-testid="activity-wizard" onSubmit={onSubmit} className="flex w-full flex-col gap-6">
        {create.error && (
          <p role="alert" className="text-sm text-danger">
            {create.error.message}
          </p>
        )}

        <fieldset data-testid={`listing-step-${step.key}`} className="flex flex-col gap-4">
          <WizardTitle>{step.label}</WizardTitle>
          {INTROS[step.key] && <p className="-mt-2 text-sm text-muted">{INTROS[step.key]}</p>}

          {step.key === "basics" && (
            <>
              <p className="text-sm text-muted">
                Listing under <span className="font-medium text-foreground">{categoryLabel(category)}</span> for{" "}
                <span className="font-medium text-foreground">{business.name}</span>.{" "}
                <ChangeCategoryLink
                  href={`/partner/listings/new?business=${business.id}&category=${category.id}`}
                  dirty={title !== "" || description !== ""}
                />
              </p>
              <Field
                label="Title"
                name="title"
                required
                minLength={LISTING_TEXT.titleMin}
                maxLength={LISTING_TEXT.titleMax}
                counter={LISTING_TEXT.titleMax}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g. Jet ski rides at Sugar Beach"
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

          {step.key === "meeting" && (
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

          {step.key === "runs" && <ActivityRunFields values={activity} onChange={changeActivity} errors={errors} />}

          {step.key === "pricing" && (
            <ActivityPricingFields
              values={activity}
              onChange={changeActivity}
              errors={errors}
              location={location}
              addOnKinds={catalogues.addOns}
              chargedPer={catalogues.chargedPer}
            />
          )}

          {step.key === "inclusions" && (
            <ActivityInclusionFields values={activity} onChange={changeActivity} errors={errors} kinds={catalogues.inclusions} />
          )}

          {step.key === "units" && <UnitsField bookingType={category.booking_type} water value={units} onChange={setUnits} />}

          {step.key === "cancellation" && <CancellationPolicyChoice policies={policies} value={policy} onChange={setPolicy} />}

          {step.key === "review" && (
            <div data-testid="activity-review" className="flex flex-col gap-4">
              <dl className="grid gap-x-6 gap-y-3 rounded-card bg-surface-2 p-5 text-sm sm:grid-cols-[9rem_1fr]">
                {[
                  ["Title", title.trim()],
                  ["Where guests start", [address.values.street, address.values.city].filter(Boolean).join(", ") || "—"],
                  ...activityReviewRows(activity, catalogues),
                  [UNITS_LABEL, String(units)],
                  ["Cancellation policy", cancellationPolicyName(policies, policy)],
                ].map(([term, value]) => (
                  <div key={term} className="contents">
                    <dt className="font-semibold text-muted">{term}</dt>
                    <dd className="-mt-2 min-w-0 break-words sm:mt-0">{value}</dd>
                  </div>
                ))}
              </dl>
              <div className="flex flex-wrap gap-2 text-sm">
                <span className="text-muted">Change:</span>
                {(["basics", "runs", "pricing", "inclusions"] as const).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => goTo(STEPS.findIndex((other) => other.key === key))}
                    className="font-medium text-link underline"
                  >
                    {STEPS.find((other) => other.key === key)?.label}
                  </button>
                ))}
              </div>
            </div>
          )}
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
