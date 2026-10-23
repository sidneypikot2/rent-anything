"use client";

import type { ReactNode } from "react";
import type { components } from "@/api/schema";
import { hasDriverOption, isFourWheel, VEHICLE_AMENITY_LABELS } from "@/components/listings/vehicle-labels";
import { Button } from "@/components/ui/button";
import { CheckboxField } from "@/components/ui/checkbox-field";
import { ChoiceCards } from "@/components/ui/choice-cards";
import { Field } from "@/components/ui/field";
import { SelectField } from "@/components/ui/select-field";
import { formatPeso, fromCents, toCents } from "@/lib/money";
import { VEHICLE_CHARGED_PER } from "@/lib/pricing";
import { FeeFields, feesError, newFee, toFeeValues, type FeeValues } from "./fee-fields";

type VehicleRate = components["schemas"]["vehicle_rate"];
type VehicleRateBody = components["schemas"]["vehicle_rate_body"];
type ListingFee = components["schemas"]["listing_fee"];
type Driving = components["schemas"]["vehicle_driving"];

// VehicleRate's limits (RAA-149).
const WEEK_DAYS = 7;
const MONTH_DAYS = 30;
const HALF_DAY_HOURS = { min: 2, max: 12 };
const MAX_DAYS = 365;
const MAX_KM = 2000;

// Bringing the vehicle to the guest, or collecting it at the end: not offered (null), free (0)
// or a fee.
export type Service = "none" | "free" | "fee";

// A vehicle rental's price (RAA-150) as typed: pesos and counts are text until saved. Each
// optional rate has its own switch (`…On`); text typed under a switch that's off is kept, so
// switching it back on brings it back, but it isn't saved.
export type VehiclePricingValues = {
  daily: string;
  minDays: string;
  halfDayOn: boolean;
  halfDay: string;
  halfDayHours: string;
  hourlyOn: boolean;
  hourly: string;
  weeklyOn: boolean;
  weekly: string;
  monthlyOn: boolean;
  monthly: string;
  depositOn: boolean;
  deposit: string;
  kmLimitOn: boolean;
  kmLimit: string;
  excessKmFee: string;
  delivery: Service;
  deliveryFee: string;
  pickup: Service;
  pickupFee: string;
  driving: Driving;
  driverFee: string;
  fees: FeeValues[];
};

export const NEW_VEHICLE_PRICING: VehiclePricingValues = {
  daily: "",
  minDays: "1",
  halfDayOn: false,
  halfDay: "",
  halfDayHours: "4",
  hourlyOn: false,
  hourly: "",
  weeklyOn: false,
  weekly: "",
  monthlyOn: false,
  monthly: "",
  depositOn: false,
  deposit: "",
  kmLimitOn: false,
  kmLimit: "",
  excessKmFee: "",
  delivery: "none",
  deliveryFee: "",
  pickup: "none",
  pickupFee: "",
  driving: "self_drive",
  driverFee: "",
  fees: [],
};

const peso = (cents: number | null | undefined) => (cents ? fromCents(cents) : "");
const service = (cents: number | null | undefined): Service => (cents === null || cents === undefined ? "none" : cents === 0 ? "free" : "fee");

// A saved listing's pricing as the fields hold it. A back-filled daily price of 0 starts empty.
export function toVehiclePricingValues(rate: VehicleRate | null, fees: ListingFee[]): VehiclePricingValues {
  if (!rate) return { ...NEW_VEHICLE_PRICING, fees: toFeeValues(fees) };
  return {
    daily: peso(rate.daily_price_cents),
    minDays: String(rate.min_rental_days),
    halfDayOn: !!rate.half_day_price_cents,
    halfDay: peso(rate.half_day_price_cents),
    halfDayHours: String(rate.half_day_hours),
    hourlyOn: !!rate.hourly_price_cents,
    hourly: peso(rate.hourly_price_cents),
    weeklyOn: !!rate.weekly_price_cents,
    weekly: peso(rate.weekly_price_cents),
    monthlyOn: !!rate.monthly_price_cents,
    monthly: peso(rate.monthly_price_cents),
    depositOn: !!rate.security_deposit_cents,
    deposit: peso(rate.security_deposit_cents),
    kmLimitOn: !!rate.km_limit_per_day,
    kmLimit: rate.km_limit_per_day ? String(rate.km_limit_per_day) : "",
    excessKmFee: peso(rate.excess_km_fee_cents),
    delivery: service(rate.delivery_fee_cents),
    deliveryFee: peso(rate.delivery_fee_cents),
    pickup: service(rate.return_pickup_fee_cents),
    pickupFee: peso(rate.return_pickup_fee_cents),
    driving: rate.driving,
    driverFee: peso(rate.driver_fee_cents),
    fees: toFeeValues(fees),
  };
}

function wholeNumber(text: string): number | null {
  return /^\d+$/.test(text.trim()) ? Number(text.trim()) : null;
}

const optionalCents = (text: string) => (text.trim() ? toCents(text) : null);
const switchedCents = (on: boolean, text: string) => (on ? optionalCents(text) : null);
const serviceCents = (choice: Service, fee: string) => (choice === "none" ? null : choice === "free" ? 0 : toCents(fee));

// What the API takes. Call it after vehiclePricingErrors has passed.
export function toVehicleRateBody(values: VehiclePricingValues): VehicleRateBody {
  const kmLimit = values.kmLimitOn ? wholeNumber(values.kmLimit) : null;
  return {
    daily_price_cents: toCents(values.daily) ?? 0,
    half_day_price_cents: switchedCents(values.halfDayOn, values.halfDay),
    half_day_hours: wholeNumber(values.halfDayHours) ?? 4,
    hourly_price_cents: switchedCents(values.hourlyOn, values.hourly),
    weekly_price_cents: switchedCents(values.weeklyOn, values.weekly),
    monthly_price_cents: switchedCents(values.monthlyOn, values.monthly),
    security_deposit_cents: switchedCents(values.depositOn, values.deposit) ?? 0,
    delivery_fee_cents: serviceCents(values.delivery, values.deliveryFee),
    return_pickup_fee_cents: serviceCents(values.pickup, values.pickupFee),
    min_rental_days: wholeNumber(values.minDays) ?? 1,
    km_limit_per_day: kmLimit,
    excess_km_fee_cents: kmLimit ? optionalCents(values.excessKmFee) : null,
    driving: values.driving,
    driver_fee_cents: values.driving === "either" ? toCents(values.driverFee) : null,
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
    | "driverFee"
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
  const minDays = wholeNumber(values.minDays);
  if (minDays === null || minDays < 1 || minDays > MAX_DAYS) errors.minDays = `From 1 to ${MAX_DAYS} days`;

  // A switched-on rate needs a price above ₱0.
  const rate = (on: boolean, text: string, name: string) => {
    if (!on) return { cents: null, error: undefined };
    const cents = toCents(text);
    return cents ? { cents, error: undefined } : { cents: null, error: `Enter the ${name.toLowerCase()} price, or untick ${name}` };
  };

  const halfDay = rate(values.halfDayOn, values.halfDay, "Half-day");
  errors.halfDay = halfDay.error ?? (halfDay.cents && daily && halfDay.cents >= daily ? "Must be less than the daily price" : undefined);
  const hours = wholeNumber(values.halfDayHours);
  if (values.halfDayOn && (hours === null || hours < HALF_DAY_HOURS.min || hours > HALF_DAY_HOURS.max)) {
    errors.halfDayHours = `From ${HALF_DAY_HOURS.min} to ${HALF_DAY_HOURS.max} hours`;
  }
  const hourly = rate(values.hourlyOn, values.hourly, "Hourly");
  const above = halfDay.cents || daily;
  errors.hourly =
    hourly.error ??
    (hourly.cents && above && hourly.cents >= above ? `Must be less than the ${halfDay.cents ? "half-day" : "daily"} price` : undefined);

  const weekly = rate(values.weeklyOn, values.weekly, "Weekly");
  errors.weekly =
    weekly.error ?? (weekly.cents && daily && weekly.cents > daily * WEEK_DAYS ? `Can't be more than ${WEEK_DAYS} days at the daily price` : undefined);
  const monthly = rate(values.monthlyOn, values.monthly, "Monthly");
  errors.monthly =
    monthly.error ??
    (monthly.cents && daily && monthly.cents > daily * MONTH_DAYS ? `Can't be more than ${MONTH_DAYS} days at the daily price` : undefined);

  if (values.depositOn && !toCents(values.deposit)) errors.deposit = "Enter the deposit, or untick it";

  if (values.kmLimitOn) {
    const km = wholeNumber(values.kmLimit);
    if (km === null || km < 1 || km > MAX_KM) errors.kmLimit = `From 1 to ${MAX_KM} km, or untick it`;
    if (values.excessKmFee.trim() && toCents(values.excessKmFee) === null) errors.excessKmFee = "Enter an amount in pesos";
  }

  if (values.delivery === "fee" && !toCents(values.deliveryFee)) errors.deliveryFee = "Set a fee above ₱0, or choose Free";
  if (values.pickup === "fee" && !toCents(values.pickupFee)) errors.pickupFee = "Set a fee above ₱0, or choose Free";
  if (values.driving === "either" && !toCents(values.driverFee)) {
    errors.driverFee = "Set the driver's fee per day, or pick another option";
  }

  const fees = feesError(values.fees) ?? includedFeeError(values.fees, included);
  if (fees) errors.fees = fees;

  for (const key of Object.keys(errors) as (keyof VehiclePricingErrors)[]) if (!errors[key]) delete errors[key];
  return Object.keys(errors).length > 0 ? errors : undefined;
}

// The fees PH rental shops charge on top, one click each: a row with its name and how it's
// charged, the partner types the amount. Motorbikes and trikes have their own list. Delivery and
// a driver have their own sections, so neither is a preset.
const TWO_WHEEL_FEE_PRESETS: { label: string; fee: Partial<FeeValues> }[] = [
  { label: "Late return", fee: { name: "Late return", chargedPer: "hour", required: true } },
  { label: "Passenger helmet", fee: { name: "Passenger helmet", chargedPer: "day", required: false } },
  { label: "Fuel refill", fee: { name: "Fuel refill", chargedPer: "booking", required: false } },
  { label: "Cleaning", fee: { name: "Cleaning fee", chargedPer: "booking", required: true } },
  { label: "Insurance add-on", fee: { name: "Insurance add-on", chargedPer: "day", required: false } },
];

// Cars, vans and multicabs.
const CAR_FEE_PRESETS: { label: string; fee: Partial<FeeValues> }[] = [
  { label: "Late return", fee: { name: "Late return", chargedPer: "hour", required: true } },
  { label: "Child seat", fee: { name: "Child seat", chargedPer: "day", required: false } },
  { label: "Out-of-town use", fee: { name: "Out-of-town use", chargedPer: "day", required: false } },
  { label: "Fuel refill", fee: { name: "Fuel refill", chargedPer: "booking", required: false } },
  { label: "Toll / RFID load", fee: { name: "Toll / RFID load", chargedPer: "booking", required: false } },
  { label: "Cleaning", fee: { name: "Cleaning fee", chargedPer: "booking", required: true } },
  { label: "Insurance add-on", fee: { name: "Insurance add-on", chargedPer: "day", required: false } },
];

// The fee names that mean an inclusion: its own label, and the preset that charges for it.
const INCLUDED_FEE_NAMES: Record<string, string[]> = {
  passenger_helmet: ["Passenger helmet"],
  full_tank: ["Fuel refill"],
  insurance: ["Insurance add-on"],
  child_seat: ["Child seat"],
  rfid_toll: ["Toll / RFID load"],
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

const DRIVING: { value: Driving; label: string; description: string }[] = [
  { value: "self_drive", label: "Self-drive only", description: "The guest drives." },
  { value: "with_driver", label: "With driver only", description: "Your driver drives; the daily price includes them." },
  { value: "either", label: "Self-drive or with driver", description: "The guest chooses; a driver costs extra per day." },
];

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

// A vehicle rental's price (RAA-150), top to bottom: the daily price, who drives (not for a
// motorbike), the other rental lengths, the deposit, the km limit, delivery and pick-up, then
// the extra fees. Everything optional is a tick box that opens its fields. Guests see it; the price is still confirmed with the partner,
// as checkout doesn't quote rentals yet.
export function VehiclePricingFields({
  values,
  onChange,
  errors,
  included,
  slug,
}: {
  values: VehiclePricingValues;
  onChange: (values: VehiclePricingValues) => void;
  errors?: VehiclePricingErrors;
  included: string[];
  slug: string | undefined;
}) {
  const set = (patch: Partial<VehiclePricingValues>) => onChange({ ...values, ...patch });
  const money = { type: "number", min: 0, step: "0.01", inputMode: "decimal" } as const;
  const count = { type: "number", step: 1, inputMode: "numeric" } as const;
  const presets = (isFourWheel(slug) ? CAR_FEE_PRESETS : TWO_WHEEL_FEE_PRESETS).filter(
    (preset) =>
      !includedBy(preset.fee.name ?? "", included) &&
      !values.fees.some((fee) => fee.name.trim().toLowerCase() === preset.fee.name?.toLowerCase()),
  );
  const weeklyHint = perDay(values.weekly, WEEK_DAYS);
  const monthlyHint = perDay(values.monthly, MONTH_DAYS);

  return (
    <div data-testid="vehicle-pricing" className="flex flex-col">
      <p className="pb-6 text-sm text-muted">
        Guests see these prices on your listing. You confirm the final price with them when you accept a booking.
      </p>

      <PricingSection title="Daily price" intro="What a 24-hour rental costs. Every vehicle needs one.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Price per day (₱)"
            name="daily_price"
            required
            {...money}
            min={0.01}
            value={values.daily}
            onChange={(event) => set({ daily: event.target.value })}
            error={errors?.daily}
            data-testid="pricing-daily"
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
        </div>
      </PricingSection>

      {hasDriverOption(slug) && (
        <PricingSection title="Driving" intro="Whether the guest drives, or you send a driver." data-testid="pricing-driving">
          <ChoiceCards
            legend="Who drives"
            name="driving"
            choices={DRIVING}
            value={values.driving}
            onChange={(driving) => set({ driving: driving as Driving })}
            columns={1}
          />
          {values.driving === "either" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Driver fee per day (₱)"
                name="driver_fee"
                required
                {...money}
                min={0.01}
                value={values.driverFee}
                onChange={(event) => set({ driverFee: event.target.value })}
                error={errors?.driverFee}
                hint="Added to the daily price when the guest wants a driver."
                data-testid="pricing-driver-fee"
              />
            </div>
          )}
        </PricingSection>
      )}

      <PricingSection title="Other rental lengths" intro="Tick the ones you offer.">
        <OptionalRate label="Half-day" name="half_day" on={values.halfDayOn} onToggle={(halfDayOn) => set({ halfDayOn })}>
          <Field
            label="Half-day price (₱)"
            name="half_day_price"
            {...money}
            min={0.01}
            value={values.halfDay}
            onChange={(event) => set({ halfDay: event.target.value })}
            error={errors?.halfDay}
            hint="Less than the daily price."
            data-testid="pricing-half-day"
          />
          <Field
            label="Hours in a half day"
            name="half_day_hours"
            {...count}
            min={HALF_DAY_HOURS.min}
            max={HALF_DAY_HOURS.max}
            value={values.halfDayHours}
            onChange={(event) => set({ halfDayHours: event.target.value })}
            error={errors?.halfDayHours}
          />
        </OptionalRate>
        <OptionalRate label="Hourly" name="hourly" on={values.hourlyOn} onToggle={(hourlyOn) => set({ hourlyOn })}>
          <Field
            label="Price per hour (₱)"
            name="hourly_price"
            {...money}
            min={0.01}
            value={values.hourly}
            onChange={(event) => set({ hourly: event.target.value })}
            error={errors?.hourly}
          />
        </OptionalRate>
        <OptionalRate label="Weekly" name="weekly" on={values.weeklyOn} onToggle={(weeklyOn) => set({ weeklyOn })}>
          <Field
            label={`Price for ${WEEK_DAYS} days (₱)`}
            name="weekly_price"
            {...money}
            min={0.01}
            value={values.weekly}
            onChange={(event) => set({ weekly: event.target.value })}
            error={errors?.weekly}
            hint={weeklyHint}
          />
        </OptionalRate>
        <OptionalRate label="Monthly" name="monthly" on={values.monthlyOn} onToggle={(monthlyOn) => set({ monthlyOn })}>
          <Field
            label={`Price for ${MONTH_DAYS} days (₱)`}
            name="monthly_price"
            {...money}
            min={0.01}
            value={values.monthly}
            onChange={(event) => set({ monthly: event.target.value })}
            error={errors?.monthly}
            hint={monthlyHint}
          />
        </OptionalRate>
      </PricingSection>

      <PricingSection title="Security deposit" intro="Money held at pick-up and returned with the vehicle.">
        <OptionalRate
          label="Ask for a deposit"
          name="deposit"
          on={values.depositOn}
          onToggle={(depositOn) => set({ depositOn })}
        >
          <Field
            label="Deposit (₱)"
            name="security_deposit"
            {...money}
            min={0.01}
            value={values.deposit}
            onChange={(event) => set({ deposit: event.target.value })}
            error={errors?.deposit}
            data-testid="pricing-deposit"
          />
        </OptionalRate>
      </PricingSection>

      <PricingSection title="Distance" intro="Without a limit, guests ride as far as they like.">
        <OptionalRate
          label="Limit the km per day"
          name="km_limit"
          on={values.kmLimitOn}
          onToggle={(kmLimitOn) => set({ kmLimitOn })}
        >
          <Field
            label="Km per day"
            name="km_limit_per_day"
            {...count}
            min={1}
            max={MAX_KM}
            value={values.kmLimit}
            onChange={(event) => set({ kmLimit: event.target.value })}
            error={errors?.kmLimit}
          />
          <Field
            label="Fee per extra km (₱)"
            name="excess_km_fee"
            {...money}
            value={values.excessKmFee}
            onChange={(event) => set({ excessKmFee: event.target.value })}
            error={errors?.excessKmFee}
            hint="Empty: no charge past the limit."
          />
        </OptionalRate>
      </PricingSection>

      <PricingSection title="Delivery and pick-up" intro="Bringing the vehicle to the guest, and collecting it at the end." data-testid="pricing-delivery">
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
      </PricingSection>

      <PricingSection>
        <div className="flex flex-col gap-3">
          <FeeFields
            fees={values.fees}
            onChange={(fees) => set({ fees })}
            error={errors?.fees}
            hint="Late return, a fuel refill, a cleaning fee. Optional ones are add-ons guests choose."
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
      </PricingSection>
    </div>
  );
}

// One part of the pricing, divided from the one above: a title and a line on what it's for.
// Without a title it's only the divider (the extra fees, which head themselves).
function PricingSection({
  title,
  intro,
  children,
  ...props
}: {
  title?: string;
  intro?: string;
  children: ReactNode;
  "data-testid"?: string;
}) {
  return (
    <div className="border-t border-line py-6 last:pb-0">
      <fieldset className="flex flex-col" {...props}>
        {title && (
          <legend className="mb-4 flex flex-col gap-1">
            <span className="text-base font-semibold">{title}</span>
            {intro && <span className="text-sm text-muted">{intro}</span>}
          </legend>
        )}
        <div className="flex flex-col gap-4">{children}</div>
      </fieldset>
    </div>
  );
}

// An optional rate: a tick box that says what it is, and once ticked its fields under it.
function OptionalRate({
  label,
  name,
  on,
  onToggle,
  children,
}: {
  label: string;
  name: string;
  on: boolean;
  onToggle: (on: boolean) => void;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <CheckboxField
        label={label}
        name={`${name}_on`}
        checked={on}
        onChange={(event) => onToggle(event.target.checked)}
        data-testid={`pricing-${name}-on`}
      />
      {on && <div className="grid gap-4 pl-6 sm:grid-cols-2">{children}</div>}
    </div>
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
