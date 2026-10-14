"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { PhAddressFields, usePhAddress } from "@/components/address/ph-address-fields";
import { Button, ButtonLink } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { SelectField } from "@/components/ui/select-field";
import { TextareaField } from "@/components/ui/textarea-field";
import type { LatLng } from "@/lib/map";
import { CancellationPolicyChoice, type CancellationPolicy } from "./cancellation-policy";
import { listingChanges } from "./listing-changes";
import {
  addressChanged,
  AttributeFields,
  attributeFields,
  categoryLabel,
  geocodeQuery,
  toAttributeValues,
  toAttrs,
  visitsLandmarks as picksLandmarks,
  type AttributeValues,
} from "./listing-fields";
import { LandmarkPicker } from "./landmark-picker";
import { ListingPhotos, orderedPhotos } from "./listing-photos";
import { LocationPicker } from "./location-picker";
import {
  AmenityChoice,
  isStay,
  PlaceTypeChoice,
  PropertyInfoFields,
  stayErrors,
  toStayAttrs,
  toStayValues,
  type StayErrors,
  type StayValues,
} from "./stay-fields";
import {
  pricingErrors,
  StayPricingFields,
  toFeesBody,
  toPricingValues,
  toStayRateBody,
  type PricingErrors,
  type PricingValues,
} from "./stay-pricing-fields";
import {
  isTour,
  toTourListingBody,
  toTourValues,
  TourGroupFields,
  TourInclusionFields,
  TourPricingFields,
  TourScheduleFields,
  TourTypeChoice,
  tourErrors,
  tourExtras,
  type TourErrors,
  type TourValues,
} from "./tour-fields";
import type { PartnerBusiness } from "./use-partner-businesses";
import type { PartnerLandmark } from "./use-partner-landmarks";
import { isVehicle, toVehicleAttrs, toVehicleValues, VehicleFields, type VehicleValues } from "./vehicle-fields";
import { useUpdateListing, type ListingBody, type ListingOptions, type PartnerListing } from "./use-partner-listings";
import { UnitsField } from "./units-field";

// Changing a listing (RAA-47): what it is, where it is, the landmarks a tour or activity
// visits (RAA-70), the details its category asks for (an accommodation's own, RAA-83; a
// vehicle's, RAA-89), an accommodation's pricing and fees (RAA-105), the cancellation policy
// (RAA-89), how many identical units it has (RAA-99) and, last, its photos (RAA-109). A tour has
// the TourWizard's sections instead of details and units (RAA-111). Saving first shows what changed and asks to confirm. Adding one is the stepped
// ListingWizard (RAA-50). A partner with several businesses can move it to another (RAA-101).
export function ListingForm({
  options,
  businesses,
  listing,
}: {
  options: ListingOptions;
  businesses: PartnerBusiness[];
  listing: PartnerListing;
}) {
  const router = useRouter();
  const update = useUpdateListing(listing.id);
  const [businessId, setBusinessId] = useState(String(listing.business.id));
  const [categoryId, setCategoryId] = useState(String(listing.category.id));
  const [attrValues, setAttrValues] = useState<AttributeValues>(() => toAttributeValues(listing.attrs));
  // An accommodation's details have their own fields (RAA-83).
  const [stay, setStay] = useState<StayValues>(() => toStayValues(listing.attrs));
  const [infoErrors, setInfoErrors] = useState<StayErrors>();
  const [pricing, setPricing] = useState<PricingValues>(() => toPricingValues(listing.stay_rate, listing.fees));
  const [priceErrors, setPriceErrors] = useState<PricingErrors>();
  const [vehicleValues, setVehicleValues] = useState<VehicleValues>(() => toVehicleValues(listing.attrs));
  const [tour, setTour] = useState<TourValues>(() => toTourValues(listing));
  const [tourProblems, setTourProblems] = useState<TourErrors>();
  const [policy, setPolicy] = useState<CancellationPolicy>(listing.cancellation_policy);
  const [units, setUnits] = useState(listing.units_count);
  const address = usePhAddress(listing.address);
  const [location, setLocation] = useState<LatLng | null>(listing.location);
  const [locationError, setLocationError] = useState<string>();
  const [landmarks, setLandmarks] = useState<PartnerLandmark[]>(listing.landmarks);
  // The edit waiting for the partner to confirm it, and what it changes.
  const [pending, setPending] = useState<{ body: ListingBody; changes: string[] }>();
  // Photos are added and deleted at once (RAA-109); only a new order waits for Save.
  const [photoOrder, setPhotoOrder] = useState<number[]>();
  const [photosBusy, setPhotosBusy] = useState(false);
  const listingPath = `/partner/listings/${listing.id}`;

  const category = options.categories.find((option) => String(option.id) === categoryId);
  // A saved listing's pin stays where it is until the partner changes the address.
  const addressQuery = addressChanged(address, listing.address) ? geocodeQuery(address) : undefined;
  const stayCategory = isStay(category);
  const vehicleCategory = isVehicle(category);
  const tourCategory = isTour(category);
  const fields = stayCategory || vehicleCategory || tourCategory ? [] : attributeFields(category);
  const extras = tourExtras(category);
  const changeTour = (values: TourValues) => {
    setTour(values);
    setTourProblems(undefined);
  };
  // A vehicle keeps the attrs the form doesn't show (a plate number) while it stays a vehicle.
  const savedAsVehicle = isVehicle(options.categories.find((option) => option.id === listing.category.id));
  // Changing to a category that doesn't visit landmarks (not a tour) drops them when saved.
  const visitsLandmarks = picksLandmarks(category);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!location) {
      setLocationError("Drop a pin on the map");
      return;
    }
    if (stayCategory && stayErrors(stay)) {
      setInfoErrors(stayErrors(stay));
      return;
    }
    if (stayCategory && pricingErrors(pricing)) {
      setPriceErrors(pricingErrors(pricing));
      return;
    }
    if (tourCategory && tourErrors(tour)) {
      setTourProblems(tourErrors(tour));
      return;
    }
    const form = new FormData(event.currentTarget);
    const body = {
      title: String(form.get("title") ?? ""),
      description: String(form.get("description") ?? ""),
      business_id: Number(businessId),
      category_id: Number(categoryId),
      address: address.toBody(),
      location,
      attrs: stayCategory
        ? toStayAttrs(stay)
        : vehicleCategory
          ? toVehicleAttrs(vehicleValues, savedAsVehicle ? listing.attrs : {})
          : toAttrs(fields, attrValues),
      cancellation_policy: policy,
      units_count: units,
      landmark_ids: visitsLandmarks ? landmarks.map((landmark) => landmark.id) : [],
      // Only accommodation is priced by the night, and a tour by its own price (RAA-111); other
      // categories' fees aren't edited here yet.
      ...(stayCategory
        ? { stay_rate: toStayRateBody(pricing, stay.placeType, stay.guests), fees: toFeesBody(pricing) }
        : {}),
      ...(tourCategory ? toTourListingBody(tour, extras) : {}),
      // Sent only once moved: a body's photos deletes any photo it leaves out.
      ...(photoOrder ? { photos: orderedPhotos(listing.photos, photoOrder).map((photo) => photo.id) } : {}),
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
        {businesses.length > 1 && (
          <SelectField
            label="Business"
            name="business_id"
            required
            value={businessId}
            onChange={(event) => setBusinessId(event.target.value)}
            options={businesses.map((business) => ({ value: String(business.id), label: business.name }))}
          />
        )}
        <SelectField
          label="Category"
          name="category_id"
          required
          value={categoryId}
          onChange={(event) => {
            setCategoryId(event.target.value);
            setAttrValues({});
            setStay(toStayValues({}));
            setVehicleValues(toVehicleValues({}));
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
        <legend className="mb-2 font-display text-2xl font-extrabold tracking-tight">Where it is</legend>
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
          <legend className="mb-2 font-display text-2xl font-extrabold tracking-tight">
            {tourCategory ? "Destinations" : "Landmarks it visits"}
          </legend>
          <LandmarkPicker value={landmarks} onChange={setLandmarks} near={location} />
        </fieldset>
      )}

      {stayCategory && (
        <>
          <fieldset data-testid="listing-stay-place" className="flex flex-col gap-4">
            <legend className="mb-2 font-display text-2xl font-extrabold tracking-tight">What guests book</legend>
            <PlaceTypeChoice values={stay} onChange={setStay} />
          </fieldset>
          <fieldset data-testid="listing-stay-info" className="flex flex-col gap-4">
            <legend className="mb-2 font-display text-2xl font-extrabold tracking-tight">Property info</legend>
            <PropertyInfoFields
              values={stay}
              onChange={(values) => {
                setStay(values);
                setInfoErrors(undefined);
              }}
              errors={infoErrors}
            />
          </fieldset>
          <fieldset className="flex flex-col gap-4">
            <legend className="mb-2 font-display text-2xl font-extrabold tracking-tight">Amenities</legend>
            <AmenityChoice values={stay} onChange={setStay} />
          </fieldset>
          <fieldset data-testid="listing-stay-pricing" className="flex flex-col gap-4">
            <legend className="mb-2 font-display text-2xl font-extrabold tracking-tight">Pricing</legend>
            {!listing.stay_rate?.nightly_price_cents && (
              <p role="status" className="text-sm font-medium text-warning">
                Set a nightly price: guests don&apos;t see a price for this place until you do.
              </p>
            )}
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
          </fieldset>
        </>
      )}

      {tourCategory && (
        <>
          {tourProblems && (
            <p role="alert" className="text-sm text-danger">
              Check the tour&apos;s details below.
            </p>
          )}
          <fieldset data-testid="listing-tour-type" className="flex flex-col gap-4">
            <legend className="mb-2 font-display text-2xl font-extrabold tracking-tight">The tour</legend>
            {listing.tour && !listing.tour.base_price_cents && (
              <p role="status" className="text-sm font-medium text-warning">
                Set the tour&apos;s details and price: guests don&apos;t see a price for it until you do.
              </p>
            )}
            <TourTypeChoice values={tour} onChange={changeTour} />
          </fieldset>
          <fieldset data-testid="listing-tour-group" className="flex flex-col gap-4">
            <legend className="mb-2 font-display text-2xl font-extrabold tracking-tight">Group and duration</legend>
            <TourGroupFields values={tour} onChange={changeTour} errors={tourProblems} />
          </fieldset>
          <fieldset data-testid="listing-tour-schedule" className="flex flex-col gap-4">
            <legend className="mb-2 font-display text-2xl font-extrabold tracking-tight">Schedule</legend>
            <TourScheduleFields values={tour} onChange={changeTour} errors={tourProblems} />
          </fieldset>
          <fieldset data-testid="listing-tour-inclusions" className="flex flex-col gap-4">
            <legend className="mb-2 font-display text-2xl font-extrabold tracking-tight">Inclusions</legend>
            <TourInclusionFields
              values={tour}
              onChange={changeTour}
              errors={tourProblems}
              kinds={options.tour_inclusions}
              extras={extras}
            />
          </fieldset>
          <fieldset data-testid="listing-tour-pricing" className="flex flex-col gap-4">
            <legend className="mb-2 font-display text-2xl font-extrabold tracking-tight">Pricing</legend>
            <TourPricingFields values={tour} onChange={changeTour} errors={tourProblems} />
          </fieldset>
        </>
      )}

      {vehicleCategory && (
        <fieldset className="flex flex-col gap-4">
          <legend className="mb-2 font-display text-2xl font-extrabold tracking-tight">Vehicle details</legend>
          <VehicleFields values={vehicleValues} onChange={setVehicleValues} />
        </fieldset>
      )}

      {fields.length > 0 && (
        <fieldset data-testid="listing-details" className="flex flex-col gap-4">
          <legend className="mb-2 font-display text-2xl font-extrabold tracking-tight">Details</legend>
          <AttributeFields fields={fields} values={attrValues} onChange={setAttrValues} />
        </fieldset>
      )}

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 font-display text-2xl font-extrabold tracking-tight">Cancellation policy</legend>
        <CancellationPolicyChoice policies={options.cancellation_policies} value={policy} onChange={setPolicy} />
      </fieldset>

      {!tourCategory && (
        <fieldset className="flex flex-col gap-4">
          <legend className="mb-2 font-display text-2xl font-extrabold tracking-tight">Units</legend>
          <UnitsField bookingType={category?.booking_type} value={units} onChange={setUnits} />
        </fieldset>
      )}

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 font-display text-2xl font-extrabold tracking-tight">Photos</legend>
        <p className="text-sm text-muted">New photos and deletions are saved straight away; a new order is saved with the rest.</p>
        <ListingPhotos
          listingId={listing.id}
          photos={listing.photos}
          limit={listing.photo_limit}
          order={photoOrder}
          onOrderChange={setPhotoOrder}
          onBusyChange={setPhotosBusy}
        />
      </fieldset>

      <div className="flex gap-3">
        <Button type="submit" disabled={update.isPending || photosBusy} data-testid="listing-save">
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
