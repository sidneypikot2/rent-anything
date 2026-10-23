"use client";

import type { ReactNode } from "react";
import type { components } from "@/api/schema";
import { VEHICLE_AMENITY_LABELS } from "@/components/listings/vehicle-labels";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { SelectField } from "@/components/ui/select-field";
import { formatPeso, fromCents, toCents } from "@/lib/money";
import { VEHICLE_CHARGED_PER } from "@/lib/pricing";
import { FeeFields, feesError, newFee, toFeeValues, type FeeValues } from "./fee-fields";

type VehicleRate = components["schemas"]["vehicle_rate"];
type VehicleRateBody = components["schemas"]["vehicle_rate_body"];
type ListingFee = components["schemas"]["listing_fee"];

// VehicleRate's limits (RAA-149).
const WEEK_DAYS = 7;
const MONTH_DAYS = 30;
const HALF_DAY_HOURS = { min: 2, max: 12 };
const MAX_DAYS = 365;
const MAX_KM = 2000;

// Bringing the vehicle to the guest, or collecting it at the end: not offered (null), free (0)
// or a fee.
export type Service = "none" | "free" | "fee";

// A vehicle rental's price (RAA-150) as typed: pesos and counts are text until saved.
export type VehiclePricingValues = {
  daily: string;
  halfDay: string;
  halfDayHours: string;
  hourly: string;
  weekly: string;
  monthly: string;
  deposit: string;
  delivery: Service;
  deliveryFee: string;
  pickup: Service;
  pickupFee: string;
  minDays: string;
  kmLimit: string;
  excessKmFee: string;
  fees: FeeValues[];
};

export const NEW_VEHICLE_PRICING: VehiclePricingValues = {
  daily: "",
  halfDay: "",
  halfDayHours: "4",
  hourly: "",
  weekly: "",
  monthly: "",
  deposit: "",
  delivery: "none",
  deliveryFee: "",
  pickup: "none",
  pickupFee: "",
  minDays: "1",
  kmLimit: "",
  excessKmFee: "",
  fees: [],
};

const peso = (cents: number | null | undefined) => (cents ? fromCents(cents) : "");
const service = (cents: number | null | undefined): Service => (cents === null || cents === undefined ? "none" : cents === 0 ? "free" : "fee");

// A saved listing's pricing as the fields hold it. A back-filled daily price of 0 starts empty.
export function toVehiclePricingValues(rate: VehicleRate | null, fees: ListingFee[]): VehiclePricingValues {
  if (!rate) return { ...NEW_VEHICLE_PRICING, fees: toFeeValues(fees) };
  return {
    daily: peso(rate.daily_price_cents),
    halfDay: peso(rate.half_day_price_cents),
    halfDayHours: String(rate.half_day_hours),
    hourly: peso(rate.hourly_price_cents),
    weekly: peso(rate.weekly_price_cents),
    monthly: peso(rate.monthly_price_cents),
    deposit: peso(rate.security_deposit_cents),
    delivery: service(rate.delivery_fee_cents),
    deliveryFee: peso(rate.delivery_fee_cents),
    pickup: service(rate.return_pickup_fee_cents),
    pickupFee: peso(rate.return_pickup_fee_cents),
    minDays: String(rate.min_rental_days),
    kmLimit: rate.km_limit_per_day ? String(rate.km_limit_per_day) : "",
    excessKmFee: peso(rate.excess_km_fee_cents),
    fees: toFeeValues(fees),
  };
}

function wholeNumber(text: string): number | null {
  return /^\d+$/.test(text.trim()) ? Number(text.trim()) : null;
}

const optionalCents = (text: string) => (text.trim() ? toCents(text) : null);
const serviceCents = (choice: Service, fee: string) => (choice === "none" ? null : choice === "free" ? 0 : toCents(fee));

// What the API takes. Call it after vehiclePricingErrors has passed.
export function toVehicleRateBody(values: VehiclePricingValues): VehicleRateBody {
  const kmLimit = wholeNumber(values.kmLimit);
  return {
    daily_price_cents: toCents(values.daily) ?? 0,
    half_day_price_cents: optionalCents(values.halfDay),
    half_day_hours: wholeNumber(values.halfDayHours) ?? 4,
    hourly_price_cents: optionalCents(values.hourly),
    weekly_price_cents: optionalCents(values.weekly),
    monthly_price_cents: optionalCents(values.monthly),
    security_deposit_cents: optionalCents(values.deposit) ?? 0,
    delivery_fee_cents: serviceCents(values.delivery, values.deliveryFee),
    return_pickup_fee_cents: serviceCents(values.pickup, values.pickupFee),
    min_rental_days: wholeNumber(values.minDays) ?? 1,
    km_limit_per_day: kmLimit,
    excess_km_fee_cents: kmLimit ? optionalCents(values.excessKmFee) : null,
  };
}

export type VehiclePricingErrors = Partial<
  Record<
    | "daily"
    | "halfDay"
    | "halfDayHours"
    | "hourly"
    | "weekly"
    | "monthly"
    | "deposit"
    | "deliveryFee"
    | "pickupFee"
    | "minDays"
    | "kmLimit"
    | "excessKmFee"
    | "fees",
    string
  >
>;

// What the pricing still needs before it can be saved, or undefined when nothing. The same
// rules as VehicleRate, so a mistake shows here rather than as a 422.
// The vehicle's ticked inclusions (`included`) can't also be charged as fees.
export function vehiclePricingErrors(values: VehiclePricingValues, included: string[]): VehiclePricingErrors | undefined {
  const errors: VehiclePricingErrors = {};
  const daily = toCents(values.daily);
  if (!daily) errors.daily = "Set a daily price above ₱0";
  const positive = (text: string) => !text.trim() || !!toCents(text);

  const halfDay = optionalCents(values.halfDay);
  if (!positive(values.halfDay)) errors.halfDay = "Leave it empty, or set a price above ₱0";
  else if (halfDay && daily && halfDay >= daily) errors.halfDay = "Must be less than the daily price";
  const hours = wholeNumber(values.halfDayHours);
  if (hours === null || hours < HALF_DAY_HOURS.min || hours > HALF_DAY_HOURS.max) {
    errors.halfDayHours = `From ${HALF_DAY_HOURS.min} to ${HALF_DAY_HOURS.max} hours`;
  }
  const hourly = optionalCents(values.hourly);
  const above = halfDay || daily;
  if (!positive(values.hourly)) errors.hourly = "Leave it empty, or set a price above ₱0";
  else if (hourly && above && hourly >= above) errors.hourly = `Must be less than the ${halfDay ? "half-day" : "daily"} price`;

  const weekly = optionalCents(values.weekly);
  if (!positive(values.weekly)) errors.weekly = "Leave it empty, or set a price above ₱0";
  else if (weekly && daily && weekly > daily * WEEK_DAYS) errors.weekly = `Can't be more than ${WEEK_DAYS} days at the daily price`;
  const monthly = optionalCents(values.monthly);
  if (!positive(values.monthly)) errors.monthly = "Leave it empty, or set a price above ₱0";
  else if (monthly && daily && monthly > daily * MONTH_DAYS) errors.monthly = `Can't be more than ${MONTH_DAYS} days at the daily price`;

  if (values.deposit.trim() && toCents(values.deposit) === null) errors.deposit = "Enter an amount in pesos";
  if (values.delivery === "fee" && !toCents(values.deliveryFee)) errors.deliveryFee = "Set a fee above ₱0, or choose Free";
  if (values.pickup === "fee" && !toCents(values.pickupFee)) errors.pickupFee = "Set a fee above ₱0, or choose Free";

  const minDays = wholeNumber(values.minDays);
  if (minDays === null || minDays < 1 || minDays > MAX_DAYS) errors.minDays = `From 1 to ${MAX_DAYS} days`;
  const km = values.kmLimit.trim() ? wholeNumber(values.kmLimit) : undefined;
  if (km === null || (km !== undefined && (km < 1 || km > MAX_KM))) errors.kmLimit = `Leave it empty, or 1 to ${MAX_KM} km`;
  if (values.excessKmFee.trim()) {
    if (toCents(values.excessKmFee) === null) errors.excessKmFee = "Enter an amount in pesos";
    else if (km === undefined) errors.excessKmFee = "Needs a daily km limit";
  }

  const fees = feesError(values.fees) ?? includedFeeError(values.fees, included);
  if (fees) errors.fees = fees;

  return Object.keys(errors).length > 0 ? errors : undefined;
}

// The fees PH rental shops charge on top, one click each: a row with its name and how it's
// charged, the partner types the amount.
const FEE_PRESETS: { label: string; fee: Partial<FeeValues> }[] = [
  { label: "Late return", fee: { name: "Late return", chargedPer: "hour", required: true } },
  { label: "Passenger helmet", fee: { name: "Passenger helmet", chargedPer: "day", required: false } },
  { label: "Fuel refill", fee: { name: "Fuel refill", chargedPer: "booking", required: false } },
  { label: "Cleaning", fee: { name: "Cleaning fee", chargedPer: "booking", required: true } },
  { label: "Airport or port delivery", fee: { name: "Airport or port delivery", chargedPer: "booking", required: false } },
  { label: "Out-of-area delivery", fee: { name: "Out-of-area delivery", chargedPer: "booking", required: false } },
  { label: "Insurance add-on", fee: { name: "Insurance add-on", chargedPer: "day", required: false } },
];

// The fee names that mean an inclusion: its own label, and the preset that charges for it.
const INCLUDED_FEE_NAMES: Record<string, string[]> = {
  passenger_helmet: ["Passenger helmet"],
  full_tank: ["Fuel refill"],
  insurance: ["Insurance add-on"],
};

function includedFeeNames(amenity: string) {
  return [VEHICLE_AMENITY_LABELS[amenity], ...(INCLUDED_FEE_NAMES[amenity] ?? [])]
    .filter(Boolean)
    .map((name) => name.toLowerCase());
}

// The inclusion this fee name charges for, if it's ticked.
function includedBy(name: string, included: string[]) {
  const key = name.trim().toLowerCase();
  return included.find((amenity) => includedFeeNames(amenity).includes(key));
}

function includedFeeError(fees: FeeValues[], included: string[]) {
  const amenity = fees.map((fee) => includedBy(fee.name, included)).find(Boolean);
  if (!amenity) return undefined;
  return `${VEHICLE_AMENITY_LABELS[amenity]} is ticked as coming with the vehicle: remove this fee, or untick it there`;
}

const SERVICES: { value: Service; label: string }[] = [
  { value: "none", label: "Not offered" },
  { value: "free", label: "Free" },
  { value: "fee", label: "For a fee" },
];

// "₱450 a day": a longer rental's total over its days.
function perDay(text: string, days: number) {
  const cents = toCents(text);
  return cents ? `${formatPeso(Math.round(cents / days))} a day` : undefined;
}

// A vehicle rental's price (RAA-150): the daily price and the shorter and longer rates, the
// deposit, delivery and pick-up, the km limit and the extra fees. Guests see it; the price is
// still confirmed with the partner, as checkout doesn't quote rentals yet.
export function VehiclePricingFields({
  values,
  onChange,
  errors,
  included,
}: {
  values: VehiclePricingValues;
  onChange: (values: VehiclePricingValues) => void;
  errors?: VehiclePricingErrors;
  included: string[];
}) {
  const set = (patch: Partial<VehiclePricingValues>) => onChange({ ...values, ...patch });
  const money = { type: "number", min: 0, step: "0.01", inputMode: "decimal" } as const;
  const count = { type: "number", step: 1, inputMode: "numeric" } as const;
  const presets = FEE_PRESETS.filter(
    (preset) =>
      !includedBy(preset.fee.name ?? "", included) &&
      !values.fees.some((fee) => fee.name.trim().toLowerCase() === preset.fee.name?.toLowerCase()),
  );
  const weeklyHint = perDay(values.weekly, WEEK_DAYS);
  const monthlyHint = perDay(values.monthly, MONTH_DAYS);

  return (
    <div data-testid="vehicle-pricing" className="flex flex-col gap-6">
      <p className="text-sm text-muted">
        Guests see these prices on your listing. You confirm the final price with them when you accept a booking.
      </p>

      <PricingGroup title="Rental rates">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Daily price (₱)"
            name="daily_price"
            required
            {...money}
            min={0.01}
            value={values.daily}
            onChange={(event) => set({ daily: event.target.value })}
            error={errors?.daily}
            hint="For 24 hours."
            data-testid="pricing-daily"
          />
          <Field
            label="Hourly price (₱, optional)"
            name="hourly_price"
            {...money}
            min={0.01}
            value={values.hourly}
            onChange={(event) => set({ hourly: event.target.value })}
            error={errors?.hourly}
            hint="Empty: not rented by the hour."
          />
          <Field
            label="Half-day price (₱, optional)"
            name="half_day_price"
            {...money}
            min={0.01}
            value={values.halfDay}
            onChange={(event) => set({ halfDay: event.target.value })}
            error={errors?.halfDay}
            hint="Less than the daily price. Empty: not offered."
            data-testid="pricing-half-day"
          />
          <Field
            label="Half day (hours)"
            name="half_day_hours"
            {...count}
            min={HALF_DAY_HOURS.min}
            max={HALF_DAY_HOURS.max}
            value={values.halfDayHours}
            onChange={(event) => set({ halfDayHours: event.target.value })}
            error={errors?.halfDayHours}
          />
          <Field
            label="Weekly price (₱, optional)"
            name="weekly_price"
            {...money}
            min={0.01}
            value={values.weekly}
            onChange={(event) => set({ weekly: event.target.value })}
            error={errors?.weekly}
            hint={weeklyHint ?? `The total for ${WEEK_DAYS} days.`}
          />
          <Field
            label="Monthly price (₱, optional)"
            name="monthly_price"
            {...money}
            min={0.01}
            value={values.monthly}
            onChange={(event) => set({ monthly: event.target.value })}
            error={errors?.monthly}
            hint={monthlyHint ?? `The total for ${MONTH_DAYS} days.`}
          />
        </div>
      </PricingGroup>

      <PricingGroup title="Deposit and limits">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Security deposit (₱)"
            name="security_deposit"
            {...money}
            value={values.deposit}
            onChange={(event) => set({ deposit: event.target.value })}
            error={errors?.deposit}
            hint="Refundable, held at pick-up. Empty: none."
          />
          <Field
            label="Minimum rental (days)"
            name="min_rental_days"
            required
            {...count}
            min={1}
            max={MAX_DAYS}
            value={values.minDays}
            onChange={(event) => set({ minDays: event.target.value })}
            error={errors?.minDays}
          />
          <Field
            label="Km limit per day (optional)"
            name="km_limit_per_day"
            {...count}
            min={1}
            max={MAX_KM}
            value={values.kmLimit}
            onChange={(event) => set({ kmLimit: event.target.value })}
            error={errors?.kmLimit}
            hint="Empty: unlimited."
          />
          <Field
            label="Fee per extra km (₱, optional)"
            name="excess_km_fee"
            {...money}
            value={values.excessKmFee}
            onChange={(event) => set({ excessKmFee: event.target.value })}
            error={errors?.excessKmFee}
            disabled={!values.kmLimit.trim()}
            hint="Above the daily limit."
          />
        </div>
      </PricingGroup>

      <PricingGroup title="Delivery and pick-up" data-testid="pricing-delivery">
        <div className="grid gap-4 sm:grid-cols-2">
          <ServiceFields
            label="Delivery to the guest"
            feeLabel="Delivery fee (₱)"
            name="delivery"
            choice={values.delivery}
            fee={values.deliveryFee}
            error={errors?.deliveryFee}
            onChange={(delivery, deliveryFee) => set({ delivery, deliveryFee })}
          />
          <ServiceFields
            label="Pick-up from the guest at the end"
            feeLabel="Pick-up fee (₱)"
            name="return_pickup"
            choice={values.pickup}
            fee={values.pickupFee}
            error={errors?.pickupFee}
            onChange={(pickup, pickupFee) => set({ pickup, pickupFee })}
          />
        </div>
      </PricingGroup>

      <div className="flex flex-col gap-3">
        <FeeFields
          fees={values.fees}
          onChange={(fees) => set({ fees })}
          error={errors?.fees}
          hint="Late return, a passenger helmet, a fuel refill. Optional ones are add-ons guests choose."
          chargedPer={VEHICLE_CHARGED_PER}
        />
        {presets.length > 0 && values.fees.length < 20 && (
          <div className="flex flex-col gap-2" data-testid="pricing-fee-presets">
            <span className="text-xs text-muted">Common fees:</span>
            <div className="flex flex-wrap gap-2">
              {presets.map((preset) => (
                <Button
                  key={preset.label}
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => set({ fees: [...values.fees, newFee(preset.fee)] })}
                >
                  + {preset.label}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// A headed group of pricing fields.
function PricingGroup({ title, children, ...props }: { title: string; children: ReactNode; "data-testid"?: string }) {
  return (
    <fieldset className="flex flex-col" {...props}>
      <legend className="mb-3 text-sm font-semibold">{title}</legend>
      {children}
    </fieldset>
  );
}

// A service's choice, with its fee beside it when it's charged. Both services' rows line up.
function ServiceFields({
  label,
  feeLabel,
  name,
  choice,
  fee,
  error,
  onChange,
}: {
  label: string;
  feeLabel: string;
  name: string;
  choice: Service;
  fee: string;
  error?: string;
  onChange: (choice: Service, fee: string) => void;
}) {
  return (
    <>
      <SelectField
        label={label}
        name={name}
        value={choice}
        onChange={(event) => onChange(event.target.value as Service, fee)}
        options={SERVICES}
        data-testid={`pricing-${name}`}
      />
      {choice === "fee" ? (
        <Field
          label={feeLabel}
          name={`${name}_fee`}
          required
          type="number"
          min={0.01}
          step="0.01"
          inputMode="decimal"
          value={fee}
          onChange={(event) => onChange(choice, event.target.value)}
          error={error}
          data-testid={`pricing-${name}-fee`}
        />
      ) : (
        <div aria-hidden className="max-sm:hidden" />
      )}
    </>
  );
}
