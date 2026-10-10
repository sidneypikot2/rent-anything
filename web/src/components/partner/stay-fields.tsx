"use client";

import { CheckboxField } from "@/components/ui/checkbox-field";
import { ChoiceCards } from "@/components/ui/choice-cards";
import { StepperField } from "@/components/ui/stepper-field";
import type { ListingCategory, PartnerListing } from "./use-partner-listings";

// The attrs every accommodation type shares (RAA-82): what guests book, beds, guests,
// bathrooms and amenities. The API's attribute_schema holds the allowed values; this file
// holds how a partner reads them.

export const PLACE_TYPES = [
  { value: "entire_place", label: "Entire place", description: "Guests have the whole place to themselves." },
  {
    value: "private_room",
    label: "Private room",
    description: "Guests have their own room and share some spaces with others.",
  },
  { value: "shared_room", label: "Shared room", description: "Guests sleep in a room or dorm shared with others." },
];

export const BED_TYPES = [
  { value: "single", label: "Single bed" },
  { value: "double", label: "Double bed" },
  { value: "queen", label: "Queen bed" },
  { value: "king", label: "King bed" },
  { value: "bunk", label: "Bunk bed" },
  { value: "sofa_bed", label: "Sofa bed" },
  { value: "floor_mattress", label: "Floor mattress" },
];

export const AMENITY_GROUPS = [
  {
    name: "Essentials",
    amenities: [
      { value: "wifi", label: "Wi-Fi" },
      { value: "aircon", label: "Air conditioning" },
      { value: "fan", label: "Electric fan" },
      { value: "hot_shower", label: "Hot shower" },
      { value: "towels_linens", label: "Towels and bed linen" },
      { value: "toiletries", label: "Toiletries" },
      { value: "drinking_water", label: "Drinking water" },
    ],
  },
  {
    name: "Kitchen and living",
    amenities: [
      { value: "kitchen", label: "Kitchen" },
      { value: "refrigerator", label: "Refrigerator" },
      { value: "tv", label: "TV" },
      { value: "workspace", label: "Workspace" },
      { value: "washing_machine", label: "Washing machine" },
    ],
  },
  {
    name: "Outside",
    amenities: [
      { value: "free_parking", label: "Free parking" },
      { value: "pool", label: "Pool" },
      { value: "beachfront", label: "Beachfront" },
      { value: "balcony", label: "Balcony" },
      { value: "garden", label: "Garden" },
    ],
  },
  {
    name: "Services",
    amenities: [
      { value: "breakfast_included", label: "Breakfast included" },
      { value: "airport_pickup", label: "Airport or port pickup" },
      { value: "backup_power", label: "Backup power" },
    ],
  },
  {
    name: "Safety",
    amenities: [
      { value: "smoke_alarm", label: "Smoke alarm" },
      { value: "fire_extinguisher", label: "Fire extinguisher" },
      { value: "first_aid_kit", label: "First aid kit" },
      { value: "cctv", label: "CCTV outside" },
    ],
  },
];

const LABELS: Record<string, string> = Object.fromEntries(
  [...PLACE_TYPES, ...BED_TYPES, ...AMENITY_GROUPS.flatMap((group) => group.amenities)].map((option) => [
    option.value,
    option.label,
  ]),
);

export type StayValues = {
  placeType: string;
  // How many of each bed type, by BED_TYPES value; a type with none is left out when saved.
  beds: Record<string, number>;
  guests: number;
  bathrooms: number;
  amenities: string[];
};

export const NEW_STAY: StayValues = { placeType: "", beds: {}, guests: 1, bathrooms: 1, amenities: [] };

export function isStay(category: ListingCategory | undefined) {
  return category?.booking_type === "stay";
}

export function bedCount(values: StayValues) {
  return Object.values(values.beds).reduce((sum, count) => sum + count, 0);
}

export function toStayAttrs(values: StayValues) {
  return {
    place_type: values.placeType,
    beds: BED_TYPES.filter((bed) => (values.beds[bed.value] ?? 0) > 0).map((bed) => ({
      type: bed.value,
      count: values.beds[bed.value],
    })),
    guests: values.guests,
    bathrooms: values.bathrooms,
    amenities: values.amenities,
  };
}

// A saved listing's attrs as the stay fields hold them; anything missing starts as new.
export function toStayValues(attrs: PartnerListing["attrs"]): StayValues {
  const beds: Record<string, number> = {};
  if (Array.isArray(attrs.beds)) {
    for (const bed of attrs.beds) {
      if (bed && typeof bed === "object" && "type" in bed && "count" in bed) beds[String(bed.type)] = Number(bed.count);
    }
  }
  return {
    placeType: typeof attrs.place_type === "string" ? attrs.place_type : NEW_STAY.placeType,
    beds,
    guests: typeof attrs.guests === "number" ? attrs.guests : NEW_STAY.guests,
    bathrooms: typeof attrs.bathrooms === "number" ? attrs.bathrooms : NEW_STAY.bathrooms,
    amenities: Array.isArray(attrs.amenities) ? attrs.amenities.map(String) : [],
  };
}

// A stay attr as a partner reads it ("2 × Double bed", "Wi-Fi, Pool"), or undefined for
// anything that isn't one.
export function stayDisplayValue(key: string, value: unknown) {
  if (key === "place_type" && typeof value === "string") return LABELS[value] ?? value;
  if (key === "amenities" && Array.isArray(value)) return value.map((item) => LABELS[String(item)] ?? String(item)).join(", ");
  if (key === "beds" && Array.isArray(value)) {
    return value
      .map((bed: { type?: string; count?: number }) => `${bed.count} × ${LABELS[bed.type ?? ""] ?? bed.type}`)
      .join(", ");
  }
  return undefined;
}

export function PlaceTypeChoice({ values, onChange }: { values: StayValues; onChange: (values: StayValues) => void }) {
  return (
    <ChoiceCards
      legend="Choose what guests get"
      name="place_type"
      required
      columns={1}
      choices={PLACE_TYPES}
      value={values.placeType}
      onChange={(placeType) => onChange({ ...values, placeType })}
      data-testid="stay-place-type"
    />
  );
}

// Beds by type, then guests and bathrooms.
export function PropertyInfoFields({
  values,
  onChange,
  bedsError,
}: {
  values: StayValues;
  onChange: (values: StayValues) => void;
  bedsError?: string;
}) {
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-1" aria-labelledby="stay-beds">
        <h3 id="stay-beds" className="text-sm font-semibold">
          Beds
        </h3>
        <p className="text-sm text-muted">How many of each kind guests can sleep in.</p>
        <div className="mt-2 flex flex-col divide-y divide-line">
          {BED_TYPES.map((bed) => (
            <StepperField
              key={bed.value}
              label={bed.label}
              value={values.beds[bed.value] ?? 0}
              max={20}
              onChange={(count) => onChange({ ...values, beds: { ...values.beds, [bed.value]: count } })}
              data-testid={`stay-bed-${bed.value}`}
            />
          ))}
        </div>
        {bedsError && (
          <p role="alert" className="text-xs text-danger">
            {bedsError}
          </p>
        )}
      </section>
      <section className="flex flex-col divide-y divide-line" aria-label="Guests and bathrooms">
        <StepperField
          label="Guests"
          hint="The most who can stay"
          value={values.guests}
          min={1}
          max={50}
          onChange={(guests) => onChange({ ...values, guests })}
          data-testid="stay-guests"
        />
        <StepperField
          label="Bathrooms"
          hint="A toilet without a shower counts as half"
          value={values.bathrooms}
          max={20}
          step={0.5}
          onChange={(bathrooms) => onChange({ ...values, bathrooms })}
          data-testid="stay-bathrooms"
        />
      </section>
    </div>
  );
}

export function AmenityChoice({ values, onChange }: { values: StayValues; onChange: (values: StayValues) => void }) {
  function toggle(amenity: string, checked: boolean) {
    const amenities = checked ? [...values.amenities, amenity] : values.amenities.filter((item) => item !== amenity);
    onChange({ ...values, amenities });
  }

  return (
    <div data-testid="stay-amenities" className="flex flex-col gap-6">
      {AMENITY_GROUPS.map((group) => (
        <fieldset key={group.name} className="flex flex-col gap-3">
          <legend className="mb-2 text-sm font-semibold">{group.name}</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {group.amenities.map((amenity) => (
              <CheckboxField
                key={amenity.value}
                label={amenity.label}
                name="amenities"
                value={amenity.value}
                checked={values.amenities.includes(amenity.value)}
                onChange={(event) => toggle(amenity.value, event.target.checked)}
              />
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
