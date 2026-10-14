"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { PhAddressFields, usePhAddress } from "@/components/address/ph-address-fields";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { Dialog } from "@/components/ui/dialog";
import { GlassPanel, glassClasses } from "@/components/ui/glass";
import { Field } from "@/components/ui/field";
import { SelectField } from "@/components/ui/select-field";
import { TextareaField } from "@/components/ui/textarea-field";
import type { LatLng } from "@/lib/map";
import { CancellationPolicyChoice, type CancellationPolicy } from "./cancellation-policy";
import { listingChanges } from "./listing-changes";
import {
  addressChanged,
  areaQuery,
  AttributeFields,
  attributeFields,
  categoryLabel,
  descriptionHint,
  geocodeQuery,
  titleExample,
  toAttributeValues,
  toAttrs,
  visitsLandmarks as picksLandmarks,
  type AttributeValues,
} from "./listing-fields";
import { LandmarkPicker } from "./landmark-picker";
import { ListingPhotos, orderedPhotos } from "./listing-photos";
import { uploadedPhotos } from "./use-listing-photos";
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
  TOUR_PHOTO_LIMIT,
  toTourListingBody,
  toTourValues,
  TourGroupFields,
  TourInclusionFields,
  TourPricingFields,
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
  // Made a tour here, the listing takes a tour's photos before it is saved as one.
  const photoLimit = tourCategory && !listing.tour ? TOUR_PHOTO_LIMIT : listing.photo_limit;
  const extraPhotos = uploadedPhotos(listing.photos).length - photoLimit;
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
      // A tour has no units: groups a day stand in for them (RAA-111).
      units_count: tourCategory ? 1 : units,
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

  // The page's sections, in order, for the index beside them (and above them on a phone).
  const sections = [
    { id: "about", label: "About" },
    { id: "where", label: "Where it is" },
    ...(visitsLandmarks ? [{ id: "landmarks", label: tourCategory ? "Destinations" : "Landmarks" }] : []),
    ...(stayCategory
      ? [
          { id: "place", label: "What guests book" },
          { id: "property", label: "Property info" },
          { id: "amenities", label: "Amenities" },
          { id: "stay-pricing", label: "Pricing" },
        ]
      : []),
    ...(tourCategory
      ? [
          { id: "tour", label: "The tour" },
          { id: "group", label: "Group and duration" },
          { id: "inclusions", label: "Inclusions" },
          { id: "tour-pricing", label: "Pricing" },
        ]
      : []),
    ...(vehicleCategory ? [{ id: "vehicle", label: "Vehicle details" }] : []),
    ...(fields.length > 0 ? [{ id: "details", label: "Details" }] : []),
    { id: "cancellation", label: "Cancellation policy" },
    ...(!tourCategory ? [{ id: "units", label: "Units" }] : []),
    { id: "photos", label: "Photos" },
  ];

  return (
    <form
      data-testid="listing-form"
      onSubmit={onSubmit}
      className="flex flex-col gap-6 md:grid md:grid-cols-[13rem_minmax(0,42rem)] md:items-start md:gap-10"
    >
      <nav aria-label="Sections" className="-mx-4 overflow-x-auto px-4 md:sticky md:top-24 md:mx-0 md:px-0">
        <ol className="flex gap-2 md:flex-col md:gap-1">
          {sections.map((section) => (
            <li key={section.id} className="shrink-0">
              <a
                href={`#${section.id}`}
                className={cn(
                  glassClasses("dark"),
                  "flex rounded-full px-3 py-2 text-sm whitespace-nowrap hover:bg-glass-hover",
                  "md:border-transparent md:bg-transparent md:backdrop-blur-none",
                )}
              >
                {section.label}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="flex min-w-0 flex-col gap-6">
        {update.error && (
          <GlassPanel role="alert" className="rounded-card px-5 py-4 text-sm font-semibold">
            {update.error.message}
          </GlassPanel>
        )}
        {tourProblems && (
          <GlassPanel role="alert" className="rounded-card px-5 py-4 text-sm font-semibold">
            Check the tour&apos;s details: the sections below say what&apos;s missing.
          </GlassPanel>
        )}

        <EditSection id="about" title="About">
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
            placeholder={`e.g. ${titleExample(category)}`}
          />
          <TextareaField
            label="Description"
            name="description"
            maxLength={5000}
            defaultValue={listing.description}
            hint={descriptionHint(category)}
          />
        </EditSection>

        <EditSection id="where" title="Where it is">
          <PhAddressFields address={address} />
          <LocationPicker
            value={location}
            onChange={(point) => {
              setLocation(point);
              setLocationError(undefined);
            }}
            geocodeQuery={addressQuery}
            areaQuery={areaQuery(address)}
            error={locationError}
            onPinAddress={address.fillFromPlace}
          />
        </EditSection>

        {visitsLandmarks && (
          <EditSection id="landmarks" title={tourCategory ? "Destinations" : "Landmarks it visits"} data-testid="listing-landmarks">
            <LandmarkPicker value={landmarks} onChange={setLandmarks} near={location} />
          </EditSection>
        )}

        {stayCategory && (
          <>
            <EditSection id="place" title="What guests book" data-testid="listing-stay-place">
              <PlaceTypeChoice values={stay} onChange={setStay} />
            </EditSection>
            <EditSection id="property" title="Property info" data-testid="listing-stay-info">
              <PropertyInfoFields
                values={stay}
                onChange={(values) => {
                  setStay(values);
                  setInfoErrors(undefined);
                }}
                errors={infoErrors}
              />
            </EditSection>
            <EditSection id="amenities" title="Amenities">
              <AmenityChoice values={stay} onChange={setStay} />
            </EditSection>
            <EditSection id="stay-pricing" title="Pricing" data-testid="listing-stay-pricing">
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
            </EditSection>
          </>
        )}

        {tourCategory && (
          <>
            <EditSection id="tour" title="The tour" data-testid="listing-tour-type">
              {listing.tour && !listing.tour.base_price_cents && (
                <p role="status" className="text-sm font-medium text-warning">
                  Set the tour&apos;s details and price: guests don&apos;t see a price for it until you do.
                </p>
              )}
              <TourTypeChoice values={tour} onChange={changeTour} />
            </EditSection>
            <EditSection id="group" title="Group and duration" data-testid="listing-tour-group">
              <TourGroupFields values={tour} onChange={changeTour} errors={tourProblems} />
            </EditSection>
            <EditSection id="inclusions" title="Inclusions" data-testid="listing-tour-inclusions">
              <TourInclusionFields
                values={tour}
                onChange={changeTour}
                errors={tourProblems}
                kinds={options.tour_inclusions}
                extras={extras}
              />
            </EditSection>
            <EditSection id="tour-pricing" title="Pricing" data-testid="listing-tour-pricing">
              <TourPricingFields values={tour} onChange={changeTour} errors={tourProblems} />
            </EditSection>
          </>
        )}

        {vehicleCategory && (
          <EditSection id="vehicle" title="Vehicle details">
            <VehicleFields values={vehicleValues} onChange={setVehicleValues} />
          </EditSection>
        )}

        {fields.length > 0 && (
          <EditSection id="details" title="Details" data-testid="listing-details">
            <AttributeFields fields={fields} values={attrValues} onChange={setAttrValues} />
          </EditSection>
        )}

        <EditSection id="cancellation" title="Cancellation policy">
          <CancellationPolicyChoice policies={options.cancellation_policies} value={policy} onChange={setPolicy} />
        </EditSection>

        {!tourCategory && (
          <EditSection id="units" title="Units">
            <UnitsField bookingType={category?.booking_type} value={units} onChange={setUnits} />
          </EditSection>
        )}

        <EditSection id="photos" title="Photos">
          <p className="text-sm text-muted">New photos and deletions are saved straight away; a new order is saved with the rest.</p>
          {extraPhotos > 0 && (
            <p role="alert" className="text-sm font-medium text-warning" data-testid="listing-photos-over-limit">
              A tour can have at most {photoLimit} photos: delete {extraPhotos} before saving.
            </p>
          )}
          <ListingPhotos
            listingId={listing.id}
            photos={listing.photos}
            limit={photoLimit}
            order={photoOrder}
            onOrderChange={setPhotoOrder}
            onBusyChange={setPhotosBusy}
          />
        </EditSection>

        <Card className="sticky bottom-4 z-10 shadow-float">
          <CardBody pad="sm" className="flex items-center justify-between gap-3">
            <ButtonLink href={listingPath} variant="soft">
              Cancel
            </ButtonLink>
            <Button type="submit" disabled={update.isPending || photosBusy} data-testid="listing-save">
              {update.isPending ? "Saving…" : "Save changes"}
            </Button>
          </CardBody>
        </Card>
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

// One section of the edit page: a white card, so its fields read as they do in the wizard
// rather than straight on the photo, with an id the index above links to.
function EditSection({
  id,
  title,
  children,
  "data-testid": testId,
}: {
  id: string;
  title: string;
  children: ReactNode;
  "data-testid"?: string;
}) {
  return (
    <Card id={id} clip={false} className="scroll-mt-24">
      <CardBody pad="lg">
        <fieldset data-testid={testId} className="flex min-w-0 flex-col gap-4">
          <legend className="mb-2 font-display text-xl font-extrabold tracking-tight">{title}</legend>
          {children}
        </fieldset>
      </CardBody>
    </Card>
  );
}
