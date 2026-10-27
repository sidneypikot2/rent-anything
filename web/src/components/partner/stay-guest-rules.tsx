"use client";

import { CheckboxField } from "@/components/ui/checkbox-field";
import { StepperField } from "@/components/ui/stepper-field";
import { formatPeso, toCents } from "@/lib/money";
import type { FeeValues } from "./fee-fields";
import { MAX_PETS, type StayValues } from "./stay-fields";

// How a pet fee reads under "Pet fee": "₱200 per pet, per stay".
const PET_CHARGES: Partial<Record<FeeValues["chargedPer"], string>> = {
  pet: "per pet, per stay",
  pet_night: "per pet per night",
};

// Who takes a bed in each room and whether pets come (RAA-186): children count toward a
// room's capacity unless the partner says not, infants only if they say so, and pets come
// only when allowed, up to Max pets. Pets are charged through the stay's fees, so the card
// shows the pet fees set under Pricing.
export function StayGuestRules({
  values,
  onChange,
  units,
  fees,
}: {
  values: StayValues;
  onChange: (values: StayValues) => void;
  units: number;
  fees: FeeValues[];
}) {
  const petFees = fees.filter((fee) => PET_CHARGES[fee.chargedPer]);
  return (
    <section data-testid="stay-guest-rules" aria-label="Guests and pets" className="flex flex-col gap-1 rounded-control border border-line p-4">
      <p className="text-sm font-semibold">
        {units} {units === 1 ? "room" : "rooms"} · sleeps {values.guests}
        {units > 1 && " each"}
      </p>
      <CheckboxField
        label="Children count toward capacity"
        checked={values.childrenCount}
        onChange={(event) => onChange({ ...values, childrenCount: event.target.checked })}
        data-testid="stay-children-count"
      />
      <CheckboxField
        label="Infants count toward capacity"
        checked={values.infantsCount}
        onChange={(event) => onChange({ ...values, infantsCount: event.target.checked })}
        data-testid="stay-infants-count"
      />
      <CheckboxField
        label="Pets allowed"
        checked={values.petsAllowed}
        onChange={(event) => onChange({ ...values, petsAllowed: event.target.checked })}
        data-testid="stay-pets-allowed"
      />
      {values.petsAllowed && (
        <>
          <StepperField
            label="Max pets"
            hint="The most one booking can bring"
            value={values.maxPets}
            min={1}
            max={MAX_PETS}
            onChange={(maxPets) => onChange({ ...values, maxPets })}
            data-testid="stay-max-pets"
          />
          <div className="flex flex-col py-1">
            <span className="text-sm font-semibold">Pet fee</span>
            <span className="text-xs text-muted" data-testid="stay-pet-fee">
              {petFees.length > 0
                ? petFees.map((fee) => `${formatPeso(toCents(fee.amount) ?? 0)} ${PET_CHARGES[fee.chargedPer]}`).join(" · ")
                : "None: add a fee charged per pet under Pricing"}
            </span>
          </div>
        </>
      )}
    </section>
  );
}
