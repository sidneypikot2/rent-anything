"use client";

import { TRANSMISSIONS, VEHICLE_AMENITY_LABELS, vehicleAmenities } from "@/components/listings/vehicle-labels";
import { CheckboxField } from "@/components/ui/checkbox-field";
import { ComboboxField } from "@/components/ui/combobox-field";
import { Field } from "@/components/ui/field";
import { SelectField } from "@/components/ui/select-field";
import type { ListingCategory, PartnerListing } from "./use-partner-listings";
import { catalogMakes, catalogModels } from "./vehicle-catalog";

// The attrs every vehicle rental shares (RAA-88): make, model and engine size, its
// transmission, an optional color, and what comes with it (RAA-150). The API's
// attribute_schema holds the limits; this file holds the form. Make and model are suggested
// from the catalog (vehicle-catalog.ts), and picking a model fills in its cc and transmission.

const VEHICLE_KEYS = ["make", "model", "engine_cc", "transmission", "color", "amenities", "helmet_included"] as const;
export type VehicleValues = {
  make: string;
  model: string;
  engine_cc: string;
  transmission: string;
  color: string;
  amenities: string[];
};
export const NEW_VEHICLE: VehicleValues = { make: "", model: "", engine_cc: "", transmission: "", color: "", amenities: [] };

// A motorcycle, car or van: its schema asks for make, model and engine.
export function isVehicle(category: ListingCategory | undefined) {
  const properties = (category?.attribute_schema as { properties?: Record<string, unknown> } | undefined)?.properties;
  return !!properties && "make" in properties && "model" in properties && "engine_cc" in properties;
}

export function toVehicleValues(attrs: PartnerListing["attrs"]): VehicleValues {
  const text = (value: unknown) => (typeof value === "string" || typeof value === "number" ? String(value) : "");
  return {
    make: text(attrs.make),
    model: text(attrs.model),
    engine_cc: text(attrs.engine_cc),
    transmission: text(attrs.transmission),
    color: text(attrs.color),
    amenities: Array.isArray(attrs.amenities) ? attrs.amenities.filter((item) => typeof item === "string") : [],
  };
}

// The form's values as attrs, on top of what the listing already has (a plate number), so
// saving keeps them. A blank color is left out, and so are amenities its category can't have.
export function toVehicleAttrs(values: VehicleValues, kept: PartnerListing["attrs"] = {}, slug?: string) {
  const rest = Object.fromEntries(Object.entries(kept).filter(([key]) => !(VEHICLE_KEYS as readonly string[]).includes(key)));
  const color = values.color.trim();
  const allowed = vehicleAmenities(slug);
  return {
    ...rest,
    make: values.make.trim(),
    model: values.model.trim(),
    engine_cc: Number(values.engine_cc),
    transmission: values.transmission,
    ...(color && { color }),
    amenities: allowed.filter((amenity) => values.amenities.includes(amenity)),
  };
}

export function VehicleFields({
  values,
  onChange,
  slug,
}: {
  values: VehicleValues;
  onChange: (values: VehicleValues) => void;
  slug: string | undefined;
}) {
  const set = (key: keyof VehicleValues) => (event: { target: { value: string } }) =>
    onChange({ ...values, [key]: event.target.value });
  const makes = catalogMakes(slug).map((entry) => ({ value: entry.make, label: entry.make }));
  const models = catalogModels(slug, values.make);
  const makeKnown = makes.some((make) => make.label.toLowerCase() === values.make.trim().toLowerCase());
  const modelOptions = models.map((entry) => ({
    value: `${entry.make}|${entry.model}`,
    label: makeKnown ? entry.model : `${entry.make} ${entry.model}`,
  }));

  function toggle(amenity: string, checked: boolean) {
    const amenities = checked ? [...values.amenities, amenity] : values.amenities.filter((item) => item !== amenity);
    onChange({ ...values, amenities });
  }

  return (
    <div data-testid="listing-vehicle" className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <ComboboxField
            label="Make"
            name="make"
            required
            maxLength={50}
            value={values.make}
            options={makes}
            onChange={(make) => onChange({ ...values, make })}
            placeholder="e.g. Honda"
            data-testid="vehicle-make"
          />
          <ComboboxField
            label="Model"
            name="model"
            required
            maxLength={50}
            value={values.model}
            options={modelOptions}
            onChange={(text, option) => {
              const picked = option && models.find((entry) => `${entry.make}|${entry.model}` === option.value);
              if (!picked) return onChange({ ...values, model: text });
              onChange({
                ...values,
                make: picked.make,
                model: picked.model,
                engine_cc: String(picked.cc),
                transmission: picked.transmission,
              });
            }}
            placeholder="e.g. Click 125"
            hint="Pick one to fill in its engine size and transmission, or type your own."
            data-testid="vehicle-model"
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
            data-testid="vehicle-engine"
          />
          <SelectField
            label="Transmission"
            name="transmission"
            required
            value={values.transmission}
            onChange={set("transmission")}
            options={[{ value: "", label: "Choose one" }, ...TRANSMISSIONS]}
            data-testid="vehicle-transmission"
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

      <fieldset data-testid="vehicle-amenities" className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-semibold">What comes with it</legend>
        <p className="text-xs text-muted">Guests see these on your listing. Tick only what every rental includes.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {vehicleAmenities(slug).map((amenity) => (
            <CheckboxField
              key={amenity}
              label={VEHICLE_AMENITY_LABELS[amenity]}
              name="amenities"
              value={amenity}
              checked={values.amenities.includes(amenity)}
              onChange={(event) => toggle(amenity, event.target.checked)}
            />
          ))}
        </div>
      </fieldset>
    </div>
  );
}
