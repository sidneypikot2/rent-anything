"use client";

import type { components } from "@/api/schema";
import { Button } from "@/components/ui/button";
import { CheckboxField } from "@/components/ui/checkbox-field";
import { ChoiceCards } from "@/components/ui/choice-cards";
import { Field } from "@/components/ui/field";
import { SelectField } from "@/components/ui/select-field";
import { StepperField } from "@/components/ui/stepper-field";
import { TextareaField } from "@/components/ui/textarea-field";
import type { LatLng } from "@/lib/map";
import { formatPeso, fromCents, toCents } from "@/lib/money";
import { HALF_HOURS, TimesListField, timeText } from "./time-fields";
import { DeliveryZoneFields, FIRST_ZONE, toZoneValues, zoneBody, zonesError, type ZoneValues } from "./delivery-zones-field";
import { PricingSection } from "./pricing-section";
import type { ListingCategory, ListingOptions } from "./use-partner-listings";

type PartnerActivity = components["schemas"]["partner_activity"];
type ActivityBody = components["schemas"]["activity_body"];
type SoldBy = ActivityBody["sold_by"];
type Schedule = ActivityBody["schedule"];
export type ActivityInclusionKind = NonNullable<ActivityBody["inclusions"]>[number];
type AddOnBody = NonNullable<ActivityBody["add_ons"]>[number];
type AddOnKind = AddOnBody["kind"];
type ChargedPer = AddOnBody["charged_per"];

// The fixed lists a water activity picks from (RAA-271), from listing_options.
export type ActivityCatalogues = {
  inclusions: ListingOptions["activity_inclusions"];
  addOns: ListingOptions["activity_add_ons"];
  chargedPer: ListingOptions["activity_add_on_charged_per"];
};

export function activityCatalogues(options: ListingOptions): ActivityCatalogues {
  return { inclusions: options.activity_inclusions, addOns: options.activity_add_ons, chargedPer: options.activity_add_on_charged_per };
}

// The API's limits (ActivityDetail, ActivityOffer, Listings::ActivityValues).
export const MAX_SEATS = 100;
const MAX_DEPARTURES = 24;
const MAX_OFFERS = 10;
const TEXT_MAX = 500;
const DURATION = { min: 5, max: 720 };
// The lengths a rate can pick, in minutes (any step of 5 from 5 to 720 is valid).
const LENGTHS = [10, 15, 20, 30, 45, 60, 90, 120, 180, 240, 300, 360, 480, 720];

// A water activity (RAA-268): the API sends its builder defaults only for these.
export function isWaterActivity(category: Pick<ListingCategory, "activity_defaults"> | undefined) {
  return category?.activity_defaults != null;
}

export { timeText };

const minutesOf = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));

// "15 minutes", "1 hour", "1 hour 30 minutes".
export function lengthText(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const parts = [hours ? `${hours} ${hours === 1 ? "hour" : "hours"}` : "", rest ? `${rest} minutes` : ""];
  return parts.filter(Boolean).join(" ");
}

// One rate as typed: its length in minutes and its price as text; `riders` null means up to the
// seats on one unit. `id` is the saved offer it changes. A rate has no name of its own: the API's
// is its length ("30 minutes").
export type OfferValues = { id?: number; minutes: string; price: string; riders: number | null };
type AddOnValues = { kind: AddOnKind; price: string; chargedPer: ChargedPer };

// A water activity as the form holds it (RAA-272). Text kept under a switch that's off (a
// minimum age, drop-off zones) comes back when it is switched on.
export type ActivityValues = {
  soldBy: SoldBy;
  schedule: Schedule;
  opensAt: string;
  closesAt: string;
  departures: string[];
  seats: number;
  minAgeOn: boolean;
  minAge: number;
  requirements: string;
  offers: OfferValues[];
  inclusions: ActivityInclusionKind[];
  included: string;
  addOns: AddOnValues[];
  dropOff: boolean;
  zones: ZoneValues[];
};


// The category's builder defaults (activity_body without prices), read defensively: the team
// sets them.
type Defaults = Partial<Omit<ActivityBody, "offers">> & {
  offers?: { name?: string; duration_minutes?: number; max_guests?: number | null }[];
};

export function newActivityValues(defaults: ListingCategory["activity_defaults"] | undefined): ActivityValues {
  const d = (defaults ?? {}) as Defaults;
  const offers = (d.offers ?? []).map((offer) => ({
    minutes: String(offer.duration_minutes ?? 60),
    price: "",
    riders: offer.max_guests ?? null,
  }));
  return {
    soldBy: d.sold_by ?? "unit",
    schedule: d.schedule ?? "open_hours",
    opensAt: d.opens_at ?? "08:00",
    closesAt: d.closes_at ?? "17:00",
    departures: d.departure_times?.length ? d.departure_times : ["09:00"],
    seats: d.seats_per_unit ?? 1,
    minAgeOn: d.min_age != null,
    minAge: d.min_age ?? 12,
    requirements: d.requirements ?? "",
    offers: offers.length ? offers : [{ minutes: "60", price: "", riders: null }],
    inclusions: d.inclusions ?? [],
    included: d.included ?? "",
    addOns: [],
    dropOff: false,
    zones: [FIRST_ZONE],
  };
}

// A saved activity as the form holds it; one with none yet (a listing moved into a water
// category) starts from the category's defaults.
export function toActivityValues(activity: PartnerActivity | null, defaults: ListingCategory["activity_defaults"] | undefined): ActivityValues {
  if (!activity) return newActivityValues(defaults);
  return {
    soldBy: activity.sold_by,
    schedule: activity.schedule,
    opensAt: activity.opens_at ?? "08:00",
    closesAt: activity.closes_at ?? "17:00",
    departures: activity.departure_times.length ? activity.departure_times : ["09:00"],
    seats: activity.seats_per_unit,
    minAgeOn: activity.min_age != null,
    minAge: activity.min_age ?? 12,
    requirements: activity.requirements ?? "",
    offers: activity.offers.map((offer) => ({
      id: offer.id,
      minutes: String(offer.duration_minutes),
      price: fromCents(offer.price_cents),
      riders: offer.max_guests,
    })),
    inclusions: activity.inclusions,
    included: activity.included ?? "",
    addOns: activity.add_ons.map((addOn) => ({ kind: addOn.kind, price: fromCents(addOn.price_cents), chargedPer: addOn.charged_per })),
    dropOff: activity.delivery_zones.length > 0,
    zones: activity.delivery_zones.length ? toZoneValues(activity.delivery_zones) : [FIRST_ZONE],
  };
}

// What the API takes. Call it after activityErrors has passed.
export function toActivityBody(values: ActivityValues): ActivityBody {
  const openHours = values.schedule === "open_hours";
  return {
    sold_by: values.soldBy,
    schedule: values.schedule,
    ...(openHours
      ? { opens_at: values.opensAt, closes_at: values.closesAt }
      : { departure_times: [...new Set(values.departures)].sort() }),
    seats_per_unit: values.seats,
    min_age: values.minAgeOn ? values.minAge : null,
    included: values.included.trim() || null,
    requirements: values.requirements.trim() || null,
    offers: values.offers.map((offer) => ({
      ...(offer.id ? { id: offer.id } : {}),
      name: lengthText(Number(offer.minutes)),
      duration_minutes: Number(offer.minutes),
      price_cents: toCents(offer.price) ?? 0,
      // Riders taking turns are a unit's; sold by the seat, each guest has their own.
      max_guests: values.soldBy === "unit" ? offer.riders : null,
    })),
    inclusions: values.inclusions,
    add_ons: values.addOns.map((addOn) => ({ kind: addOn.kind, price_cents: toCents(addOn.price) ?? 0, charged_per: addOn.chargedPer })),
    delivery_zones: values.dropOff ? zoneBody(values.zones) : [],
  };
}

export type ActivityErrors = Partial<
  Record<"hours" | "departures" | "minAge" | "requirements" | "offers" | "included" | "addOns" | "zones", string>
>;

// The steps of the wizard (and sections of the edit page) each error belongs to.
export const ACTIVITY_SECTIONS = {
  runs: ["hours", "departures", "minAge", "requirements"],
  pricing: ["offers", "zones", "addOns"],
  inclusions: ["included"],
} as const satisfies Record<string, (keyof ActivityErrors)[]>;

export type ActivitySection = keyof typeof ACTIVITY_SECTIONS;

// What the activity still needs, or undefined; `section` checks just that one. The same rules
// as Listings::ActivityValues, so a mistake shows here rather than as a 422.
export function activityErrors(values: ActivityValues, section?: ActivitySection): ActivityErrors | undefined {
  const errors: ActivityErrors = {};
  const openHours = values.schedule === "open_hours";
  if (openHours && values.opensAt >= values.closesAt) errors.hours = "Closing must be after opening";
  if (!openHours && (values.departures.length < 1 || values.departures.length > MAX_DEPARTURES)) {
    errors.departures = `From 1 to ${MAX_DEPARTURES} departures`;
  }
  if (values.requirements.trim().length > TEXT_MAX) errors.requirements = `At most ${TEXT_MAX} characters`;
  if (values.included.trim().length > TEXT_MAX) errors.included = `At most ${TEXT_MAX} characters`;
  errors.offers = offersError(values);

  if (values.addOns.some((addOn) => !toCents(addOn.price))) errors.addOns = "Set a price above ₱0 for each add-on, or remove it";
  if (values.dropOff) errors.zones = zonesError(values.zones);

  const keys: readonly (keyof ActivityErrors)[] = section ? ACTIVITY_SECTIONS[section] : (Object.keys(errors) as (keyof ActivityErrors)[]);
  const found: ActivityErrors = {};
  for (const key of keys) if (errors[key]) found[key] = errors[key];
  return Object.keys(found).length > 0 ? found : undefined;
}

function offersError(values: ActivityValues): string | undefined {
  const { offers } = values;
  if (offers.length < 1) return "Add at least one rate";
  if (offers.length > MAX_OFFERS) return `At most ${MAX_OFFERS} rates`;
  const lengths = new Set<number>();
  const open = values.schedule === "open_hours" ? minutesOf(values.closesAt) - minutesOf(values.opensAt) : null;
  for (const offer of offers) {
    const minutes = Number(offer.minutes);
    if (!Number.isInteger(minutes) || minutes < DURATION.min || minutes > DURATION.max || minutes % 5 !== 0) {
      return `A rate's length must be ${DURATION.min} to ${DURATION.max} minutes, in steps of 5`;
    }
    const which = `The ${lengthText(minutes)} rate`;
    if (lengths.has(minutes)) return `Two rates are ${lengthText(minutes)}: give each a different length`;
    lengths.add(minutes);
    if (open !== null && open > 0 && minutes > open) return `${which} is longer than your open hours`;
    if (!toCents(offer.price)) return `${which}: set a price above ₱0`;
  }
  return undefined;
}

type SectionProps = {
  values: ActivityValues;
  onChange: (values: ActivityValues) => void;
  errors?: ActivityErrors;
};

// How it is sold and when it runs (RAA-270). A jet ski's seats are asked with the jet ski
// itself (RAA-273), so `seats={false}` leaves them out here.
export function ActivityRunFields({ values, onChange, errors, seats = true }: SectionProps & { seats?: boolean }) {
  const set = (patch: Partial<ActivityValues>) => onChange({ ...values, ...patch });
  const perUnit = values.soldBy === "unit";
  return (
    <div data-testid="activity-runs" className="flex flex-col gap-6">
      <ChoiceCards
        legend="How do guests book it?"
        name="sold_by"
        value={values.soldBy}
        onChange={(soldBy) => set({ soldBy: soldBy as SoldBy })}
        choices={[
          { value: "unit", label: "Per unit", description: "A party gets a jet ski, kayak or boat to themselves" },
          { value: "person", label: "Per person", description: "Guests buy seats on a shared boat or session" },
        ]}
        data-testid="activity-sold-by"
      />
      <ChoiceCards
        legend="When does it run?"
        name="schedule"
        value={values.schedule}
        onChange={(schedule) => set({ schedule: schedule as Schedule })}
        choices={[
          { value: "open_hours", label: "Open hours", description: "Guests start at any half hour while you're open" },
          { value: "departures", label: "Set departures", description: "It leaves at fixed times" },
        ]}
        data-testid="activity-schedule"
      />
      {values.schedule === "open_hours" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Opens"
            name="opens_at"
            options={HALF_HOURS}
            value={values.opensAt}
            onChange={(event) => set({ opensAt: event.target.value })}
            data-testid="activity-opens-at"
          />
          <SelectField
            label="Closes"
            name="closes_at"
            options={HALF_HOURS}
            value={values.closesAt}
            onChange={(event) => set({ closesAt: event.target.value })}
            error={errors?.hours}
            data-testid="activity-closes-at"
          />
        </div>
      ) : (
        <TimesListField
          times={values.departures}
          onChange={(departures) => set({ departures })}
          itemLabel="Departure"
          addLabel="Add a departure"
          max={MAX_DEPARTURES}
          min={1}
          error={errors?.departures}
          testId="activity-departures"
        />
      )}
      {seats && (
        <StepperField
          label={perUnit ? "Most guests on one" : "Seats on each"}
          hint={perUnit ? "On one jet ski, kayak or boat at a time" : "How many guests one session or boat takes"}
          value={values.seats}
          onChange={(count) => set({ seats: count })}
          min={1}
          max={MAX_SEATS}
          data-testid="activity-seats"
        />
      )}
      <div className="flex flex-col gap-2">
        <CheckboxField
          label="Guests must be a minimum age"
          checked={values.minAgeOn}
          onChange={(event) => set({ minAgeOn: event.currentTarget.checked })}
          data-testid="activity-min-age-on"
        />
        {values.minAgeOn && (
          <StepperField label="Minimum age" value={values.minAge} onChange={(minAge) => set({ minAge })} min={1} max={99} data-testid="activity-min-age" />
        )}
      </div>
      <TextareaField
        label="What guests need (optional)"
        name="requirements"
        rows={2}
        maxLength={TEXT_MAX}
        counter={TEXT_MAX}
        value={values.requirements}
        onChange={(event) => set({ requirements: event.target.value })}
        error={errors?.requirements}
        placeholder="e.g. Can swim, a valid ID for the driver"
      />
    </div>
  );
}

// The lengths to pick from, with a saved one that isn't in the list kept as an option.
function lengthOptions(current: string) {
  const minutes = Number(current);
  const lengths = LENGTHS.includes(minutes) || !minutes ? LENGTHS : [...LENGTHS, minutes].sort((a, b) => a - b);
  return lengths.map((length) => ({ value: String(length), label: lengthText(length) }));
}

// A water activity's pricing (RAA-272), laid out as a vehicle rental's: its rates (a length, a
// price and, per unit, the riders on it), drop-off and shop pick-up, and add-ons from the fixed
// list, added like a vehicle's common fees.
export function ActivityPricingFields({
  values,
  onChange,
  errors,
  location,
  addOnKinds,
  chargedPer,
}: SectionProps & {
  location?: LatLng | null;
  addOnKinds: ActivityCatalogues["addOns"];
  chargedPer: ActivityCatalogues["chargedPer"];
}) {
  const perUnit = values.soldBy === "unit";
  const set = (patch: Partial<ActivityValues>) => onChange({ ...values, ...patch });
  const setOffer = (index: number, patch: Partial<OfferValues>) =>
    set({ offers: values.offers.map((offer, at) => (at === index ? { ...offer, ...patch } : offer)) });
  const setAddOn = (kind: AddOnKind, patch: Partial<AddOnValues>) =>
    set({ addOns: values.addOns.map((addOn) => (addOn.kind === kind ? { ...addOn, ...patch } : addOn)) });
  const used = new Set(values.offers.map((offer) => Number(offer.minutes)));
  const nextLength = LENGTHS.find((length) => !used.has(length)) ?? 60;
  const addOnName = (kind: AddOnKind) => addOnKinds.find((option) => option.kind === kind)?.name ?? kind;
  const perOptions = chargedPer.map((option) => ({ value: option.value, label: option.name }));
  const presets = addOnKinds.filter((option) => !values.addOns.some((addOn) => addOn.kind === option.kind));

  return (
    <div data-testid="activity-pricing" className="flex flex-col">
      <PricingSection
        title="Rates"
        intro={`What guests pick: a length and its price, ${perUnit ? "for one unit and the riders on it" : "for each guest"}.`}
        data-testid="activity-offers"
      >
        {values.offers.map((offer, index) => (
          <div key={offer.id ?? `new-${index}`} className="flex flex-col gap-3 rounded-control border border-line p-4" data-testid="activity-offer">
            <div className="grid gap-3 sm:grid-cols-2">
              <SelectField
                label="Length"
                options={lengthOptions(offer.minutes)}
                value={offer.minutes}
                onChange={(event) => setOffer(index, { minutes: event.target.value })}
                data-testid="activity-offer-minutes"
              />
              <Field
                label={perUnit ? "Price per unit (₱)" : "Price per guest (₱)"}
                type="number"
                min={0.01}
                step="0.01"
                inputMode="decimal"
                value={offer.price}
                onChange={(event) => setOffer(index, { price: event.target.value })}
                data-testid="activity-offer-price"
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              {perUnit ? (
                <div className="min-w-0 flex-1">
                  <StepperField
                    label={`Up to ${offer.riders ?? values.seats} riders`}
                    hint="Who may share or take turns on one unit"
                    value={offer.riders ?? values.seats}
                    onChange={(riders) => setOffer(index, { riders })}
                    min={1}
                    max={MAX_SEATS}
                    data-testid="activity-offer-riders"
                  />
                </div>
              ) : (
                <span />
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={values.offers.length === 1}
                onClick={() => set({ offers: values.offers.filter((_, at) => at !== index) })}
                data-testid="activity-offer-remove"
              >
                Remove
              </Button>
            </div>
          </div>
        ))}
        {errors?.offers && (
          <p role="alert" className="text-sm font-semibold text-danger">
            {errors.offers}
          </p>
        )}
        {values.offers.length < MAX_OFFERS && (
          <Button
            type="button"
            variant="soft"
            size="sm"
            className="self-start"
            onClick={() => set({ offers: [...values.offers, { minutes: String(nextLength), price: "", riders: null }] })}
            data-testid="activity-offer-add"
          >
            Add a rate
          </Button>
        )}
      </PricingSection>

      <PricingSection
        title="Drop-off and pick-up"
        intro="Guests come to your shop, or you bring it to their beach or a spot they pick, priced by how far it is from your pin."
        data-testid="activity-drop-off"
      >
        <div className="flex flex-col gap-2">
          <CheckboxField label="Guests pick it up at your shop" aside="Always offered" checked disabled readOnly />
          <CheckboxField
            label="Drop it off at the guest's beach or spot"
            checked={values.dropOff}
            onChange={(event) => set({ dropOff: event.currentTarget.checked })}
            data-testid="activity-drop-off-on"
          />
        </div>
        {values.dropOff && (
          <DeliveryZoneFields
            zones={values.zones}
            onChange={(zones) => set({ zones })}
            error={errors?.zones}
            location={location}
            feeLabel="Fee (₱)"
            beyond="drop-off"
          />
        )}
      </PricingSection>

      <PricingSection title="Add-ons" intro="Extras guests can choose when they book." data-testid="activity-add-ons">
        {values.addOns.map((addOn) => (
          <div
            key={addOn.kind}
            className="flex flex-col gap-3 rounded-control border border-line p-4"
            data-testid={`activity-add-on-${addOn.kind}`}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold">{addOnName(addOn.kind)}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => set({ addOns: values.addOns.filter((other) => other.kind !== addOn.kind) })}
              >
                Remove
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Amount (₱)"
                type="number"
                min={0.01}
                step="0.01"
                inputMode="decimal"
                value={addOn.price}
                onChange={(event) => setAddOn(addOn.kind, { price: event.target.value })}
                data-testid="activity-add-on-price"
              />
              <SelectField
                label="Charged"
                options={perOptions}
                value={addOn.chargedPer}
                onChange={(event) => setAddOn(addOn.kind, { chargedPer: event.target.value as ChargedPer })}
                data-testid="activity-add-on-per"
              />
            </div>
          </div>
        ))}
        {errors?.addOns && (
          <p role="alert" className="text-sm font-semibold text-danger">
            {errors.addOns}
          </p>
        )}
        {presets.length > 0 && (
          <div className="flex flex-col gap-2" data-testid="activity-add-on-presets">
            <span className="text-xs text-muted">Common add-ons:</span>
            <div className="flex flex-wrap gap-2">
              {presets.map((option) => (
                <Button
                  key={option.kind}
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => set({ addOns: [...values.addOns, { kind: option.kind, price: "", chargedPer: "booking" }] })}
                  data-testid={`activity-add-on-preset-${option.kind}`}
                >
                  + {option.name}
                </Button>
              ))}
            </div>
          </div>
        )}
      </PricingSection>
    </div>
  );
}

// What comes with it (RAA-271), from the fixed list, and anything else as a note.
export function ActivityInclusionFields({ values, onChange, errors, kinds }: SectionProps & { kinds: ActivityCatalogues["inclusions"] }) {
  const toggle = (kind: ActivityInclusionKind, on: boolean) => {
    const picked = on ? [...values.inclusions, kind] : values.inclusions.filter((other) => other !== kind);
    // In the list's order, as the API keeps them.
    onChange({ ...values, inclusions: kinds.map((option) => option.kind).filter((option) => picked.includes(option)) });
  };
  return (
    <div data-testid="activity-inclusions" className="flex flex-col gap-4">
      <div className="grid gap-x-6 sm:grid-cols-2">
        {kinds.map((option) => (
          <CheckboxField
            key={option.kind}
            label={option.name}
            checked={values.inclusions.includes(option.kind)}
            onChange={(event) => toggle(option.kind, event.currentTarget.checked)}
            data-testid={`activity-inclusion-${option.kind}`}
          />
        ))}
      </div>
      <TextareaField
        label="Anything else included (optional)"
        name="included"
        rows={2}
        maxLength={TEXT_MAX}
        counter={TEXT_MAX}
        value={values.included}
        onChange={(event) => onChange({ ...values, included: event.target.value })}
        error={errors?.included}
        placeholder="e.g. Bottled water"
      />
    </div>
  );
}

// The activity's lines of a review, as a guest will read them.
export function activityReviewRows(values: ActivityValues, catalogues: ActivityCatalogues): [string, string][] {
  const perUnit = values.soldBy === "unit";
  const offers = values.offers.map((offer) => {
    const cents = toCents(offer.price);
    const riders = perUnit ? `, up to ${offer.riders ?? values.seats} riders` : "";
    return `${lengthText(Number(offer.minutes))}: ${cents ? formatPeso(cents) : "—"}${riders}`;
  });
  const inclusions = catalogues.inclusions.filter((option) => values.inclusions.includes(option.kind)).map((option) => option.name);
  if (values.included.trim()) inclusions.push(values.included.trim());
  const addOns = values.addOns.map((addOn) => {
    const name = catalogues.addOns.find((option) => option.kind === addOn.kind)?.name ?? addOn.kind;
    const cents = toCents(addOn.price);
    const per = catalogues.chargedPer.find((each) => each.value === addOn.chargedPer)?.name ?? "";
    return `${name} ${cents ? formatPeso(cents) : "—"} ${per}`.trim();
  });
  const zones = zoneBody(values.zones).map((zone) => `up to ${zone.max_distance_m / 1000} km ${zone.fee_cents ? formatPeso(zone.fee_cents) : "free"}`);
  return [
    ["Sold", perUnit ? `Per unit, up to ${values.seats} on one` : `Per person, ${values.seats} seats each`],
    [
      "Runs",
      values.schedule === "open_hours"
        ? `${timeText(values.opensAt)} to ${timeText(values.closesAt)}`
        : [...new Set(values.departures)].sort().map(timeText).join(", "),
    ],
    ["Rates", offers.join("; ")],
    ["Included", inclusions.join(", ") || "Nothing listed"],
    ["Add-ons", addOns.join("; ") || "None"],
    ["Drop-off", values.dropOff ? zones.join("; ") : "No: guests pick it up at your shop"],
  ];
}
