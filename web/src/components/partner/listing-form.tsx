"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { PhAddressFields, usePhAddress } from "@/components/address/ph-address-fields";
import { ManagePhotosButton } from "@/components/photos/photo-manager";
import { ActionBar } from "@/components/ui/action-bar";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { SelectField } from "@/components/ui/select-field";
import { TextareaField } from "@/components/ui/textarea-field";
import type { LatLng } from "@/lib/map";
import { BookingModeChoice, type BookingMode } from "./booking-mode";
import { CancellationPolicyChoice, type CancellationPolicy } from "./cancellation-policy";
import { listingChanges } from "./listing-changes";
import {
  addressChanged,
  areaQuery,
  AttributeFields,
  attributeFields,
  categoryLabel,
  descriptionHint,
  LISTING_TEXT,
  geocodeQuery,
  titleExample,
  toAttributeValues,
  toAttrs,
  visitsLandmarks as picksLandmarks,
  type AttributeValues,
} from "./listing-fields";
import { LandmarkPicker } from "./landmark-picker";
import { ListingPhotos, orderedPhotos } from "./listing-photos";
import { STATUS } from "./listing-status";
import {
  ActivityAddOnFields,
  ActivityDropOffFields,
  activityErrors,
  ActivityInclusionFields,
  ActivityOfferFields,
  ActivityRunFields,
  isWaterActivity,
  toActivityBody,
  toActivityValues,
  type ActivityErrors,
  type ActivityValues,
} from "./activity-fields";
import { ListingStatusSection, type StatusMove } from "./listing-status-section";
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
import { FlatPriceField, isFlatPriced, toFlatPriceValue, toFlatRateBody } from "./flat-price-field";
import { includedAmenities, isGear, isVehicle, toVehicleAttrs, toVehicleValues, VehicleFields, type VehicleValues } from "./vehicle-fields";
import {
  toVehiclePricingValues,
  toVehicleRateBody,
  VehiclePricingFields,
  vehiclePricingErrors,
  type VehiclePricingErrors,
  type VehiclePricingValues,
} from "./vehicle-pricing-fields";
import { useChangeListingStatus, useUpdateListing, type ListingBody, type ListingOptions, type PartnerListing } from "./use-partner-listings";
import { StayGuestRules } from "./stay-guest-rules";
import { UNITS_LABEL, UnitsField } from "./units-field";
import { WizardCancel } from "./wizard-cancel";
import { TickGlyph } from "@/components/discovery/tag-glyphs";

// Changing a listing (RAA-47): what it is, where it is, the landmarks a tour or activity
// visits (RAA-70), the details its category asks for (an accommodation's own, RAA-83; a
// vehicle's, RAA-89), an accommodation's or a vehicle's pricing and fees (RAA-105, RAA-150), how guests book it (RAA-133), the cancellation policy
// (RAA-89), how many identical units it has (RAA-99), its photos (RAA-109) and, last, its status
// (RAA-115), picked behind Change status and made by Save after the rest is saved. A tour has
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
  const [flatPrice, setFlatPrice] = useState(() => toFlatPriceValue(listing.flat_rate));
  const [priceErrors, setPriceErrors] = useState<PricingErrors>();
  const [vehicleValues, setVehicleValues] = useState<VehicleValues>(() => toVehicleValues(listing.attrs));
  const [vehiclePricing, setVehiclePricing] = useState<VehiclePricingValues>(() =>
    toVehiclePricingValues(listing.vehicle_rate, listing.fees),
  );
  const [vehiclePriceErrors, setVehiclePriceErrors] = useState<VehiclePricingErrors>();
  const [tour, setTour] = useState<TourValues>(() => toTourValues(listing));
  const [tourProblems, setTourProblems] = useState<TourErrors>();
  // A water activity's details (RAA-272); one moved into a water category starts from its defaults.
  const [activity, setActivity] = useState<ActivityValues>(() =>
    toActivityValues(listing.activity, options.categories.find((option) => option.id === listing.category.id)?.activity_defaults),
  );
  const [activityProblems, setActivityProblems] = useState<ActivityErrors>();
  const [policy, setPolicy] = useState<CancellationPolicy>(listing.cancellation_policy);
  const [bookingMode, setBookingMode] = useState<BookingMode>(listing.booking_mode);
  const [units, setUnits] = useState(listing.units_count);
  const address = usePhAddress(listing.address);
  const [location, setLocation] = useState<LatLng | null>(listing.location);
  const [locationError, setLocationError] = useState<string>();
  const [landmarks, setLandmarks] = useState<PartnerLandmark[]>(listing.landmarks);
  // The edit waiting for the partner to confirm it, and what it changes.
  // What Save will send: the body, whether any of it changed, and every change to list.
  // `saved` once the body is, while a held status is still to go.
  const [pending, setPending] = useState<{ body: ListingBody; edited: boolean; saved?: boolean; changes: string[] }>();
  // Photos are added and deleted at once (RAA-109); only a new order waits for Save.
  const [photoOrder, setPhotoOrder] = useState<number[]>();
  const [photosBusy, setPhotosBusy] = useState(false);
  const [managingPhotos, setManagingPhotos] = useState(false);
  const [stagedStatus, setStagedStatus] = useState<StatusMove>();
  const [choosingStatus, setChoosingStatus] = useState(false);
  const changeStatus = useChangeListingStatus(listing.id);
  // A new category waiting for the partner to confirm that its details are cleared.
  const [nextCategoryId, setNextCategoryId] = useState<string>();
  const formRef = useRef<HTMLFormElement>(null);
  const listingPath = `/partner/listings/${listing.id}`;

  const category = options.categories.find((option) => String(option.id) === categoryId);
  // A saved listing's pin stays where it is until the partner changes the address.
  const addressQuery = addressChanged(address, listing.address) ? geocodeQuery(address) : undefined;
  const stayCategory = isStay(category);
  const vehicleCategory = isVehicle(category);
  const gearCategory = isGear(category);
  // Vehicles and gear share a daily rate; a transfer has one flat price (RAA-191).
  const rentalCategory = vehicleCategory || gearCategory;
  const flatCategory = isFlatPriced(category);
  const tourCategory = isTour(category);
  const waterCategory = isWaterActivity(category);
  const fields = stayCategory || vehicleCategory || tourCategory || waterCategory ? [] : attributeFields(category);
  const extras = tourExtras(category);
  // Made a tour here, the listing takes a tour's photos before it is saved as one.
  const photoLimit = tourCategory && !listing.tour ? TOUR_PHOTO_LIMIT : listing.photo_limit;
  const extraPhotos = uploadedPhotos(listing.photos).length - photoLimit;
  const changeTour = (values: TourValues) => {
    setTour(values);
    setTourProblems(undefined);
  };
  const changeActivity = (values: ActivityValues) => {
    setActivity(values);
    setActivityProblems(undefined);
  };
  // A vehicle keeps the attrs the form doesn't show (a plate number) while it stays a vehicle.
  const savedAsVehicle = isVehicle(options.categories.find((option) => option.id === listing.category.id));
  // Changing to a category that doesn't visit landmarks (not a tour) drops them when saved.
  const visitsLandmarks = picksLandmarks(category);

  // What saving the form as it stands would send; undefined without a pin.
  function toBody(form: HTMLFormElement): ListingBody | undefined {
    if (!location) return undefined;
    const values = new FormData(form);
    return {
      title: String(values.get("title") ?? ""),
      description: String(values.get("description") ?? ""),
      business_id: Number(businessId),
      category_id: Number(categoryId),
      address: address.toBody(),
      location,
      attrs: stayCategory
        ? toStayAttrs(stay)
        : vehicleCategory
          ? toVehicleAttrs(vehicleValues, savedAsVehicle ? listing.attrs : {}, category?.slug)
          : toAttrs(fields, attrValues),
      cancellation_policy: policy,
      booking_mode: bookingMode,
      // A tour has no units: groups a day stand in for them (RAA-111).
      units_count: tourCategory ? 1 : units,
      landmark_ids: visitsLandmarks ? landmarks.map((landmark) => landmark.id) : [],
      // Accommodation is priced by the night, a rental by the day (RAA-150) and a tour by its
      // own price (RAA-111); other categories' fees, gear's too, aren't edited here yet.
      ...(stayCategory
        ? { stay_rate: toStayRateBody(pricing, stay.placeType, stay.guests), fees: toFeesBody(pricing) }
        : {}),
      ...(rentalCategory ? { vehicle_rate: toVehicleRateBody(vehiclePricing, category?.slug, gearCategory) } : {}),
      ...(vehicleCategory ? { fees: toFeesBody(vehiclePricing) } : {}),
      ...(flatCategory && flatPrice ? { flat_rate: toFlatRateBody(flatPrice) } : {}),
      ...(tourCategory ? toTourListingBody(tour, extras) : {}),
      ...(waterCategory ? { activity: toActivityBody(activity) } : {}),
      // Sent only once moved: a body's photos deletes any photo it leaves out.
      ...(photoOrder ? { photos: orderedPhotos(listing.photos, photoOrder).map((photo) => photo.id) } : {}),
    };
  }

  // Whether leaving now would lose an edit (photos added or deleted are saved already).
  function unsaved() {
    const body = formRef.current ? toBody(formRef.current) : undefined;
    return !body || listingChanges(listing, body).length > 0 || stagedStatus !== undefined;
  }

  // The details the current category asks for, once the partner has filled any in.
  const detailsEntered =
    Object.keys(toAttrs(fields, attrValues)).length > 0 ||
    (stayCategory && JSON.stringify(stay) !== JSON.stringify(toStayValues({}))) ||
    (vehicleCategory && JSON.stringify(vehicleValues) !== JSON.stringify(toVehicleValues({})));

  function changeCategory(id: string) {
    setCategoryId(id);
    setAttrValues({});
    setStay(toStayValues({}));
    setVehicleValues(toVehicleValues({}));
    // Another water activity starts from its own defaults; the saved one's come back with it.
    const next = options.categories.find((option) => String(option.id) === id);
    setActivity(toActivityValues(next?.id === listing.category.id ? listing.activity : null, next?.activity_defaults));
    setActivityProblems(undefined);
    setNextCategoryId(undefined);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = toBody(event.currentTarget);
    if (!body) {
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
    const rentalProblems = rentalCategory && vehiclePricingErrors(vehiclePricing, includedAmenities(vehicleValues, category?.slug), gearCategory);
    if (rentalProblems) {
      setVehiclePriceErrors(rentalProblems);
      return;
    }
    if (tourCategory && tourErrors(tour)) {
      setTourProblems(tourErrors(tour));
      return;
    }
    if (waterCategory && activityErrors(activity)) {
      setActivityProblems(activityErrors(activity));
      return;
    }
    const changes = listingChanges(listing, body);
    const statusChange = stagedStatus && `Status: ${STATUS[listing.status].label} → ${STATUS[stagedStatus].label}`;
    changeStatus.reset();
    setPending({ body, edited: changes.length > 0, changes: statusChange ? [...changes, statusChange] : changes });
  }

  // The listing first, then a held status, so going live is checked against what was just
  // saved. A status the API refuses keeps the dialog open on why; the rest is saved by then.
  async function confirmEdit() {
    if (!pending) return;
    try {
      if (pending.edited) {
        await update.mutateAsync(pending.body);
        setPending({ ...pending, edited: false, saved: true });
      }
    } catch {
      setPending(undefined);
      return;
    }
    try {
      if (stagedStatus) await changeStatus.mutateAsync(stagedStatus);
      setStagedStatus(undefined);
      router.push(listingPath);
    } catch {
      // changeStatus.error says why, in the dialog.
    }
  }
  const saving = update.isPending || changeStatus.isPending;

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
    ...(waterCategory
      ? [
          { id: "runs", label: "How it runs" },
          { id: "rates", label: "Rates" },
          { id: "inclusions", label: "Inclusions" },
          { id: "add-ons", label: "Add-ons" },
          { id: "drop-off", label: "Drop-off" },
        ]
      : []),
    ...(vehicleCategory ? [{ id: "vehicle", label: "Vehicle details" }] : []),
    ...(rentalCategory ? [{ id: "vehicle-pricing", label: "Pricing" }] : []),
    ...(fields.length > 0 ? [{ id: "details", label: "Details" }] : []),
    { id: "cancellation", label: "Cancellation policy" },
    { id: "booking", label: "Booking" },
    ...(!tourCategory ? [{ id: "units", label: UNITS_LABEL }] : []),
    { id: "photos", label: "Photos" },
    { id: "status", label: "Status" },
  ];

  const current = useCurrentSection(sections.map((section) => section.id));

  return (
    <form
      ref={formRef}
      data-testid="listing-form"
      onSubmit={onSubmit}
      className="flex flex-col gap-6 lg:grid lg:grid-cols-[13rem_minmax(0,42rem)] lg:items-start lg:gap-10"
    >
      <nav aria-label="Sections" className="lg:sticky lg:top-(--chrome)">
        <ol className="flex flex-wrap gap-2 lg:flex-col lg:flex-nowrap lg:gap-1">
          {sections.map((section) => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                aria-current={section.id === current ? "location" : undefined}
                className={cn(
                  "flex rounded-full border border-line bg-surface-2 px-3 py-2 text-sm whitespace-nowrap transition-colors duration-200 ease-calm hover:bg-mist",
                  "lg:border-transparent lg:bg-transparent",
                  "aria-[current=location]:bg-mist aria-[current=location]:font-semibold aria-[current=location]:text-primary",
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
          <div role="alert" className="rounded-card bg-danger-tint px-5 py-4 text-sm font-semibold text-danger">
            {update.error.message}
          </div>
        )}
        {tourProblems && (
          <div role="alert" className="rounded-card bg-danger-tint px-5 py-4 text-sm font-semibold text-danger">
            Check the tour&apos;s details: the sections below say what&apos;s missing.
          </div>
        )}
        {activityProblems && (
          <div role="alert" className="rounded-card bg-danger-tint px-5 py-4 text-sm font-semibold text-danger">
            Check the activity&apos;s details: the sections below say what&apos;s missing.
          </div>
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
              if (detailsEntered) setNextCategoryId(event.target.value);
              else changeCategory(event.target.value);
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
            minLength={LISTING_TEXT.titleMin}
            maxLength={LISTING_TEXT.titleMax}
            counter={LISTING_TEXT.titleMax}
            defaultValue={listing.title}
            placeholder={`e.g. ${titleExample(category)}`}
          />
          <TextareaField
            label="Description"
            name="description"
            maxLength={LISTING_TEXT.descriptionMax}
            counter={LISTING_TEXT.descriptionMax}
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
            {tourCategory && <p className="text-sm text-muted">A tour needs at least two to go live.</p>}
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

        {waterCategory && (
          <>
            <EditSection id="runs" title="How it runs" data-testid="listing-activity-runs">
              {!listing.activity?.offers.length && (
                <p role="status" className="text-sm font-medium text-warning">
                  Set its rates: guests don&apos;t see a price for it until you do.
                </p>
              )}
              <ActivityRunFields values={activity} onChange={changeActivity} errors={activityProblems} />
            </EditSection>
            <EditSection id="rates" title="Rates" data-testid="listing-activity-rates">
              <ActivityOfferFields values={activity} onChange={changeActivity} errors={activityProblems} />
            </EditSection>
            <EditSection id="inclusions" title="Inclusions" data-testid="listing-activity-inclusions">
              <ActivityInclusionFields
                values={activity}
                onChange={changeActivity}
                errors={activityProblems}
                kinds={options.activity_inclusions}
              />
            </EditSection>
            <EditSection id="add-ons" title="Add-ons" data-testid="listing-activity-add-ons">
              <ActivityAddOnFields
                values={activity}
                onChange={changeActivity}
                errors={activityProblems}
                kinds={options.activity_add_ons}
                chargedPer={options.activity_add_on_charged_per}
              />
            </EditSection>
            <EditSection id="drop-off" title="Drop-off" data-testid="listing-activity-drop-off">
              <ActivityDropOffFields values={activity} onChange={changeActivity} errors={activityProblems} location={location} />
            </EditSection>
          </>
        )}

        {vehicleCategory && (
          <EditSection id="vehicle" title="Vehicle details">
            <VehicleFields values={vehicleValues} onChange={setVehicleValues} slug={category?.slug} />
          </EditSection>
        )}

        {rentalCategory && (
          <EditSection id="vehicle-pricing" title="Pricing" data-testid="listing-vehicle-pricing">
            {!listing.vehicle_rate?.daily_price_cents && (
              <p role="status" className="text-sm font-medium text-warning">
                Set a daily price: guests don&apos;t see a price for this {gearCategory ? "item" : "vehicle"} until you do.
              </p>
            )}
            <VehiclePricingFields
              location={location}
              values={vehiclePricing}
              onChange={(values) => {
                setVehiclePricing(values);
                setVehiclePriceErrors(undefined);
              }}
              errors={vehiclePriceErrors}
              included={includedAmenities(vehicleValues, category?.slug)}
              slug={category?.slug}
              gear={gearCategory}
            />
          </EditSection>
        )}

        {flatCategory && (
          <EditSection id="flat-pricing" title="Pricing" data-testid="listing-flat-pricing">
            {!listing.flat_rate?.price_cents && (
              <p role="status" className="text-sm font-medium text-warning">
                Set a price: guests don&apos;t see one until you do.
              </p>
            )}
            <FlatPriceField value={flatPrice} onChange={setFlatPrice} />
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

        <EditSection id="booking" title="Booking">
          <BookingModeChoice modes={options.booking_modes} value={bookingMode} onChange={setBookingMode} />
        </EditSection>

        {!tourCategory && (
          <EditSection id="units" title={UNITS_LABEL}>
            <UnitsField bookingType={category?.booking_type} water={waterCategory} value={units} onChange={setUnits} />
            {stayCategory && <StayGuestRules values={stay} onChange={setStay} units={units} fees={pricing.fees} />}
          </EditSection>
        )}

        <EditSection
          id="photos"
          title="Photos"
          action={
            <ManagePhotosButton
              count={uploadedPhotos(listing.photos).length}
              onClick={() => setManagingPhotos(true)}
              testId="listing-photos-manage"
            />
          }
        >
          <p className="text-sm text-muted">Photos added or deleted in Manage photos are saved there; a new order is saved with the rest.</p>
          {extraPhotos > 0 && (
            <p role="alert" className="text-sm font-medium text-warning" data-testid="listing-photos-over-limit">
              A tour can have at most {photoLimit} photos: delete {extraPhotos} before saving.
            </p>
          )}
          <ListingPhotos
            listingId={listing.id}
            name={listing.title}
            photos={listing.photos}
            limit={photoLimit}
            order={photoOrder}
            onOrderChange={setPhotoOrder}
            onBusyChange={setPhotosBusy}
            managing={managingPhotos}
            onManagingChange={setManagingPhotos}
          />
        </EditSection>

        <EditSection
          id="status"
          title="Status"
          action={
            <Button type="button" size="sm" variant="soft" onClick={() => setChoosingStatus(true)} data-testid="listing-change-status">
              Change status
            </Button>
          }
        >
          <ListingStatusSection
            listing={listing}
            editable
            staged={stagedStatus}
            onStage={setStagedStatus}
            choosing={choosingStatus}
            onChoosingChange={setChoosingStatus}
          />
        </EditSection>

        <ActionBar>
          <WizardCancel
            href={listingPath}
            dirty={unsaved}
            variant="glass"
            size="pill"
            title="Discard your changes?"
            message="Your edits won't be saved. Photos you added or deleted stay as they are."
          />
          <Button
            type="submit"
            variant="glow"
            size="pill"
            disabled={saving || photosBusy}
            data-testid="listing-save"
          >
            {!saving && <TickGlyph className="size-4.5" />}
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </ActionBar>
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
              onClick={() => void confirmEdit()}
              disabled={!pending?.changes.length || saving}
              data-testid="listing-save-confirm-button"
            >
              {saving ? "Saving…" : "Save changes"}
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
            {changeStatus.error && (
              <p role="alert" className="text-danger" data-testid="listing-status-error">
                {pending.saved ? "Your other changes are saved, but the status didn't change: " : "The status didn't change: "}
                {changeStatus.error.message}
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted">Nothing has changed yet.</p>
        )}
      </Dialog>

      <Dialog
        open={nextCategoryId !== undefined}
        onClose={() => setNextCategoryId(undefined)}
        title="Change the category?"
        data-testid="listing-category-confirm"
        actions={
          <>
            <Button type="button" variant="soft" onClick={() => setNextCategoryId(undefined)}>
              Keep {category?.name ?? "it"}
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={() => nextCategoryId !== undefined && changeCategory(nextCategoryId)}
              data-testid="listing-category-confirm-button"
            >
              Change and clear
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          The {category ? categoryLabel(category) : "current"} details you&apos;ve filled in are cleared, and the new
          category asks for its own.
        </p>
      </Dialog>
    </form>
  );
}

// One section of the edit page: a white card, so its fields read as they do in the wizard
// rather than straight on the photo, with an id the index above links to. An `action` (a
// button that opens a sheet) sits at the right of the title; a legend can't share a row, so
// the visible title is its own heading and the legend is for screen readers.
function EditSection({
  id,
  title,
  action,
  children,
  "data-testid": testId,
}: {
  id: string;
  title: string;
  action?: ReactNode;
  children: ReactNode;
  "data-testid"?: string;
}) {
  return (
    <Card id={id} clip={false} className="scroll-mt-24">
      <CardBody pad="lg">
        <fieldset data-testid={testId} className="flex min-w-0 flex-col gap-4">
          {action ? (
            <>
              <legend className="sr-only">{title}</legend>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                <h2 aria-hidden className="font-display text-xl font-extrabold tracking-tight">
                  {title}
                </h2>
                {action}
              </div>
            </>
          ) : (
            <legend className="mb-2 font-display text-xl font-extrabold tracking-tight">{title}</legend>
          )}
          {children}
        </fieldset>
      </CardBody>
    </Card>
  );
}

// The section in view, for the index to mark as you scroll: the last one whose top has passed
// just under the sticky header, or the last of all once the page is scrolled to the bottom.
function useCurrentSection(ids: string[]) {
  const [current, setCurrent] = useState(ids[0]);
  const key = ids.join(" ");

  useEffect(() => {
    const sectionIds = key.split(" ");
    let frame = 0;
    function update() {
      frame = 0;
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      if (atBottom) return setCurrent(sectionIds[sectionIds.length - 1]);
      let found = sectionIds[0];
      for (const id of sectionIds) {
        const top = document.getElementById(id)?.getBoundingClientRect().top;
        if (top !== undefined && top <= window.innerHeight * 0.45) found = id;
      }
      setCurrent(found);
    }
    function onScroll() {
      if (!frame) frame = requestAnimationFrame(update);
    }
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [key]);

  return current;
}
