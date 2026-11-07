"use client";

import type { components } from "@/api/schema";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { CheckboxField } from "@/components/ui/checkbox-field";
import { ChoiceCards } from "@/components/ui/choice-cards";
import { Field } from "@/components/ui/field";
import { SelectField } from "@/components/ui/select-field";
import { StepperField } from "@/components/ui/stepper-field";
import { TextareaField } from "@/components/ui/textarea-field";
import type { LatLng } from "@/lib/map";
import { formatPeso, fromCents, toCents } from "@/lib/money";
import { DeliveryZoneFields, FIRST_ZONE, toZoneValues, zoneBody, zonesError, type ZoneValues } from "./delivery-zones-field";
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
const MAX_SEATS = 100;
const MAX_DEPARTURES = 24;
const MAX_OFFERS = 10;
const NAME_MAX = 60;
const TEXT_MAX = 500;
const DURATION = { min: 5, max: 720 };
const QUICK_LENGTHS = [15, 30, 60];

// A water activity (RAA-268): the API sends its builder defaults only for these.
export function isWaterActivity(category: Pick<ListingCategory, "activity_defaults"> | undefined) {
  return category?.activity_defaults != null;
}

// Every half hour of the day, as the API takes times: "08:30", read "8:30 AM".
const HALF_HOURS = Array.from({ length: 48 }, (_, index) => {
  const hour = Math.floor(index / 2);
  const minute = index % 2 ? "30" : "00";
  return { value: `${String(hour).padStart(2, "0")}:${minute}`, label: timeLabel(hour, minute) };
});

function timeLabel(hour: number, minute: string) {
  return `${hour % 12 === 0 ? 12 : hour % 12}:${minute} ${hour < 12 ? "AM" : "PM"}`;
}

export function timeText(time: string) {
  return HALF_HOURS.find((option) => option.value === time)?.label ?? time;
}

const minutesOf = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));

// "15 minutes", "1 hour", "1 hour 30 minutes".
export function lengthText(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const parts = [hours ? `${hours} ${hours === 1 ? "hour" : "hours"}` : "", rest ? `${rest} minutes` : ""];
  return parts.filter(Boolean).join(" ");
}

// One offer as typed: length and price are text until saved; `riders` null means up to the
// seats on one unit. `id` is the saved offer it changes.
export type OfferValues = { id?: number; name: string; minutes: string; price: string; riders: number | null };
type AddOnValues = { on: boolean; price: string; chargedPer: ChargedPer };

// A water activity as the form holds it (RAA-272). Text kept under a switch that's off (a
// minimum age, an unticked add-on's price, drop-off zones) comes back when it is switched on.
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
  addOns: Partial<Record<AddOnKind, AddOnValues>>;
  dropOff: boolean;
  zones: ZoneValues[];
};

const BLANK_OFFER: OfferValues = { name: "", minutes: "60", price: "", riders: null };

// The category's builder defaults (activity_body without prices), read defensively: the team
// sets them.
type Defaults = Partial<Omit<ActivityBody, "offers">> & {
  offers?: { name?: string; duration_minutes?: number; max_guests?: number | null }[];
};

export function newActivityValues(defaults: ListingCategory["activity_defaults"] | undefined): ActivityValues {
  const d = (defaults ?? {}) as Defaults;
  const offers = (d.offers ?? []).map((offer) => ({
    name: offer.name ?? "",
    minutes: offer.duration_minutes ? String(offer.duration_minutes) : "",
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
    offers: offers.length ? offers : [BLANK_OFFER],
    inclusions: d.inclusions ?? [],
    included: d.included ?? "",
    addOns: {},
    dropOff: false,
    zones: [FIRST_ZONE],
  };
}

// A saved activity as the form holds it; one with none yet (a listing moved into a water
// category) starts from the category's defaults.
export function toActivityValues(activity: PartnerActivity | null, defaults: ListingCategory["activity_defaults"] | undefined): ActivityValues {
  if (!activity) return newActivityValues(defaults);
  const addOns: ActivityValues["addOns"] = {};
  for (const addOn of activity.add_ons) {
    addOns[addOn.kind] = { on: true, price: fromCents(addOn.price_cents), chargedPer: addOn.charged_per };
  }
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
      name: offer.name,
      minutes: String(offer.duration_minutes),
      price: fromCents(offer.price_cents),
      riders: offer.max_guests,
    })),
    inclusions: activity.inclusions,
    included: activity.included ?? "",
    addOns,
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
      name: offer.name.trim(),
      duration_minutes: Number(offer.minutes),
      price_cents: toCents(offer.price) ?? 0,
      // Riders taking turns are a unit's; sold by the seat, each guest has their own.
      max_guests: values.soldBy === "unit" ? offer.riders : null,
    })),
    inclusions: values.inclusions,
    add_ons: (Object.entries(values.addOns) as [AddOnKind, AddOnValues][])
      .filter(([, addOn]) => addOn.on)
      .map(([kind, addOn]) => ({ kind, price_cents: toCents(addOn.price) ?? 0, charged_per: addOn.chargedPer })),
    delivery_zones: values.dropOff ? zoneBody(values.zones) : [],
  };
}

export type ActivityErrors = Partial<
  Record<"hours" | "departures" | "minAge" | "requirements" | "offers" | "included" | "addOns" | "zones", string>
>;

// The steps of the wizard (and sections of the edit page) each error belongs to.
export const ACTIVITY_SECTIONS = {
  runs: ["hours", "departures", "minAge", "requirements"],
  rates: ["offers"],
  inclusions: ["included"],
  addOns: ["addOns"],
  dropOff: ["zones"],
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

  for (const [kind, addOn] of Object.entries(values.addOns)) {
    if (addOn.on && !toCents(addOn.price)) {
      errors.addOns = `Set a price above ₱0 for each add-on you offer (${kind.replaceAll("_", " ")}), or untick it`;
      break;
    }
  }
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
  const names = new Set<string>();
  const open = values.schedule === "open_hours" ? minutesOf(values.closesAt) - minutesOf(values.opensAt) : null;
  for (const [index, offer] of offers.entries()) {
    const name = offer.name.trim();
    const which = name || `Rate ${index + 1}`;
    if (!name || name.length > NAME_MAX) return `Give each rate a name of at most ${NAME_MAX} characters`;
    if (names.has(name.toLowerCase())) return `Two rates are called ${name}`;
    names.add(name.toLowerCase());
    const minutes = /^\d+$/.test(offer.minutes.trim()) ? Number(offer.minutes) : 0;
    if (minutes < DURATION.min || minutes > DURATION.max || minutes % 5 !== 0) {
      return `${which}: a length from ${DURATION.min} to ${DURATION.max} minutes, in steps of 5`;
    }
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

// How it is sold and when it runs (RAA-270).
export function ActivityRunFields({ values, onChange, errors }: SectionProps) {
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
        <div className="flex flex-col gap-3" data-testid="activity-departures">
          {values.departures.map((time, index) => (
            <div key={index} className="grid grid-cols-[1fr_auto] items-end gap-3">
              <SelectField
                label={`Departure ${index + 1}`}
                options={HALF_HOURS}
                value={time}
                onChange={(event) => set({ departures: values.departures.map((other, at) => (at === index ? event.target.value : other)) })}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={values.departures.length === 1}
                onClick={() => set({ departures: values.departures.filter((_, at) => at !== index) })}
                aria-label={`Remove departure ${index + 1}`}
              >
                Remove
              </Button>
            </div>
          ))}
          {errors?.departures && <p className="text-sm font-semibold text-danger">{errors.departures}</p>}
          {values.departures.length < MAX_DEPARTURES && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="self-start"
              onClick={() => set({ departures: [...values.departures, nextHalfHour(values.departures.at(-1))] })}
            >
              + Add a departure
            </Button>
          )}
        </div>
      )}
      <StepperField
        label={perUnit ? "Most guests on one" : "Seats on each"}
        hint={perUnit ? "On one jet ski, kayak or boat at a time" : "How many guests one session or boat takes"}
        value={values.seats}
        onChange={(seats) => set({ seats })}
        min={1}
        max={MAX_SEATS}
        data-testid="activity-seats"
      />
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

function nextHalfHour(time: string | undefined) {
  const index = HALF_HOURS.findIndex((option) => option.value === time);
  return HALF_HOURS[Math.min(index + 2, HALF_HOURS.length - 1)]?.value ?? "09:00";
}

// The rates (RAA-270, riders RAA-271): each a name, a length and a price.
export function ActivityOfferFields({ values, onChange, errors }: SectionProps) {
  const perUnit = values.soldBy === "unit";
  const setOffer = (index: number, patch: Partial<OfferValues>) =>
    onChange({ ...values, offers: values.offers.map((offer, at) => (at === index ? { ...offer, ...patch } : offer)) });
  return (
    <div data-testid="activity-offers" className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        What guests pick: a length and its price, {perUnit ? "for one unit and the riders on it" : "for each guest"}.
      </p>
      {values.offers.map((offer, index) => (
        <Card key={offer.id ?? `new-${index}`} edge="line" data-testid="activity-offer">
          <CardBody className="flex flex-col gap-4">
            <Field
              label="Name"
              maxLength={NAME_MAX}
              value={offer.name}
              onChange={(event) => setOffer(index, { name: event.target.value })}
              placeholder="e.g. 30 minutes"
              data-testid="activity-offer-name"
            />
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-2" role="group" aria-label="Quick lengths">
                {QUICK_LENGTHS.map((minutes) => (
                  <Button
                    key={minutes}
                    type="button"
                    size="sm"
                    variant={offer.minutes === String(minutes) ? "primary" : "tint"}
                    aria-pressed={offer.minutes === String(minutes)}
                    onClick={() => setOffer(index, { minutes: String(minutes) })}
                  >
                    {lengthText(minutes)}
                  </Button>
                ))}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Length (minutes)"
                  type="number"
                  min={DURATION.min}
                  max={DURATION.max}
                  step={5}
                  inputMode="numeric"
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
            </div>
            {perUnit && (
              <StepperField
                label={`Up to ${offer.riders ?? values.seats} riders`}
                hint="Who may share or take turns on one unit"
                value={offer.riders ?? values.seats}
                onChange={(riders) => setOffer(index, { riders })}
                min={1}
                max={MAX_SEATS}
                data-testid="activity-offer-riders"
              />
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="self-start"
              disabled={values.offers.length === 1}
              onClick={() => onChange({ ...values, offers: values.offers.filter((_, at) => at !== index) })}
            >
              Remove this rate
            </Button>
          </CardBody>
        </Card>
      ))}
      {errors?.offers && (
        <p role="alert" className="text-sm font-semibold text-danger">
          {errors.offers}
        </p>
      )}
      {values.offers.length < MAX_OFFERS && (
        <Button
          type="button"
          variant="tint"
          size="sm"
          className="self-start"
          onClick={() => onChange({ ...values, offers: [...values.offers, BLANK_OFFER] })}
          data-testid="activity-offer-add"
        >
          + Add a rate
        </Button>
      )}
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

// Extras guests can add (RAA-271), each priced per booking, unit or person.
export function ActivityAddOnFields({
  values,
  onChange,
  errors,
  kinds,
  chargedPer,
}: SectionProps & { kinds: ActivityCatalogues["addOns"]; chargedPer: ActivityCatalogues["chargedPer"] }) {
  const set = (kind: AddOnKind, patch: Partial<AddOnValues>) => {
    const current = values.addOns[kind] ?? { on: false, price: "", chargedPer: "booking" as ChargedPer };
    onChange({ ...values, addOns: { ...values.addOns, [kind]: { ...current, ...patch } } });
  };
  const perOptions = chargedPer.map((option) => ({ value: option.value, label: option.name }));
  return (
    <div data-testid="activity-add-ons" className="flex flex-col gap-3">
      <p className="text-sm text-muted">Guests choose these when they book. Leave them all unticked if you offer none.</p>
      {kinds.map((option) => {
        const addOn = values.addOns[option.kind];
        return (
          <Card key={option.kind} edge="line" data-testid={`activity-add-on-${option.kind}`}>
            <CardBody className="flex flex-col gap-3">
              <CheckboxField
                label={<span className="text-base font-semibold">{option.name}</span>}
                checked={addOn?.on ?? false}
                onChange={(event) => set(option.kind, { on: event.currentTarget.checked })}
                data-testid="activity-add-on-on"
              />
              {addOn?.on && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Price (₱)"
                    type="number"
                    min={0.01}
                    step="0.01"
                    inputMode="decimal"
                    value={addOn.price}
                    onChange={(event) => set(option.kind, { price: event.target.value })}
                    data-testid="activity-add-on-price"
                  />
                  <SelectField
                    label="Charged"
                    options={perOptions}
                    value={addOn.chargedPer}
                    onChange={(event) => set(option.kind, { chargedPer: event.target.value as ChargedPer })}
                    data-testid="activity-add-on-per"
                  />
                </div>
              )}
            </CardBody>
          </Card>
        );
      })}
      {errors?.addOns && (
        <p role="alert" className="text-sm font-semibold text-danger">
          {errors.addOns}
        </p>
      )}
    </div>
  );
}

// Bringing the unit to the guest's beach or chosen spot (RAA-271): no zones, no drop-off.
export function ActivityDropOffFields({ values, onChange, errors, location }: SectionProps & { location?: LatLng | null }) {
  return (
    <div data-testid="activity-drop-off" className="flex flex-col gap-4">
      <ChoiceCards
        legend="Do you bring it to the guest?"
        name="drop_off"
        value={values.dropOff ? "yes" : "no"}
        onChange={(choice) => onChange({ ...values, dropOff: choice === "yes" })}
        choices={[
          { value: "no", label: "No", description: "Guests come to your pin" },
          { value: "yes", label: "Yes", description: "To their beach or a spot they choose, priced by distance" },
        ]}
        data-testid="activity-drop-off-choice"
      />
      {values.dropOff && (
        <DeliveryZoneFields
          zones={values.zones}
          onChange={(zones) => onChange({ ...values, zones })}
          error={errors?.zones}
          location={location}
          feeLabel="Fee (₱)"
          beyond="drop-off"
        />
      )}
    </div>
  );
}

// The activity's lines of a review, as a guest will read them.
export function activityReviewRows(values: ActivityValues, catalogues: ActivityCatalogues): [string, string][] {
  const perUnit = values.soldBy === "unit";
  const offers = values.offers.map((offer) => {
    const cents = toCents(offer.price);
    const riders = perUnit ? `, up to ${offer.riders ?? values.seats} riders` : "";
    return `${offer.name.trim() || "—"}: ${cents ? formatPeso(cents) : "—"}${riders}`;
  });
  const inclusions = catalogues.inclusions.filter((option) => values.inclusions.includes(option.kind)).map((option) => option.name);
  if (values.included.trim()) inclusions.push(values.included.trim());
  const addOns = catalogues.addOns.flatMap((option) => {
    const addOn = values.addOns[option.kind];
    if (!addOn?.on) return [];
    const cents = toCents(addOn.price);
    const per = catalogues.chargedPer.find((each) => each.value === addOn.chargedPer)?.name ?? "";
    return [`${option.name} ${cents ? formatPeso(cents) : "—"} ${per}`.trim()];
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
    ["Drop-off", values.dropOff ? zones.join("; ") : "No"],
  ];
}
