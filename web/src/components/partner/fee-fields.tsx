"use client";

import type { components } from "@/api/schema";
import { Button } from "@/components/ui/button";
import { CheckboxField } from "@/components/ui/checkbox-field";
import { Field } from "@/components/ui/field";
import { SelectField } from "@/components/ui/select-field";
import { formatPeso, fromCents, toCents } from "@/lib/money";
import { CHARGED_PER, type ChargedPer } from "@/lib/pricing";

type ListingFee = components["schemas"]["listing_fee"];
type ListingFeeBody = components["schemas"]["listing_fee_body"];

const MAX_FEES = 20;

// A fee row as the form holds it; `key` keeps React's rows apart before the API gives them ids.
export type FeeValues = { key: number; name: string; amount: string; chargedPer: ChargedPer; required: boolean };

let nextFeeKey = 1;
// A new row, blank or prefilled from a preset (a vehicle's late-return fee, RAA-150).
export function newFee(preset: Partial<Omit<FeeValues, "key">> = {}): FeeValues {
  return { key: nextFeeKey++, name: "", amount: "", chargedPer: "booking", required: true, ...preset };
}

export function toFeeValues(fees: ListingFee[]): FeeValues[] {
  return fees.map((fee) => ({
    key: nextFeeKey++,
    name: fee.name,
    amount: fromCents(fee.amount_cents),
    chargedPer: fee.charged_per,
    required: fee.required,
  }));
}

export function toFeesBody({ fees }: { fees: FeeValues[] }): ListingFeeBody[] {
  return fees.map((fee) => ({
    name: fee.name.trim(),
    amount_cents: toCents(fee.amount) ?? 0,
    charged_per: fee.chargedPer,
    required: fee.required,
  }));
}

// What the fees still need, or undefined: the same rules as Listings::ListingValues.
export function feesError(fees: FeeValues[]) {
  const names = fees.map((fee) => fee.name.trim().toLowerCase());
  if (fees.length > MAX_FEES) return `At most ${MAX_FEES} fees`;
  if (names.some((name) => !name)) return "Each fee needs a name";
  if (fees.some((fee) => fee.name.trim().length > 60)) return "A fee's name can be at most 60 characters";
  if (new Set(names).size < names.length) return "Each fee needs a different name";
  if (fees.some((fee) => toCents(fee.amount) === null)) return "Each fee needs an amount in pesos";
  return undefined;
}

// The required fees for an example booking, each with what it comes to: "Environmental fee ₱200".
export function exampleFees(fees: FeeValues[], quantities: Record<ChargedPer, number>) {
  return fees.flatMap((fee) => {
    const amount = toCents(fee.amount);
    const quantity = quantities[fee.chargedPer];
    if (!fee.required || !amount || !quantity) return [];
    return [{ label: `${fee.name.trim() || "fee"} ${formatPeso(amount * quantity)}`, cents: amount * quantity }];
  });
}

// A listing's extra fees (RAA-105): a cleaning fee, an environmental fee, an add-on. Any
// category can have them; `hint` says what they are for this one.
export function FeeFields({
  fees,
  onChange,
  error,
  hint = "A cleaning fee, an environmental fee, an extra bed. Optional ones are add-ons guests choose.",
}: {
  fees: FeeValues[];
  onChange: (fees: FeeValues[]) => void;
  error?: string;
  hint?: string;
}) {
  const setFee = (key: number, patch: Partial<FeeValues>) =>
    onChange(fees.map((fee) => (fee.key === key ? { ...fee, ...patch } : fee)));

  return (
    <div className="flex flex-col gap-3" data-testid="pricing-fees">
      <div className="flex flex-col">
        <span className="text-sm font-semibold">Fees</span>
        <span className="text-xs text-muted">{hint}</span>
      </div>
      {fees.map((fee, index) => (
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
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
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
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange(fees.filter((other) => other.key !== fee.key))}>
              Remove
            </Button>
          </div>
        </div>
      ))}
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
      {fees.length < MAX_FEES && (
        <Button
          type="button"
          variant="soft"
          size="sm"
          className="self-start"
          onClick={() => onChange([...fees, newFee()])}
          data-testid="pricing-add-fee"
        >
          Add a fee
        </Button>
      )}
    </div>
  );
}
