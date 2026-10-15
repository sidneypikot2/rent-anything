"use client";

import type { components } from "@/api/schema";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { CheckboxField } from "@/components/ui/checkbox-field";
import { ChoiceCards } from "@/components/ui/choice-cards";
import { cn } from "@/components/ui/cn";
import { Field } from "@/components/ui/field";
import { Pill } from "@/components/ui/pill";
import { StepperField } from "@/components/ui/stepper-field";
import { Eyebrow } from "@/components/ui/typography";
import { formatPeso, fromCents, toCents } from "@/lib/money";
import {
  basePriceUnit,
  capitalize,
  INCLUSION_LABELS,
  TOUR_TYPES,
  type InclusionKind,
  type TourType,
} from "@/lib/tours";
import { exampleFees, FeeFields, feesError, toFeesBody, toFeeValues, type FeeValues } from "./fee-fields";
import { AttributeFields, attributeFields, toAttrs, type AttributeField, type AttributeValues } from "./listing-fields";
import type { ListingBody, ListingCategory, ListingOptions, PartnerListing } from "./use-partner-listings";

type PartnerTour = components["schemas"]["partner_tour"];
type TourBody = components["schemas"]["tour_body"];
export type TourInclusionOptions = ListingOptions["tour_inclusions"];

// The API's limits (TourDetail, TourInclusion, Listings::TourValues).
const MAX_GUESTS = 100;
const MAX_GROUPS_PER_DAY = 100;
const LONGEST = { hours: 24, days: 30 } as const;
const NOTE_LENGTH = 120;

type InclusionValues = { on: boolean; options: string[]; note: string; price: string };

// A tour as the form holds it (RAA-111): counts as numbers, money and the duration as typed.
export type TourValues = {
  tourType: TourType;
  minGuests: number;
  maxGuests: number;
  maxGroups: number;
  duration: string;
  durationUnit: "hours" | "days";
  inclusions: Record<InclusionKind, InclusionValues>;
  basePrice: string;
  fees: FeeValues[];
  attrs: AttributeValues;
};

const NO_INCLUSION: InclusionValues = { on: false, options: [], note: "", price: "" };

export const NEW_TOUR: TourValues = {
  tourType: "private",
  minGuests: 1,
  maxGuests: 6,
  maxGroups: 1,
  duration: "4",
  durationUnit: "hours",
  inclusions: { accommodation: NO_INCLUSION, transport: NO_INCLUSION, meal: NO_INCLUSION },
  basePrice: "",
  fees: [],
  attrs: {},
};

// A saved tour as the fields hold it. A tour made before RAA-110 has a base price of 0: empty.
export function toTourValues(listing: Pick<PartnerListing, "tour" | "fees" | "attrs">): TourValues {
  const tour: PartnerTour | null = listing.tour;
  const attrs: AttributeValues = {};
  for (const [key, value] of Object.entries(listing.attrs)) if (typeof value === "boolean") attrs[key] = value;
  if (!tour) return { ...NEW_TOUR, fees: toFeeValues(listing.fees), attrs };
  const inclusions = { ...NEW_TOUR.inclusions };
  for (const inclusion of tour.inclusions) {
    inclusions[inclusion.kind] = {
      on: true,
      options: inclusion.options,
      note: inclusion.note ?? "",
      price: tour.tour_type === "private" ? fromCents(inclusion.price_per_head_cents) : "",
    };
  }
  return {
    tourType: tour.tour_type,
    minGuests: tour.min_guests,
    maxGuests: tour.max_guests,
    maxGroups: tour.max_groups_per_day,
    duration: String(tour.duration_value),
    durationUnit: tour.duration_unit,
    inclusions,
    basePrice: tour.base_price_cents ? fromCents(tour.base_price_cents) : "",
    fees: toFeeValues(listing.fees),
    attrs,
  };
}

// What the API takes. Call it after tourErrors has passed.
export function toTourBody(values: TourValues): TourBody {
  const joiner = values.tourType === "joiner";
  return {
    tour_type: values.tourType,
    min_guests: values.minGuests,
    max_guests: values.maxGuests,
    max_groups_per_day: values.maxGroups,
    duration_value: Number(values.duration),
    duration_unit: values.durationUnit,
    base_price_cents: toCents(values.basePrice) ?? 0,
    inclusions: (Object.keys(values.inclusions) as InclusionKind[]).flatMap((kind) => {
      const inclusion = values.inclusions[kind];
      if (!inclusion.on) return [];
      return [
        {
          kind,
          options: inclusion.options,
          note: inclusion.note.trim() || null,
          ...(joiner ? {} : { price_per_head_cents: toCents(inclusion.price) ?? 0 }),
        },
      ];
    }),
  };
}

// The tour's part of a listing body: its details, fees and yes/no extras.
export function toTourListingBody(
  values: TourValues,
  extras: AttributeField[],
): Pick<ListingBody, "tour" | "fees" | "attrs"> {
  return {
    tour: toTourBody(values),
    fees: toFeesBody(values),
    attrs: toAttrs(extras, values.attrs),
  };
}

// The most photos a tour can have (the API's photo_limit for a tour, RAA-110): for a listing
// whose category is changed to a tour before its saved photo_limit says so.
export const TOUR_PHOTO_LIMIT = 5;

// A tour has its own details (RAA-110): the API's Category#tour?, by slug.
export function isTour(category: { slug: string } | undefined) {
  return category?.slug === "tour";
}

// The category's yes/no attrs (a guide), shown with the inclusions.
export function tourExtras(category: ListingCategory | undefined) {
  return attributeFields(category).filter((field) => field.type === "boolean");
}

export type TourErrors = Partial<
  Record<"duration" | "transport" | "meal" | "accommodation" | "basePrice" | "fees", string>
>;

// The sections of a tour, for checking one step at a time.
export const TOUR_SECTIONS = {
  group: ["duration"],
  inclusions: ["accommodation", "transport", "meal"],
  pricing: ["basePrice", "fees"],
} as const satisfies Record<string, (keyof TourErrors)[]>;

// What the tour still needs, or undefined; `section` checks just that one. The same rules as
// Listings::TourValues, so a mistake shows here rather than as a 422.
export function tourErrors(values: TourValues, section?: keyof typeof TOUR_SECTIONS): TourErrors | undefined {
  const errors: TourErrors = {};
  const duration = /^\d+$/.test(values.duration.trim()) ? Number(values.duration) : 0;
  const longest = LONGEST[values.durationUnit];
  if (duration < 1 || duration > longest) errors.duration = `A whole number from 1 to ${longest} ${values.durationUnit}`;

  for (const kind of Object.keys(values.inclusions) as InclusionKind[]) {
    const inclusion = values.inclusions[kind];
    if (!inclusion.on) continue;
    if (kind !== "accommodation" && inclusion.options.length === 0) {
      errors[kind] = kind === "transport" ? "Pick at least one vehicle" : "Pick at least one meal";
    } else if (inclusion.note.trim().length > NOTE_LENGTH) errors[kind] = `A note can be at most ${NOTE_LENGTH} characters`;
    else if (values.tourType === "private" && toCents(inclusion.price) === null) {
      errors[kind] = "Set its price per guest (0 if it's free)";
    }
  }

  if (!toCents(values.basePrice)) errors.basePrice = "Set a price above ₱0";
  const fees = feesError(values.fees);
  if (fees) errors.fees = fees;

  const keys: readonly (keyof TourErrors)[] | undefined = section && TOUR_SECTIONS[section];
  const shown = Object.fromEntries(Object.entries(errors).filter(([key]) => !keys || keys.includes(key as keyof TourErrors)));
  return Object.keys(shown).length > 0 ? shown : undefined;
}

type SectionProps = {
  values: TourValues;
  onChange: (values: TourValues) => void;
  errors?: TourErrors;
};

// Private or joiner: what decides how the group, the price and the inclusions read.
export function TourTypeChoice({ values, onChange }: SectionProps) {
  return (
    <ChoiceCards
      legend="Type of tour"
      name="tour_type"
      required
      value={values.tourType}
      onChange={(value) => onChange({ ...values, tourType: value as TourType })}
      choices={TOUR_TYPES}
      data-testid="tour-type"
    />
  );
}

// The group size, how many groups a day and how long it takes.
export function TourGroupFields({ values, onChange, errors }: SectionProps) {
  const set = (patch: Partial<TourValues>) => onChange({ ...values, ...patch });
  const privateTour = values.tourType === "private";

  return (
    <div data-testid="tour-group" className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 divide-y divide-line">
        <StepperField
          label="Fewest guests"
          hint={privateTour ? "The smallest group you take out." : "The tour runs once this many have joined."}
          value={values.minGuests}
          min={1}
          max={MAX_GUESTS}
          onChange={(minGuests) => set({ minGuests, maxGuests: Math.max(values.maxGuests, minGuests) })}
          data-testid="tour-min-guests"
        />
        <StepperField
          label="Most guests"
          hint={privateTour ? "The largest group, all in one booking." : "Seats on one tour."}
          value={values.maxGuests}
          min={values.minGuests}
          max={MAX_GUESTS}
          onChange={(maxGuests) => set({ maxGuests })}
          data-testid="tour-max-guests"
        />
        <StepperField
          label="Groups a day"
          hint={
            privateTour
              ? "How many separate groups you can take on one day."
              : `How many times a day a group can fill up to ${values.maxGuests} guests.`
          }
          value={values.maxGroups}
          min={1}
          max={MAX_GROUPS_PER_DAY}
          onChange={(maxGroups) => set({ maxGroups })}
          data-testid="tour-max-groups"
        />
      </div>

      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-[minmax(0,11rem)_1fr] items-end gap-3">
          <Field
            label="How long it takes"
            name="duration"
            type="number"
            required
            min={1}
            max={LONGEST[values.durationUnit]}
            step={1}
            inputMode="numeric"
            value={values.duration}
            onChange={(event) => set({ duration: event.target.value })}
            data-testid="tour-duration"
          />
          <div role="group" aria-label="Duration unit" className="flex gap-2 pb-1">
            {(["hours", "days"] as const).map((unit) => (
              <Pill
                key={unit}
                on={values.durationUnit === unit}
                onClick={() => set({ durationUnit: unit })}
                data-testid={`tour-duration-${unit}`}
              >
                {capitalize(unit)}
              </Pill>
            ))}
          </div>
        </div>
        {errors?.duration ? (
          <p role="alert" className="text-xs text-danger">
            {errors.duration}
          </p>
        ) : (
          values.durationUnit === "days" && (
            <p className="text-xs text-muted">A tour of several days starts on the days it runs.</p>
          )
        )}
      </div>
    </div>
  );
}

const INCLUSION_HINTS: Record<InclusionKind, { text: string; placeholder: string }> = {
  accommodation: { text: "Somewhere to sleep on a tour of several days.", placeholder: "e.g. Beach cottage, 1 night" },
  transport: { text: "How guests get around, by the vehicles you use.", placeholder: "e.g. Hotel pick-up included" },
  meal: { text: "Which meals and snacks guests get.", placeholder: "e.g. Grilled seafood lunch" },
};

// What the tour includes, a card each: on a private tour an add-on the group picks, priced
// per guest; on a joiner tour part of the price. Then the category's yes/no extras (a guide).
export function TourInclusionFields({
  values,
  onChange,
  errors,
  kinds,
  extras,
}: SectionProps & { kinds: TourInclusionOptions; extras: AttributeField[] }) {
  const privateTour = values.tourType === "private";
  const setInclusion = (kind: InclusionKind, patch: Partial<InclusionValues>) =>
    onChange({ ...values, inclusions: { ...values.inclusions, [kind]: { ...values.inclusions[kind], ...patch } } });

  return (
    <div data-testid="tour-inclusions" className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        {privateTour
          ? "Each is an add-on the group can choose, at a price per guest on top of the group price."
          : "What every joiner gets. It's all part of the price per guest."}
      </p>
      {kinds.map(({ kind, options }) => {
        const inclusion = values.inclusions[kind];
        return (
          <Card key={kind} data-testid={`tour-inclusion-${kind}`} className={cn("transition-shadow duration-500 ease-calm", inclusion.on && "shadow-lift")}>
            <CardBody className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-0.5">
                  <span className="text-lg font-semibold">{INCLUSION_LABELS[kind]}</span>
                  <span className="text-sm text-muted">{INCLUSION_HINTS[kind].text}</span>
                </div>
                <CheckboxField
                  label={privateTour ? "Offer" : "Include"}
                  checked={inclusion.on}
                  onChange={(event) => setInclusion(kind, { on: event.target.checked })}
                  data-testid={`tour-inclusion-${kind}-on`}
                  className="shrink-0"
                />
              </div>
              {inclusion.on && (
                <div className="flex flex-col gap-4 animate-rise">
                  {options.length > 0 && (
                    <div role="group" aria-label={`${INCLUSION_LABELS[kind]} options`} className="flex flex-wrap gap-2">
                      {options.map((option) => {
                        const on = inclusion.options.includes(option);
                        return (
                          <Pill
                            key={option}
                            on={on}
                            onClick={() =>
                              setInclusion(kind, {
                                // Kept in the API's order.
                                options: options.filter((other) => (other === option ? !on : inclusion.options.includes(other))),
                              })
                            }
                            data-testid={`tour-inclusion-${kind}-${option}`}
                          >
                            {capitalize(option)}
                          </Pill>
                        );
                      })}
                    </div>
                  )}
                  <div className={cn("grid gap-3", privateTour && "sm:grid-cols-[2fr_1fr]")}>
                    <Field
                      label="Note (optional)"
                      name={`inclusion_note_${kind}`}
                      maxLength={NOTE_LENGTH}
                      value={inclusion.note}
                      onChange={(event) => setInclusion(kind, { note: event.target.value })}
                      placeholder={INCLUSION_HINTS[kind].placeholder}
                    />
                    {privateTour && (
                      <Field
                        label="Price per guest (₱)"
                        name={`inclusion_price_${kind}`}
                        type="number"
                        required
                        min={0}
                        step="0.01"
                        inputMode="decimal"
                        value={inclusion.price}
                        onChange={(event) => setInclusion(kind, { price: event.target.value })}
                        data-testid={`tour-inclusion-${kind}-price`}
                      />
                    )}
                  </div>
                  {!privateTour && (
                    <Badge tone="emerald" className="self-start">
                      Included in the price
                    </Badge>
                  )}
                </div>
              )}
              {errors?.[kind] && (
                <p role="alert" className="text-xs text-danger">
                  {errors[kind]}
                </p>
              )}
            </CardBody>
          </Card>
        );
      })}
      {extras.length > 0 && (
        <div className="flex flex-col gap-3 pt-2">
          <span className="text-sm font-semibold">Also included</span>
          <AttributeFields
            fields={extras}
            values={values.attrs}
            onChange={(attrs) => onChange({ ...values, attrs })}
          />
        </div>
      )}
    </div>
  );
}

// A worked example of what a booking costs, so the partner sees their numbers add up: a
// full group with every add-on on a private tour, a full tour's worth of joiners otherwise,
// with the required fees. Only a preview: guests' totals come with bookings (M3).
function exampleLine(values: TourValues) {
  const base = toCents(values.basePrice);
  if (!base) return null;
  const guests = values.maxGuests;
  const days = values.durationUnit === "days" ? Number(values.duration) || 1 : 1;
  const nights = Math.max(days - 1, 0);
  const guestWord = guests === 1 ? "guest" : "guests";
  const parts: string[] = [];
  let total: number;
  if (values.tourType === "private") {
    parts.push(`${formatPeso(base)} for the group`);
    total = base;
    for (const kind of Object.keys(values.inclusions) as InclusionKind[]) {
      const inclusion = values.inclusions[kind];
      const price = toCents(inclusion.price);
      if (!inclusion.on || !price) continue;
      parts.push(`${INCLUSION_LABELS[kind].toLowerCase()} ${formatPeso(price)} × ${guests}`);
      total += price * guests;
    }
  } else {
    parts.push(`${formatPeso(base)} × ${guests}`);
    total = base * guests;
  }
  for (const fee of exampleFees(values.fees, { booking: 1, night: nights, guest: guests, guest_night: guests * nights, unit: 1 })) {
    parts.push(fee.label);
    total += fee.cents;
  }
  const who = values.tourType === "private" ? `a group of ${guests}` : `${guests} ${guestWord} joining`;
  return { who, total: formatPeso(total), parts: parts.join(" + ") };
}

// The base price, per group or per guest by the tour's type, a worked example, and the fees.
export function TourPricingFields({ values, onChange, errors }: SectionProps) {
  const privateTour = values.tourType === "private";
  const example = exampleLine(values);

  return (
    <div data-testid="tour-pricing" className="flex flex-col gap-6">
      <Field
        label={privateTour ? "Price per group (₱)" : "Price per guest (₱)"}
        name="base_price"
        type="number"
        required
        min={0.01}
        step="0.01"
        inputMode="decimal"
        value={values.basePrice}
        onChange={(event) => onChange({ ...values, basePrice: event.target.value })}
        error={errors?.basePrice}
        hint={
          privateTour
            ? `For the whole group, up to ${values.maxGuests} guests. Add-ons they pick are added per guest.`
            : "Each joiner pays this. What you include is part of it."
        }
        data-testid="tour-base-price"
      />

      {example && (
        <div className="flex flex-col gap-1 rounded-card bg-mist px-5 py-4 animate-rise" data-testid="tour-pricing-example">
          <Eyebrow>For example</Eyebrow>
          <span className="text-sm">
            For {example.who}: <span className="font-display text-lg font-extrabold tabular-nums">{example.total}</span>
          </span>
          <span className="text-xs text-muted">{example.parts}</span>
        </div>
      )}

      <FeeFields
        fees={values.fees}
        onChange={(fees) => onChange({ ...values, fees })}
        error={errors?.fees}
        hint="An environmental fee, a boat permit. Optional ones are add-ons guests choose."
      />
    </div>
  );
}

// The base price as a guest will read it: "₱3,500 per group".
export function basePriceText(values: TourValues) {
  const cents = toCents(values.basePrice);
  return cents ? `${formatPeso(cents)} ${basePriceUnit(values.tourType)}` : "—";
}
