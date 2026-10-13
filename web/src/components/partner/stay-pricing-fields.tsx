"use client";

import type { components } from "@/api/schema";
import { Button } from "@/components/ui/button";
import { CheckboxField } from "@/components/ui/checkbox-field";
import { Field } from "@/components/ui/field";
import { SelectField } from "@/components/ui/select-field";
import { StepperField } from "@/components/ui/stepper-field";
import { formatPeso, fromCents, toCents } from "@/lib/money";
import { CHARGED_PER, type ChargedPer } from "@/lib/pricing";

type StayRate = components["schemas"]["stay_rate"];
type StayRateBody = components["schemas"]["stay_rate_body"];
type ListingFee = components["schemas"]["listing_fee"];
type ListingFeeBody = components["schemas"]["listing_fee_body"];

const MAX_FEES = 20;
const MAX_NIGHTS = 365;
const MAX_DISCOUNT = 90;

// A fee row as the form holds it; `key` keeps React's rows apart before the API gives them ids.
export type FeeValues = { key: number; name: string; amount: string; chargedPer: ChargedPer; required: boolean };

// A stay's price (RAA-104) as typed: pesos and counts are text until saved.
export type PricingValues = {
  nightly: string;
  weekend: string;
  baseGuests: number;
  extraGuestFee: string;
  weeklyDiscount: string;
  monthlyDiscount: string;
  minNights: string;
  maxNights: string;
  fees: FeeValues[];
};

let nextFeeKey = 1;
function newFee(): FeeValues {
  return { key: nextFeeKey++, name: "", amount: "", chargedPer: "booking", required: true };
}

export const NEW_PRICING: PricingValues = {
  nightly: "",
  weekend: "",
  baseGuests: 1,
  extraGuestFee: "",
  weeklyDiscount: "",
  monthlyDiscount: "",
  minNights: "1",
  maxNights: "",
  fees: [],
};

// A saved listing's pricing as the fields hold it. A back-filled nightly price of 0 starts empty.
export function toPricingValues(rate: StayRate | null, fees: ListingFee[]): PricingValues {
  const peso = (cents: number | null | undefined) => (cents ? fromCents(cents) : "");
  const percent = (value: number) => (value ? String(value) : "");
  return {
    nightly: peso(rate?.nightly_price_cents),
    weekend: peso(rate?.weekend_price_cents),
    baseGuests: rate?.base_guests ?? NEW_PRICING.baseGuests,
    extraGuestFee: peso(rate?.extra_guest_fee_cents),
    weeklyDiscount: percent(rate?.weekly_discount_percent ?? 0),
    monthlyDiscount: percent(rate?.monthly_discount_percent ?? 0),
    minNights: String(rate?.min_nights ?? 1),
    maxNights: rate?.max_nights ? String(rate.max_nights) : "",
    fees: fees.map((fee) => ({
      key: nextFeeKey++,
      name: fee.name,
      amount: fromCents(fee.amount_cents),
      chargedPer: fee.charged_per,
      required: fee.required,
    })),
  };
}

function wholeNumber(text: string): number | null {
  return /^\d+$/.test(text.trim()) ? Number(text.trim()) : null;
}

// A shared room is priced per guest: it has no base occupancy or extra-guest fee.
export function isPerGuest(placeType: string) {
  return placeType === "shared_room";
}

// What the API takes. Call it after pricingErrors has passed; base guests never exceed what
// the place sleeps (the partner may have lowered it after setting the price).
export function toStayRateBody(values: PricingValues, placeType: string, sleeps: number): StayRateBody {
  const perGuest = isPerGuest(placeType);
  return {
    nightly_price_cents: toCents(values.nightly) ?? 0,
    weekend_price_cents: values.weekend.trim() ? toCents(values.weekend) : null,
    base_guests: perGuest ? 1 : Math.min(values.baseGuests, sleeps),
    extra_guest_fee_cents: perGuest ? 0 : (toCents(values.extraGuestFee) ?? 0),
    weekly_discount_percent: wholeNumber(values.weeklyDiscount) ?? 0,
    monthly_discount_percent: wholeNumber(values.monthlyDiscount) ?? 0,
    min_nights: wholeNumber(values.minNights) ?? 1,
    max_nights: wholeNumber(values.maxNights),
  };
}

export function toFeesBody(values: PricingValues): ListingFeeBody[] {
  return values.fees.map((fee) => ({
    name: fee.name.trim(),
    amount_cents: toCents(fee.amount) ?? 0,
    charged_per: fee.chargedPer,
    required: fee.required,
  }));
}

export type PricingErrors = Partial<
  Record<"nightly" | "weekend" | "extraGuestFee" | "weeklyDiscount" | "monthlyDiscount" | "minNights" | "maxNights" | "fees", string>
>;

// What the pricing still needs before it can be saved, or undefined when nothing. The same
// rules as StayRate and Listings::ListingValues, so a mistake shows here rather than as a 422.
export function pricingErrors(values: PricingValues): PricingErrors | undefined {
  const errors: PricingErrors = {};
  const nightly = toCents(values.nightly);
  if (!nightly) errors.nightly = "Set a nightly price above ₱0";
  if (values.weekend.trim() && !toCents(values.weekend)) errors.weekend = "Leave it empty, or set a price above ₱0";
  if (values.extraGuestFee.trim() && toCents(values.extraGuestFee) === null) errors.extraGuestFee = "Enter an amount in pesos";

  const percent = (text: string) => (text.trim() ? wholeNumber(text) : 0);
  const weekly = percent(values.weeklyDiscount);
  const monthly = percent(values.monthlyDiscount);
  if (weekly === null || weekly > MAX_DISCOUNT) errors.weeklyDiscount = `A whole number from 0 to ${MAX_DISCOUNT}`;
  if (monthly === null || monthly > MAX_DISCOUNT) errors.monthlyDiscount = `A whole number from 0 to ${MAX_DISCOUNT}`;
  else if (weekly && monthly && monthly < weekly) errors.monthlyDiscount = "Can't be less than the weekly discount";

  const min = wholeNumber(values.minNights);
  const max = values.maxNights.trim() ? wholeNumber(values.maxNights) : undefined;
  if (min === null || min < 1 || min > MAX_NIGHTS) errors.minNights = `From 1 to ${MAX_NIGHTS} nights`;
  if (max === null || (max !== undefined && (max < 1 || max > MAX_NIGHTS))) errors.maxNights = `Leave it empty, or 1 to ${MAX_NIGHTS} nights`;
  else if (max !== undefined && min !== null && max < min) errors.maxNights = "Can't be fewer than the minimum nights";

  const names = values.fees.map((fee) => fee.name.trim().toLowerCase());
  if (values.fees.length > MAX_FEES) errors.fees = `At most ${MAX_FEES} fees`;
  else if (names.some((name) => !name)) errors.fees = "Each fee needs a name";
  else if (values.fees.some((fee) => fee.name.trim().length > 60)) errors.fees = "A fee's name can be at most 60 characters";
  else if (new Set(names).size < names.length) errors.fees = "Each fee needs a different name";
  else if (values.fees.some((fee) => toCents(fee.amount) === null)) errors.fees = "Each fee needs an amount in pesos";

  return Object.keys(errors).length > 0 ? errors : undefined;
}

// A short worked example of what a stay costs, so the partner sees their numbers add up:
// the minimum stay (at least 2 nights) for as many guests as the place sleeps, weeknights,
// with the required fees and no discount. Only a preview: guests' totals come from /quotes.
function exampleLine(values: PricingValues, perGuest: boolean, sleeps: number) {
  const nightly = toCents(values.nightly);
  if (!nightly) return null;
  const max = wholeNumber(values.maxNights);
  let nights = Math.max(wholeNumber(values.minNights) ?? 1, 2);
  if (max) nights = Math.min(nights, max);
  const guests = Math.max(sleeps, 1);
  const extraGuests = perGuest ? 0 : Math.max(guests - Math.min(values.baseGuests, guests), 0);
  const extraFee = perGuest ? 0 : (toCents(values.extraGuestFee) ?? 0);

  const parts = [`${formatPeso(nightly)} × ${nights} ${nights === 1 ? "night" : "nights"}${perGuest ? ` × ${guests} ${guests === 1 ? "guest" : "guests"}` : ""}`];
  let total = nightly * nights * (perGuest ? guests : 1);
  if (extraGuests > 0 && extraFee > 0) {
    parts.push(`${extraGuests} extra ${extraGuests === 1 ? "guest" : "guests"} × ${formatPeso(extraFee)} × ${nights}`);
    total += extraGuests * extraFee * nights;
  }
  for (const fee of values.fees) {
    const amount = toCents(fee.amount);
    if (!fee.required || !amount) continue;
    const quantity = { booking: 1, night: nights, guest: guests, guest_night: guests * nights, unit: 1 }[fee.chargedPer];
    parts.push(`${fee.name.trim() || "fee"} ${formatPeso(amount * quantity)}`);
    total += amount * quantity;
  }
  return `${nights} weeknights for ${guests} ${guests === 1 ? "guest" : "guests"}: ${formatPeso(total)} (${parts.join(" + ")})`;
}

// An accommodation's price (RAA-105): the nightly price and what changes it, and the extra
// fees. `sleeps` is the guests the place takes (its property info) and caps base occupancy.
export function StayPricingFields({
  values,
  onChange,
  placeType,
  sleeps,
  errors,
}: {
  values: PricingValues;
  onChange: (values: PricingValues) => void;
  placeType: string;
  sleeps: number;
  errors?: PricingErrors;
}) {
  const perGuest = isPerGuest(placeType);
  const set = (patch: Partial<PricingValues>) => onChange({ ...values, ...patch });
  const setFee = (key: number, patch: Partial<FeeValues>) =>
    set({ fees: values.fees.map((fee) => (fee.key === key ? { ...fee, ...patch } : fee)) });
  const example = exampleLine(values, perGuest, sleeps);
  const baseGuests = Math.max(Math.min(values.baseGuests, sleeps), 1);
  const peso = { type: "number", min: 0, step: "0.01", inputMode: "decimal" } as const;

  return (
    <div data-testid="stay-pricing" className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={perGuest ? "Price per guest per night (₱)" : "Nightly price (₱)"}
          name="nightly_price"
          required
          {...peso}
          min={0.01}
          value={values.nightly}
          onChange={(event) => set({ nightly: event.target.value })}
          error={errors?.nightly}
          data-testid="pricing-nightly"
        />
        <Field
          label="Weekend price (₱, optional)"
          name="weekend_price"
          {...peso}
          min={0.01}
          value={values.weekend}
          onChange={(event) => set({ weekend: event.target.value })}
          error={errors?.weekend}
          hint="For Friday and Saturday nights. Empty: the nightly price."
        />
      </div>

      {!perGuest && (
        <div className="flex flex-col gap-4">
          <StepperField
            label={`Price includes up to ${baseGuests} ${baseGuests === 1 ? "guest" : "guests"}`}
            hint={`The place sleeps ${sleeps}.`}
            value={baseGuests}
            min={1}
            max={Math.max(sleeps, 1)}
            onChange={(baseGuests) => set({ baseGuests })}
            data-testid="pricing-base-guests"
          />
          <Field
            label="Extra-guest fee (₱ per guest per night)"
            name="extra_guest_fee"
            {...peso}
            value={values.extraGuestFee}
            onChange={(event) => set({ extraGuestFee: event.target.value })}
            error={errors?.extraGuestFee}
            hint="For each guest above those the price includes. Empty: no fee."
          />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Weekly discount (%)"
          name="weekly_discount"
          type="number"
          min={0}
          max={MAX_DISCOUNT}
          step={1}
          value={values.weeklyDiscount}
          onChange={(event) => set({ weeklyDiscount: event.target.value })}
          error={errors?.weeklyDiscount}
          hint="Off stays of 7 nights or more."
        />
        <Field
          label="Monthly discount (%)"
          name="monthly_discount"
          type="number"
          min={0}
          max={MAX_DISCOUNT}
          step={1}
          value={values.monthlyDiscount}
          onChange={(event) => set({ monthlyDiscount: event.target.value })}
          error={errors?.monthlyDiscount}
          hint="Off stays of 28 nights or more."
        />
        <Field
          label="Minimum nights"
          name="min_nights"
          type="number"
          required
          min={1}
          max={MAX_NIGHTS}
          step={1}
          value={values.minNights}
          onChange={(event) => set({ minNights: event.target.value })}
          error={errors?.minNights}
        />
        <Field
          label="Maximum nights (optional)"
          name="max_nights"
          type="number"
          min={1}
          max={MAX_NIGHTS}
          step={1}
          value={values.maxNights}
          onChange={(event) => set({ maxNights: event.target.value })}
          error={errors?.maxNights}
          hint="Empty: no maximum."
        />
      </div>

      <div className="flex flex-col gap-3" data-testid="pricing-fees">
        <div className="flex flex-col">
          <span className="text-sm font-semibold">Fees</span>
          <span className="text-xs text-muted">
            A cleaning fee, an environmental fee, an extra bed. Optional ones are add-ons guests choose.
          </span>
        </div>
        {values.fees.map((fee, index) => (
          <div key={fee.key} className="flex flex-col gap-3 rounded-control border border-line p-4" data-testid="pricing-fee">
            <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1.4fr]">
              <Field
                label="Name"
                name={`fee_name_${index}`}
                required
                maxLength={60}
                value={fee.name}
                onChange={(event) => setFee(fee.key, { name: event.target.value })}
                placeholder="e.g. Cleaning fee"
              />
              <Field
                label="Amount (₱)"
                name={`fee_amount_${index}`}
                required
                {...peso}
                value={fee.amount}
                onChange={(event) => setFee(fee.key, { amount: event.target.value })}
              />
              <SelectField
                label="Charged"
                name={`fee_charged_per_${index}`}
                value={fee.chargedPer}
                onChange={(event) => setFee(fee.key, { chargedPer: event.target.value as ChargedPer })}
                options={CHARGED_PER}
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CheckboxField
                label="Optional: guests choose it as an add-on"
                checked={!fee.required}
                onChange={(event) => setFee(fee.key, { required: !event.target.checked })}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => set({ fees: values.fees.filter((other) => other.key !== fee.key) })}
              >
                Remove
              </Button>
            </div>
          </div>
        ))}
        {errors?.fees && (
          <p role="alert" className="text-xs text-danger">
            {errors.fees}
          </p>
        )}
        {values.fees.length < MAX_FEES && (
          <Button
            type="button"
            variant="soft"
            size="sm"
            className="self-start"
            onClick={() => set({ fees: [...values.fees, newFee()] })}
            data-testid="pricing-add-fee"
          >
            Add a fee
          </Button>
        )}
      </div>

      {example && (
        <p className="rounded-control bg-surface-2 px-4 py-3 text-sm text-muted" data-testid="pricing-example">
          For example, {example}.
        </p>
      )}
    </div>
  );
}
