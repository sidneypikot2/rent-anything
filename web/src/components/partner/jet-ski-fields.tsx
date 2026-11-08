"use client";

import { JET_SKI_BRANDS, JET_SKI_FEATURE_LABELS, JET_SKI_FEATURES } from "@/components/listings/jet-ski-labels";
import { CheckboxField } from "@/components/ui/checkbox-field";
import { ComboboxField } from "@/components/ui/combobox-field";
import { Field } from "@/components/ui/field";
import { StepperField } from "@/components/ui/stepper-field";
import type { ListingCategory, PartnerListing } from "./use-partner-listings";

// The jet ski itself (RAA-273): its brand, model, engine size, power and features, kept in the
// listing's attrs (the jet ski category's attribute_schema holds the limits). Its seats are the
// activity's seats_per_unit, edited here for a jet ski rather than under How it runs.

const JET_SKI_KEYS = ["brand", "model", "engine_cc", "horsepower", "features"] as const;
export type JetSkiValues = { brand: string; model: string; engine_cc: string; horsepower: string; features: string[] };
export const NEW_JET_SKI: JetSkiValues = { brand: "", model: "", engine_cc: "", horsepower: "", features: [] };

// By its slug, so the step shows whatever the category's schema says yet.
export function isJetSki(category: Pick<ListingCategory, "slug"> | undefined) {
  return category?.slug === "jet-ski";
}

export function toJetSkiValues(attrs: PartnerListing["attrs"]): JetSkiValues {
  const text = (value: unknown) => (typeof value === "string" || typeof value === "number" ? String(value) : "");
  return {
    brand: text(attrs.brand),
    model: text(attrs.model),
    engine_cc: text(attrs.engine_cc),
    horsepower: text(attrs.horsepower),
    features: Array.isArray(attrs.features) ? attrs.features.filter((item) => JET_SKI_FEATURES.includes(String(item))).map(String) : [],
  };
}

// The form's values as attrs, on top of any others the listing has. Blank numbers are left out.
export function toJetSkiAttrs(values: JetSkiValues, kept: PartnerListing["attrs"] = {}) {
  const rest = Object.fromEntries(Object.entries(kept).filter(([key]) => !(JET_SKI_KEYS as readonly string[]).includes(key)));
  const number = (value: string) => (value.trim() === "" ? undefined : Number(value));
  const engine = number(values.engine_cc);
  const power = number(values.horsepower);
  return {
    ...rest,
    brand: values.brand.trim(),
    model: values.model.trim(),
    ...(engine !== undefined && { engine_cc: engine }),
    ...(power !== undefined && { horsepower: power }),
    features: JET_SKI_FEATURES.filter((feature) => values.features.includes(feature)),
  };
}

// "Yamaha VX Cruiser · 1049 cc · 110 hp", for the review.
export function jetSkiText(values: JetSkiValues) {
  return [
    [values.brand.trim(), values.model.trim()].filter(Boolean).join(" "),
    values.engine_cc && `${values.engine_cc} cc`,
    values.horsepower && `${values.horsepower} hp`,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function jetSkiFeaturesText(values: JetSkiValues) {
  return values.features.map((feature) => JET_SKI_FEATURE_LABELS[feature]).join(", ") || "—";
}

export function JetSkiFields({
  values,
  onChange,
  seats,
  onSeatsChange,
  maxSeats,
}: {
  values: JetSkiValues;
  onChange: (values: JetSkiValues) => void;
  seats: number;
  onSeatsChange: (seats: number) => void;
  maxSeats: number;
}) {
  const set = (key: "model" | "engine_cc" | "horsepower") => (event: { target: { value: string } }) =>
    onChange({ ...values, [key]: event.target.value });

  function toggle(feature: string, checked: boolean) {
    const features = checked ? [...values.features, feature] : values.features.filter((item) => item !== feature);
    onChange({ ...values, features });
  }

  return (
    <div data-testid="listing-jet-ski" className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <ComboboxField
          label="Brand"
          name="brand"
          required
          maxLength={50}
          value={values.brand}
          options={JET_SKI_BRANDS.map((brand) => ({ value: brand, label: brand }))}
          onChange={(brand) => onChange({ ...values, brand })}
          placeholder="e.g. Yamaha"
          data-testid="jet-ski-brand"
        />
        <Field
          label="Model"
          name="model"
          required
          maxLength={50}
          value={values.model}
          onChange={set("model")}
          placeholder="e.g. VX Cruiser"
          data-testid="jet-ski-model"
        />
        <Field
          label="Engine size (cc, optional)"
          name="engine_cc"
          type="number"
          min={50}
          max={2000}
          step={1}
          value={values.engine_cc}
          onChange={set("engine_cc")}
          placeholder="e.g. 1049"
          data-testid="jet-ski-engine"
        />
        <Field
          label="Horsepower (optional)"
          name="horsepower"
          type="number"
          min={10}
          max={400}
          step={1}
          value={values.horsepower}
          onChange={set("horsepower")}
          placeholder="e.g. 110"
          data-testid="jet-ski-horsepower"
        />
      </div>
      <StepperField
        label="Seats on each jet ski"
        hint="The rider included. Each rate can allow fewer."
        value={seats}
        onChange={onSeatsChange}
        min={1}
        max={maxSeats}
        data-testid="activity-seats"
      />
      <fieldset data-testid="jet-ski-features" className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-semibold">Features</legend>
        <p className="text-xs text-muted">Guests see these on your listing. Tick only what every jet ski has.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {JET_SKI_FEATURES.map((feature) => (
            <CheckboxField
              key={feature}
              label={JET_SKI_FEATURE_LABELS[feature]}
              name="features"
              value={feature}
              checked={values.features.includes(feature)}
              onChange={(event) => toggle(feature, event.target.checked)}
              data-testid={`jet-ski-feature-${feature}`}
            />
          ))}
        </div>
      </fieldset>
    </div>
  );
}
