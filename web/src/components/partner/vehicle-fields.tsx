"use client";

import { Field } from "@/components/ui/field";
import type { ListingCategory, PartnerListing } from "./use-partner-listings";

// The attrs every vehicle rental shares (RAA-88): make, model and engine size, and an
// optional color. The API's attribute_schema holds the limits; this file holds the form.

const VEHICLE_KEYS = ["make", "model", "engine_cc", "color"] as const;
export type VehicleValues = Record<(typeof VEHICLE_KEYS)[number], string>;
export const NEW_VEHICLE: VehicleValues = { make: "", model: "", engine_cc: "", color: "" };

// A motorcycle, car, van, tricycle or multicab: its schema asks for make, model and engine.
export function isVehicle(category: ListingCategory | undefined) {
  const properties = (category?.attribute_schema as { properties?: Record<string, unknown> } | undefined)?.properties;
  return !!properties && "make" in properties && "model" in properties && "engine_cc" in properties;
}

export function toVehicleValues(attrs: PartnerListing["attrs"]): VehicleValues {
  const text = (value: unknown) => (typeof value === "string" || typeof value === "number" ? String(value) : "");
  return { make: text(attrs.make), model: text(attrs.model), engine_cc: text(attrs.engine_cc), color: text(attrs.color) };
}

// The form's values as attrs, on top of what the listing already has (a plate number, a
// helmet), so saving keeps them. A blank color is left out.
export function toVehicleAttrs(values: VehicleValues, kept: PartnerListing["attrs"] = {}) {
  const rest = Object.fromEntries(Object.entries(kept).filter(([key]) => !(VEHICLE_KEYS as readonly string[]).includes(key)));
  const color = values.color.trim();
  return {
    ...rest,
    make: values.make.trim(),
    model: values.model.trim(),
    engine_cc: Number(values.engine_cc),
    ...(color && { color }),
  };
}

export function VehicleFields({ values, onChange }: { values: VehicleValues; onChange: (values: VehicleValues) => void }) {
  const set = (key: keyof VehicleValues) => (event: { target: { value: string } }) =>
    onChange({ ...values, [key]: event.target.value });
  return (
    <div data-testid="listing-vehicle" className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Make" name="make" required maxLength={50} value={values.make} onChange={set("make")} placeholder="e.g. Honda" />
        <Field
          label="Model"
          name="model"
          required
          maxLength={50}
          value={values.model}
          onChange={set("model")}
          placeholder="e.g. Click 125"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Engine size (cc)"
          name="engine_cc"
          type="number"
          required
          min={50}
          max={10000}
          step={1}
          value={values.engine_cc}
          onChange={set("engine_cc")}
          placeholder="e.g. 125"
        />
        <Field
          label="Color (optional)"
          name="color"
          maxLength={30}
          value={values.color}
          onChange={set("color")}
          placeholder="e.g. Matte black"
        />
      </div>
    </div>
  );
}
