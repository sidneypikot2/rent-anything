"use client";

import { useState } from "react";
import type { components } from "@/api/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { CheckboxField } from "@/components/ui/checkbox-field";
import { ChoiceCards } from "@/components/ui/choice-cards";
import { cn } from "@/components/ui/cn";
import { DateRangeField } from "@/components/ui/date-range-field";
import { Field } from "@/components/ui/field";
import { MonthCalendar, type DayMark } from "@/components/ui/month-calendar";
import { Pill } from "@/components/ui/pill";
import { StepperField } from "@/components/ui/stepper-field";
import { formatDateRange, todayIso } from "@/lib/dates";
import { formatPeso, fromCents, toCents } from "@/lib/money";
import {
  basePriceUnit,
  capitalize,
  INCLUSION_LABELS,
  TOUR_TYPES,
  WEEK,
  type InclusionKind,
  type TourType,
} from "@/lib/tours";
import { exampleFees, FeeFields, feesError, toFeesBody, toFeeValues, type FeeValues } from "./fee-fields";
import { AttributeFields, attributeFields, toAttrs, type AttributeField, type AttributeValues } from "./listing-fields";
import type { ListingBody, ListingCategory, ListingOptions, PartnerListing } from "./use-partner-listings";

type PartnerTour = components["schemas"]["partner_tour"];
type TourBody = components["schemas"]["tour_body"];
type BlockedDate = components["schemas"]["blocked_date"];
export type TourInclusionOptions = ListingOptions["tour_inclusions"];

// The API's limits (TourDetail, TourInclusion, AvailabilityBlock, Listings::TourValues).
const MAX_GUESTS = 100;
const MAX_GROUPS_PER_DAY = 100;
const LONGEST = { hours: 24, days: 30 } as const;
const MAX_DATES = 366;
const NOTE_LENGTH = 120;
const REASON_LENGTH = 120;

// Which days of the week a tour runs, as the partner picks them.
export type SchedulePreset = "every_day" | "weekdays" | "weekends" | "custom" | "dates";
const PRESETS: { value: SchedulePreset; label: string; weekdays?: number[] }[] = [
  { value: "every_day", label: "Every day", weekdays: [0, 1, 2, 3, 4, 5, 6] },
  { value: "weekdays", label: "Weekdays", weekdays: [1, 2, 3, 4, 5] },
  { value: "weekends", label: "Weekends", weekdays: [0, 6] },
  { value: "custom", label: "Custom days" },
  { value: "dates", label: "Specific dates only", weekdays: [] },
];

type InclusionValues = { on: boolean; options: string[]; note: string; price: string };
type BlockValues = { key: number; from: string; to: string; reason: string };

// A tour as the form holds it (RAA-111): counts as numbers, money and the duration as typed.
export type TourValues = {
  tourType: TourType;
  minGuests: number;
  maxGuests: number;
  maxGroups: number;
  duration: string;
  durationUnit: "hours" | "days";
  preset: SchedulePreset;
  weekdays: number[];
  dates: string[];
  blocks: BlockValues[];
  inclusions: Record<InclusionKind, InclusionValues>;
  basePrice: string;
  fees: FeeValues[];
  attrs: AttributeValues;
};

let nextBlockKey = 1;
const NO_INCLUSION: InclusionValues = { on: false, options: [], note: "", price: "" };

export const NEW_TOUR: TourValues = {
  tourType: "private",
  minGuests: 1,
  maxGuests: 6,
  maxGroups: 1,
  duration: "4",
  durationUnit: "hours",
  preset: "every_day",
  weekdays: [0, 1, 2, 3, 4, 5, 6],
  dates: [],
  blocks: [],
  inclusions: { accommodation: NO_INCLUSION, transport: NO_INCLUSION, meal: NO_INCLUSION },
  basePrice: "",
  fees: [],
  attrs: {},
};

function presetFor(weekdays: number[]): SchedulePreset {
  const key = [...weekdays].sort().join(",");
  return PRESETS.find((preset) => preset.weekdays && [...preset.weekdays].sort().join(",") === key)?.value ?? "custom";
}

// A saved tour as the fields hold it. A tour made before RAA-110 has a base price of 0: empty.
export function toTourValues(listing: Pick<PartnerListing, "tour" | "blocked_dates" | "fees" | "attrs">): TourValues {
  const tour: PartnerTour | null = listing.tour;
  const attrs: AttributeValues = {};
  for (const [key, value] of Object.entries(listing.attrs)) if (typeof value === "boolean") attrs[key] = value;
  const blocks = listing.blocked_dates.map((block) => ({
    key: nextBlockKey++,
    from: block.starts_on,
    to: block.ends_on,
    reason: block.reason ?? "",
  }));
  if (!tour) return { ...NEW_TOUR, blocks, fees: toFeeValues(listing.fees), attrs };
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
    preset: presetFor(tour.weekdays),
    weekdays: tour.weekdays,
    dates: tour.dates,
    blocks,
    inclusions,
    basePrice: tour.base_price_cents ? fromCents(tour.base_price_cents) : "",
    fees: toFeeValues(listing.fees),
    attrs,
  };
}

function weekday(iso: string) {
  return new Date(`${iso}T00:00:00Z`).getUTCDay();
}

// An added date that falls on one of the tour's weekdays says nothing more: it isn't sent.
function extraDates(values: TourValues) {
  return values.dates.filter((date) => !values.weekdays.includes(weekday(date)));
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
    weekdays: [...values.weekdays].sort(),
    dates: extraDates(values).sort(),
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

export function toBlockedDatesBody(values: TourValues): BlockedDate[] {
  return [...values.blocks]
    .sort((a, b) => a.from.localeCompare(b.from))
    .map((block) => ({ starts_on: block.from, ends_on: block.to, reason: block.reason.trim() || null }));
}

// The tour's part of a listing body: its details, blocked days, fees and yes/no extras.
export function toTourListingBody(
  values: TourValues,
  extras: AttributeField[],
): Pick<ListingBody, "tour" | "blocked_dates" | "fees" | "attrs"> {
  return {
    tour: toTourBody(values),
    blocked_dates: toBlockedDatesBody(values),
    fees: toFeesBody(values),
    attrs: toAttrs(extras, values.attrs),
  };
}

// A tour has its own details (RAA-110): the API's Category#tour?, by slug.
export function isTour(category: { slug: string } | undefined) {
  return category?.slug === "tour";
}

// The category's yes/no attrs (a guide, life vests), shown with the inclusions.
export function tourExtras(category: ListingCategory | undefined) {
  return attributeFields(category).filter((field) => field.type === "boolean");
}

export type TourErrors = Partial<
  Record<"duration" | "schedule" | "blocks" | "transport" | "meal" | "accommodation" | "basePrice" | "fees", string>
>;

// The sections of a tour, for checking one step at a time.
export const TOUR_SECTIONS = {
  group: ["duration"],
  schedule: ["schedule", "blocks"],
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

  if (values.weekdays.length === 0 && extraDates(values).length === 0) {
    errors.schedule =
      values.preset === "dates" ? "Tap the days it runs on the calendar" : "Pick at least one day it runs, or add a date";
  } else if (extraDates(values).length > MAX_DATES) errors.schedule = `At most ${MAX_DATES} added dates`;
  if (values.blocks.length > MAX_DATES) errors.blocks = `At most ${MAX_DATES} blocked days or ranges`;
  else if (values.blocks.some((block) => block.reason.trim().length > REASON_LENGTH)) {
    errors.blocks = `A reason can be at most ${REASON_LENGTH} characters`;
  }

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
        <div className="grid grid-cols-[minmax(0,8rem)_1fr] items-end gap-3">
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

// The block a day belongs to, if any.
function blockOn(blocks: BlockValues[], day: string) {
  return blocks.find((block) => block.from <= day && day <= block.to);
}

function shift(iso: string, days: number) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

// When it runs: the days of the week, then a calendar to check them on, where a tap blocks a
// day it runs, frees a blocked one, or adds (or drops) a day it otherwise doesn't run. Ranges
// are blocked with a reason below it.
export function TourScheduleFields({ values, onChange, errors }: SectionProps) {
  const today = todayIso();
  const [range, setRange] = useState({ from: "", to: "" });
  const [reason, setReason] = useState("");
  const [rangeError, setRangeError] = useState<string>();
  const set = (patch: Partial<TourValues>) => onChange({ ...values, ...patch });

  function pickPreset(preset: SchedulePreset) {
    const weekdays = PRESETS.find((option) => option.value === preset)?.weekdays;
    set({ preset, weekdays: weekdays ?? values.weekdays });
  }

  function toggleDay(day: number) {
    const weekdays = values.weekdays.includes(day)
      ? values.weekdays.filter((other) => other !== day)
      : [...values.weekdays, day];
    set({ preset: "custom", weekdays });
  }

  function mark(day: string): DayMark | undefined {
    if (blockOn(values.blocks, day)) return "blocked";
    if (values.weekdays.includes(weekday(day))) return "open";
    if (values.dates.includes(day)) return "extra";
    return undefined;
  }

  function tap(day: string) {
    const block = blockOn(values.blocks, day);
    if (block) {
      // Free the day: a range splits around it.
      const rest = [
        ...(block.from < day ? [{ ...block, key: nextBlockKey++, to: shift(day, -1) }] : []),
        ...(day < block.to ? [{ ...block, key: nextBlockKey++, from: shift(day, 1) }] : []),
      ];
      set({ blocks: [...values.blocks.filter((other) => other !== block), ...rest] });
    } else if (values.weekdays.includes(weekday(day))) {
      set({ blocks: [...values.blocks, { key: nextBlockKey++, from: day, to: day, reason: "" }] });
    } else if (values.dates.includes(day)) {
      set({ dates: values.dates.filter((other) => other !== day) });
    } else {
      set({ dates: [...values.dates, day].sort() });
    }
  }

  function blockRange() {
    if (!range.from || !range.to) return setRangeError("Pick the first and last day");
    if (values.blocks.some((block) => block.from <= range.to && range.from <= block.to)) {
      return setRangeError("Overlaps days already blocked: remove those first");
    }
    set({ blocks: [...values.blocks, { key: nextBlockKey++, ...range, reason }] });
    setRange({ from: "", to: "" });
    setReason("");
    setRangeError(undefined);
  }

  const blocks = [...values.blocks].sort((a, b) => a.from.localeCompare(b.from));
  const setBlock = (key: number, patch: Partial<BlockValues>) =>
    set({ blocks: values.blocks.map((block) => (block.key === key ? { ...block, ...patch } : block)) });

  return (
    <div data-testid="tour-schedule" className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <span className="text-sm font-semibold">Days it runs</span>
        <div role="group" aria-label="Days it runs" className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <Pill
              key={preset.value}
              on={values.preset === preset.value}
              onClick={() => pickPreset(preset.value)}
              data-testid={`tour-preset-${preset.value}`}
            >
              {preset.label}
            </Pill>
          ))}
        </div>
        {values.preset === "custom" && (
          <div role="group" aria-label="Days of the week" className="grid grid-cols-7 gap-1.5 animate-rise">
            {WEEK.map(({ day, short, long }) => (
              <button
                key={day}
                type="button"
                aria-pressed={values.weekdays.includes(day)}
                aria-label={long}
                onClick={() => toggleDay(day)}
                data-testid={`tour-weekday-${day}`}
                className={cn(
                  "min-h-11 rounded-control border text-sm font-semibold transition-colors duration-300 ease-calm",
                  values.weekdays.includes(day)
                    ? "border-primary bg-primary text-white"
                    : "border-line-strong bg-surface text-muted hover:border-primary hover:text-primary",
                )}
              >
                {short}
              </button>
            ))}
          </div>
        )}
        <p className="text-sm text-muted">
          {values.preset === "dates"
            ? "Tap each day it runs on the calendar."
            : "Tap a day it runs to block it, a blocked day to free it, or any other day to add it."}
        </p>
      </div>

      <div className="rounded-card bg-surface-2 p-4">
        <MonthCalendar label="Tour calendar" min={today} months={2} mark={mark} onDayClick={tap} data-testid="tour-calendar" />
      </div>
      {errors?.schedule && (
        <p role="alert" className="-mt-3 text-xs text-danger">
          {errors.schedule}
        </p>
      )}

      <div className="flex flex-col gap-3" data-testid="tour-blocks">
        <div className="flex flex-col">
          <span className="text-sm font-semibold">Blocked days</span>
          <span className="text-xs text-muted">No tour on these: a holiday, a fiesta, the boat in for repairs.</span>
        </div>
        {blocks.length > 0 && (
          <ul className="flex flex-col divide-y divide-line rounded-control border border-line">
            {blocks.map((block) => (
              <li key={block.key} className="flex flex-wrap items-end gap-3 px-4 py-3" data-testid="tour-block">
                <div className="min-w-0 flex-1">
                  <Field
                    label={formatDateRange(block.from, block.to) ?? ""}
                    maxLength={REASON_LENGTH}
                    placeholder="Reason (optional)"
                    value={block.reason}
                    onChange={(event) => setBlock(block.key, { reason: event.target.value })}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => set({ blocks: values.blocks.filter((other) => other.key !== block.key) })}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <DateRangeField
            label="Block a stretch of days"
            min={today}
            from={range.from}
            to={range.to}
            onChange={(next) => {
              setRange(next);
              setRangeError(undefined);
            }}
            error={rangeError}
            clearable
            data-testid="tour-block-range"
          />
          <Field
            label="Reason (optional)"
            name="block_reason"
            maxLength={REASON_LENGTH}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="e.g. Town fiesta"
          />
          <Button type="button" variant="soft" onClick={blockRange} data-testid="tour-block-add" className="sm:mb-0.5">
            Block
          </Button>
        </div>
        {errors?.blocks && (
          <p role="alert" className="text-xs text-danger">
            {errors.blocks}
          </p>
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
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-primary">For example</span>
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
