"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { PhAddressFields, usePhAddress } from "@/components/address/ph-address-fields";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { TextareaField } from "@/components/ui/textarea-field";
import type { LatLng } from "@/lib/map";
import { plural } from "@/lib/pricing";
import { durationText, groupText, inclusionText, scheduleText, tourTypeLabel } from "@/lib/tours";
import {
  cancellationPolicyName,
  CancellationPolicyChoice,
  DEFAULT_CANCELLATION_POLICY,
  type CancellationPolicies,
  type CancellationPolicy,
} from "./cancellation-policy";
import { categoryLabel, NO_ADDRESS } from "./listing-fields";
import { LandmarkPicker } from "./landmark-picker";
import { LocationPicker } from "./location-picker";
import { NewListingPhotos } from "./new-listing-photos";
import { SameAsBusinessAddress, useSameAsBusinessAddress } from "./same-as-business-address";
import {
  basePriceText,
  blockedDayCount,
  NEW_TOUR,
  toTourBody,
  toTourListingBody,
  TourGroupFields,
  TourInclusionFields,
  TourPricingFields,
  TourScheduleFields,
  TourTypeChoice,
  tourErrors,
  tourExtras,
  TOUR_SECTIONS,
  type TourErrors,
  type TourInclusionOptions,
  type TourValues,
} from "./tour-fields";
import type { PartnerBusiness } from "./use-partner-businesses";
import type { PartnerLandmark } from "./use-partner-landmarks";
import { useCreateListing, type ListingBody, type ListingCategory, type PartnerListing } from "./use-partner-listings";
import { WizardCancel } from "./wizard-cancel";
import { WizardActions, WizardLayout } from "./wizard-steps";

const STEPS = [
  { key: "basics", label: "The tour" },
  { key: "meeting", label: "Meeting point" },
  { key: "destinations", label: "Destinations" },
  { key: "group", label: "Group and duration" },
  { key: "schedule", label: "Schedule" },
  { key: "inclusions", label: "Inclusions" },
  { key: "pricing", label: "Pricing" },
  { key: "cancellation", label: "Cancellation policy" },
  { key: "review", label: "Review" },
  { key: "photos", label: "Photos" },
] as const;

const INTROS: Partial<Record<(typeof STEPS)[number]["key"], string>> = {
  meeting: "Where guests meet you. Guests see the area, not the pin.",
  destinations: "The places the tour visits. Travellers find it from each one.",
  schedule: "The days guests can book. Change it any time from the listing.",
  review: "Check it over. Saving keeps it as a draft; then add photos.",
};

// Adding a tour (RAA-111): what it is (private or joiner), where guests meet, the places it
// visits, the group and how long it takes, when it runs (days of the week, added dates and
// blocked days on a calendar), what it includes, the price (per group or per guest), the
// cancellation policy, a review that saves the draft and, last, photos (at most 5). Like the
// other wizards, only the current step is on the page, every value is kept here and any step
// already reached opens again; after the save only Photos is open (RAA-109). A tour has no
// units: groups a day stand in for them.
export function TourWizard({
  business,
  category,
  policies,
  inclusions,
}: {
  business: PartnerBusiness;
  category: ListingCategory;
  policies: CancellationPolicies;
  inclusions: TourInclusionOptions;
}) {
  const create = useCreateListing();
  const [stepIndex, setStepIndex] = useState(0);
  const [reached, setReached] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const step = STEPS[stepIndex];
  // Review, the step before Photos, saves the listing.
  const isLast = stepIndex === STEPS.length - 2;
  const [saved, setSaved] = useState<{ listing: PartnerListing; body: ListingBody }>();
  const extras = tourExtras(category);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const address = usePhAddress(NO_ADDRESS);
  const [location, setLocation] = useState<LatLng | null>(null);
  const [locationError, setLocationError] = useState<string>();
  const sameAddress = useSameAsBusinessAddress(business, address, (point) => {
    setLocation(point);
    setLocationError(undefined);
  });
  const [landmarks, setLandmarks] = useState<PartnerLandmark[]>([]);
  const [tour, setTour] = useState<TourValues>(NEW_TOUR);
  const [errors, setErrors] = useState<TourErrors>();
  const [policy, setPolicy] = useState<CancellationPolicy>(DEFAULT_CANCELLATION_POLICY);

  const changeTour = (values: TourValues) => {
    setTour(values);
    setErrors(undefined);
  };

  // The current step's checks: the browser's required fields, the map pin and the tour's own.
  function stepIsValid() {
    if (!formRef.current?.reportValidity()) return false;
    if (step.key === "meeting" && !location) {
      setLocationError("Drop a pin on the map");
      return false;
    }
    if (step.key === "group" || step.key === "schedule" || step.key === "inclusions" || step.key === "pricing") {
      const found = tourErrors(tour, step.key);
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
    // A step reached earlier may no longer hold (a joiner tour made private needs its add-ons
    // priced): open the first that doesn't.
    const broken = (Object.keys(TOUR_SECTIONS) as (keyof typeof TOUR_SECTIONS)[]).find((key) => tourErrors(tour, key));
    if (broken) {
      setStepIndex(STEPS.findIndex((other) => other.key === broken));
      setErrors(tourErrors(tour, broken));
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
      landmark_ids: landmarks.map((landmark) => landmark.id),
      ...toTourListingBody(tour, extras),
    };
    create.mutate(body, {
      onSuccess: (listing) => {
        setSaved({ listing, body });
        setStepIndex(STEPS.length - 1);
        setReached(STEPS.length - 1);
      },
    });
  }

  const steps = [...STEPS];
  if (saved) {
    return (
      <WizardLayout steps={steps} current={stepIndex} reached={reached} onSelect={goTo} locked>
        <NewListingPhotos listing={saved.listing} body={saved.body} />
      </WizardLayout>
    );
  }

  return (
    <WizardLayout steps={steps} current={stepIndex} reached={reached} onSelect={goTo}>
      <form ref={formRef} data-testid="tour-wizard" onSubmit={onSubmit} className="relative flex w-full flex-col gap-6">
        <WizardCancel href="/partner/listings" className="absolute right-0 top-0" />
        {create.error && (
          <p role="alert" className="text-sm text-danger">
            {create.error.message}
          </p>
        )}

        <fieldset data-testid={`listing-step-${step.key}`} className="flex flex-col gap-4">
          <legend className="mb-2 pr-20 font-display text-2xl font-extrabold tracking-tight">{step.label}</legend>
          {INTROS[step.key] && <p className="-mt-2 text-sm text-muted">{INTROS[step.key]}</p>}

          {step.key === "basics" && (
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
                placeholder="e.g. Island hopping to Virgin Island and Hilantagaan"
              />
              <TextareaField
                label="Description"
                name="description"
                maxLength={5000}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                hint="The route, what to bring, anything a traveller should know."
              />
              <TourTypeChoice values={tour} onChange={changeTour} />
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
                error={locationError}
              />
            </>
          )}

          {step.key === "destinations" && <LandmarkPicker value={landmarks} onChange={setLandmarks} near={location} />}

          {step.key === "group" && <TourGroupFields values={tour} onChange={changeTour} errors={errors} />}

          {step.key === "schedule" && <TourScheduleFields values={tour} onChange={changeTour} errors={errors} />}

          {step.key === "inclusions" && (
            <TourInclusionFields values={tour} onChange={changeTour} errors={errors} kinds={inclusions} extras={extras} />
          )}

          {step.key === "pricing" && <TourPricingFields values={tour} onChange={changeTour} errors={errors} />}

          {step.key === "cancellation" && <CancellationPolicyChoice policies={policies} value={policy} onChange={setPolicy} />}

          {step.key === "review" && (
            <TourReview
              rows={[
                ["Title", title.trim()],
                ["Tour", tourTypeLabel(tour.tourType)],
                ["Meeting point", [address.values.street, address.values.city].filter(Boolean).join(", ") || "—"],
                ["Destinations", landmarks.map((landmark) => landmark.name).join(", ") || "None picked"],
                ...reviewRows(tour, extras.filter((field) => tour.attrs[field.key] === true).map((field) => field.label)),
                ["Cancellation policy", cancellationPolicyName(policies, policy)],
              ]}
              onEdit={(key) => goTo(STEPS.findIndex((other) => other.key === key))}
            />
          )}
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

// The tour's own lines of the review, as a guest will read them.
function reviewRows(tour: TourValues, extras: string[]): [string, string][] {
  const body = toTourBody(tour);
  const inclusions = (body.inclusions ?? []).map((inclusion) =>
    inclusionText(
      {
        kind: inclusion.kind,
        options: inclusion.options ?? [],
        note: inclusion.note ?? null,
        price_per_head_cents: inclusion.price_per_head_cents ?? 0,
      },
      body.tour_type,
    ),
  );
  const included = [...inclusions, ...extras];
  return [
    ["Group", `${groupText(body.min_guests, body.max_guests)}, ${body.max_groups_per_day} a day`],
    ["Duration", durationText(body.duration_value, body.duration_unit)],
    ["Runs", scheduleText(body.weekdays, body.dates.length)],
    ["Blocked days", blockedDayCount(tour) ? plural(blockedDayCount(tour), "day") : "None"],
    [body.tour_type === "private" ? "Add-ons" : "Included", included.join("; ") || "Nothing listed"],
    ["Price", basePriceText(tour)],
    ["Fees", tour.fees.map((fee) => fee.name.trim()).join(", ") || "None"],
  ];
}

function TourReview({ rows, onEdit }: { rows: [string, ReactNode][]; onEdit: (step: string) => void }) {
  return (
    <div data-testid="tour-review" className="flex flex-col gap-4">
      <dl className="grid gap-x-6 gap-y-3 rounded-card bg-surface-2 p-5 text-sm sm:grid-cols-[9rem_1fr]">
        {rows.map(([term, value]) => (
          <div key={term} className="contents">
            <dt className="font-semibold text-muted">{term}</dt>
            <dd className="-mt-2 min-w-0 break-words sm:mt-0">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap gap-2 text-sm">
        <span className="text-muted">Change:</span>
        {(["basics", "schedule", "inclusions", "pricing"] as const).map((key) => (
          <button key={key} type="button" onClick={() => onEdit(key)} className="font-medium text-link underline">
            {STEPS.find((other) => other.key === key)?.label}
          </button>
        ))}
      </div>
    </div>
  );
}
