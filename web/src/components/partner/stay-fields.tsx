"use client";

import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { CheckboxField } from "@/components/ui/checkbox-field";
import { ChoiceCards } from "@/components/ui/choice-cards";
import { SelectField } from "@/components/ui/select-field";
import { StepperField } from "@/components/ui/stepper-field";
import type { ListingCategory, PartnerListing } from "./use-partner-listings";

// The attrs every accommodation type shares (RAA-82): what guests book, beds, guests,
// bathrooms and amenities. Beds belong to rooms (RAA-95): an entire place has bedrooms, a
// private or shared room is one room, with its own bathroom and sharing details. The API's
// attribute_schema holds the allowed values; this file holds how a partner reads them.

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

export const BATHROOM_TYPES = [
  { value: "private", label: "Private bathroom", description: "Only the guests who book it use it." },
  { value: "shared", label: "Shared bathroom", description: "Guests share it with other people." },
];

export const DORM_TYPES = [
  { value: "mixed", label: "Mixed", description: "Anyone can book a bed." },
  { value: "female_only", label: "Female only", description: "Only women can book a bed." },
  { value: "male_only", label: "Male only", description: "Only men can book a bed." },
];

export const SHARED_WITH = [
  { value: "host", label: "The host" },
  { value: "host_family", label: "The host's family" },
  { value: "other_guests", label: "Other guests" },
];

// The most bedrooms an entire place can have; the API allows the same.
const MAX_ROOMS = 20;

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
  [
    ...PLACE_TYPES,
    ...BED_TYPES,
    ...BATHROOM_TYPES,
    ...DORM_TYPES,
    ...SHARED_WITH,
    ...AMENITY_GROUPS.flatMap((group) => group.amenities),
  ].map((option) => [option.value, option.label]),
);

// How many of each bed type a room has, by BED_TYPES value; a type with none is left out when saved.
type BedCounts = Record<string, number>;

export type StayValues = {
  placeType: string;
  // One per bedroom for an entire place; exactly one for a private or shared room.
  rooms: BedCounts[];
  guests: number;
  // An entire place counts its bathrooms; a private or shared room says whose its bathroom is.
  bathrooms: number;
  bathroom: string;
  dormType: string;
  sharedWith: string[];
  amenities: string[];
};

export const NEW_STAY: StayValues = {
  placeType: "",
  rooms: [{}],
  guests: 1,
  bathrooms: 1,
  bathroom: "",
  dormType: "",
  sharedWith: [],
  amenities: [],
};

export function isStay(category: ListingCategory | undefined) {
  return category?.booking_type === "stay";
}

// Only an entire place has bedrooms to add; a private or shared room is one room.
function isSingleRoom(placeType: string) {
  return placeType !== "entire_place";
}

function roomName(index: number) {
  return `Bedroom ${index + 1}`;
}

function bedCount(beds: BedCounts) {
  return Object.values(beds).reduce((sum, count) => sum + count, 0);
}

export type StayErrors = { beds?: string; sharedWith?: string };

// What the property info still needs before it can be saved, or undefined when nothing.
// The radio choices (bathroom, dorm type) are required fields the browser checks itself.
export function stayErrors(values: StayValues): StayErrors | undefined {
  const errors: StayErrors = {};
  const empty = values.rooms.findIndex((beds) => bedCount(beds) === 0);
  if (empty >= 0) {
    errors.beds = isSingleRoom(values.placeType) ? "Add at least one bed" : `Add at least one bed to ${roomName(empty)}`;
  }
  if (values.placeType === "shared_room" && values.sharedWith.length === 0) {
    errors.sharedWith = "Choose who guests share the room with";
  }
  return errors.beds || errors.sharedWith ? errors : undefined;
}

function toBeds(beds: BedCounts) {
  return BED_TYPES.filter((bed) => (beds[bed.value] ?? 0) > 0).map((bed) => ({ type: bed.value, count: beds[bed.value] }));
}

// The attrs of the chosen place type, leaving out what belongs to the others.
export function toStayAttrs(values: StayValues) {
  const single = isSingleRoom(values.placeType);
  const attrs = {
    place_type: values.placeType,
    rooms: (single ? values.rooms.slice(0, 1) : values.rooms).map((beds) => ({ beds: toBeds(beds) })),
    guests: values.guests,
    amenities: values.amenities,
  };
  if (!single) return { ...attrs, bathrooms: values.bathrooms };
  if (values.placeType === "private_room") return { ...attrs, bathroom: values.bathroom, shared_with: values.sharedWith };
  return { ...attrs, bathroom: values.bathroom, dorm_type: values.dormType, shared_with: values.sharedWith };
}

function toBedCounts(beds: unknown) {
  const counts: BedCounts = {};
  if (Array.isArray(beds)) {
    for (const bed of beds) {
      if (bed && typeof bed === "object" && "type" in bed && "count" in bed) counts[String(bed.type)] = Number(bed.count);
    }
  }
  return counts;
}

// A saved listing's attrs as the stay fields hold them; anything missing starts as new.
// Beds saved before rooms existed (a flat `beds`) read as one room.
export function toStayValues(attrs: PartnerListing["attrs"]): StayValues {
  const rooms = Array.isArray(attrs.rooms)
    ? attrs.rooms.map((room) => toBedCounts(room && typeof room === "object" && "beds" in room ? room.beds : undefined))
    : attrs.beds
      ? [toBedCounts(attrs.beds)]
      : [];
  const text = (value: unknown, fallback: string) => (typeof value === "string" ? value : fallback);
  const number = (value: unknown, fallback: number) => (typeof value === "number" ? value : fallback);
  return {
    placeType: text(attrs.place_type, NEW_STAY.placeType),
    rooms: rooms.length > 0 ? rooms : NEW_STAY.rooms,
    guests: number(attrs.guests, NEW_STAY.guests),
    bathrooms: number(attrs.bathrooms, NEW_STAY.bathrooms),
    bathroom: text(attrs.bathroom, NEW_STAY.bathroom),
    dormType: text(attrs.dorm_type, NEW_STAY.dormType),
    sharedWith: Array.isArray(attrs.shared_with) ? attrs.shared_with.map(String) : [],
    amenities: Array.isArray(attrs.amenities) ? attrs.amenities.map(String) : [],
  };
}

function bedsDisplay(beds: unknown) {
  if (!Array.isArray(beds)) return "";
  return beds
    .map((bed: { type?: string; count?: number }) => `${bed.count} × ${LABELS[bed.type ?? ""] ?? bed.type}`)
    .join(", ");
}

// A stay attr as a partner reads it ("Bedroom 1: 2 × Double bed; Bedroom 2: 1 × Single bed",
// "Wi-Fi, Pool"), or undefined for anything that isn't one.
export function stayDisplayValue(key: string, value: unknown) {
  if (["place_type", "bathroom", "dorm_type"].includes(key) && typeof value === "string") return LABELS[value] ?? value;
  if (["amenities", "shared_with"].includes(key) && Array.isArray(value)) {
    return value.map((item) => LABELS[String(item)] ?? String(item)).join(", ");
  }
  if (key === "beds") return bedsDisplay(value);
  if (key === "rooms" && Array.isArray(value)) {
    const rooms = value.map((room: { beds?: unknown } | null) => bedsDisplay(room?.beds));
    return rooms.length === 1 ? rooms[0] : rooms.map((beds, index) => `${roomName(index)}: ${beds}`).join("; ");
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
      // A private or shared room keeps only the first room's beds.
      onChange={(placeType) =>
        onChange({ ...values, placeType, rooms: isSingleRoom(placeType) ? values.rooms.slice(0, 1) : values.rooms })
      }
      data-testid="stay-place-type"
    />
  );
}

// A room's beds: a counter per bed type the partner has added, and a dropdown to add
// another type, so a room lists only the beds it has. Counting a bed down to 0 removes it.
function RoomBeds({ beds, onChange, testId }: { beds: BedCounts; onChange: (beds: BedCounts) => void; testId: string }) {
  const added = BED_TYPES.filter((bed) => (beds[bed.value] ?? 0) > 0);
  const remaining = BED_TYPES.filter((bed) => !((beds[bed.value] ?? 0) > 0));

  return (
    <div className="flex flex-col gap-3">
      {added.length > 0 && (
        <div className="flex flex-col divide-y divide-line">
          {added.map((bed) => (
            <StepperField
              key={bed.value}
              label={bed.label}
              value={beds[bed.value]}
              max={20}
              onChange={(count) => onChange({ ...beds, [bed.value]: count })}
              data-testid={`${testId}-bed-${bed.value}`}
            />
          ))}
        </div>
      )}
      {remaining.length > 0 && (
        <SelectField
          label={added.length > 0 ? "Add another bed" : "Add a bed"}
          options={[{ value: "", label: "Choose a bed type" }, ...remaining]}
          value=""
          onChange={(event) => event.target.value && onChange({ ...beds, [event.target.value]: 1 })}
          data-testid={`${testId}-add-bed`}
        />
      )}
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-xs text-danger">
      {message}
    </p>
  );
}

// What the place has, by place type: an entire place's bedrooms, guests and bathrooms; a
// private or shared room's beds, guests, bathroom and who guests share with; and a shared
// room's dorm type.
export function PropertyInfoFields({
  values,
  onChange,
  errors,
}: {
  values: StayValues;
  onChange: (values: StayValues) => void;
  errors?: StayErrors;
}) {
  const single = isSingleRoom(values.placeType);
  const shared = values.placeType === "shared_room";
  const setRoom = (index: number, beds: BedCounts) =>
    onChange({ ...values, rooms: values.rooms.map((room, i) => (i === index ? beds : room)) });
  const toggleSharedWith = (value: string, checked: boolean) =>
    onChange({
      ...values,
      sharedWith: checked ? [...values.sharedWith, value] : values.sharedWith.filter((item) => item !== value),
    });

  return (
    <div className="flex flex-col gap-6">
      {single ? (
        <section className="flex flex-col gap-1" aria-labelledby="stay-beds">
          <h3 id="stay-beds" className="text-sm font-semibold">
            Beds in the room
          </h3>
          <p className="text-sm text-muted">
            {shared ? "Every bed in the room, including the ones other guests book." : "The beds guests sleep in."}
          </p>
          <div className="mt-2">
            <RoomBeds beds={values.rooms[0] ?? {}} onChange={(beds) => setRoom(0, beds)} testId="stay-room-0" />
          </div>
          <FieldError message={errors?.beds} />
        </section>
      ) : (
        <section className="flex flex-col gap-3" aria-labelledby="stay-bedrooms">
          <div className="flex flex-col gap-1">
            <h3 id="stay-bedrooms" className="text-sm font-semibold">
              Bedrooms
            </h3>
            <p className="text-sm text-muted">Add each bedroom and the beds in it.</p>
          </div>
          {values.rooms.map((beds, index) => (
            <Card key={index} data-testid={`stay-room-${index}`}>
              <CardBody className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-4">
                  <h4 className="text-sm font-semibold">{roomName(index)}</h4>
                  {index > 0 && (
                    <Button
                      type="button"
                      variant="soft"
                      size="sm"
                      onClick={() => onChange({ ...values, rooms: values.rooms.filter((_, i) => i !== index) })}
                      data-testid={`stay-room-${index}-remove`}
                    >
                      Remove
                    </Button>
                  )}
                </div>
                <RoomBeds beds={beds} onChange={(next) => setRoom(index, next)} testId={`stay-room-${index}`} />
              </CardBody>
            </Card>
          ))}
          <FieldError message={errors?.beds} />
          {values.rooms.length < MAX_ROOMS && (
            <Button
              type="button"
              variant="soft"
              size="sm"
              className="self-start"
              onClick={() => onChange({ ...values, rooms: [...values.rooms, {}] })}
              data-testid="stay-add-room"
            >
              Add bedroom
            </Button>
          )}
        </section>
      )}

      <section className="flex flex-col divide-y divide-line" aria-label={single ? "Guests" : "Guests and bathrooms"}>
        <StepperField
          label={shared ? "Guests per booking" : "Guests"}
          hint={shared ? "The most one booking can bring" : "The most who can stay"}
          value={values.guests}
          min={1}
          max={50}
          onChange={(guests) => onChange({ ...values, guests })}
          data-testid="stay-guests"
        />
        {!single && (
          <StepperField
            label="Bathrooms"
            hint="A toilet without a shower counts as half"
            value={values.bathrooms}
            max={20}
            step={0.5}
            onChange={(bathrooms) => onChange({ ...values, bathrooms })}
            data-testid="stay-bathrooms"
          />
        )}
      </section>

      {shared && (
        <ChoiceCards
          legend="Who can book a bed"
          name="dorm_type"
          required
          columns={1}
          choices={DORM_TYPES}
          value={values.dormType}
          onChange={(dormType) => onChange({ ...values, dormType })}
          data-testid="stay-dorm-type"
        />
      )}

      {single && (
        <ChoiceCards
          legend="Bathroom"
          name="bathroom"
          required
          choices={BATHROOM_TYPES}
          value={values.bathroom}
          onChange={(bathroom) => onChange({ ...values, bathroom })}
          data-testid="stay-bathroom"
        />
      )}

      {single && (
        <fieldset data-testid="stay-shared-with" className="flex flex-col gap-3">
          <legend className="mb-2 text-sm font-medium">
            {shared ? "Who guests share the room with" : "Who guests share the place with (optional)"}
          </legend>
          <div className="grid gap-3 sm:grid-cols-3">
            {SHARED_WITH.map((option) => (
              <CheckboxField
                key={option.value}
                label={option.label}
                name="shared_with"
                value={option.value}
                checked={values.sharedWith.includes(option.value)}
                onChange={(event) => toggleSharedWith(option.value, event.target.checked)}
              />
            ))}
          </div>
          <FieldError message={errors?.sharedWith} />
        </fieldset>
      )}
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
