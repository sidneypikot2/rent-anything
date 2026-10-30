// What a vehicle's attrs mean in words (RAA-150): the transmissions and amenities the API's
// vehicle attribute_schema allows (RAA-149), with the label a partner ticks and a guest reads.
// The partner's vehicle fields and the guest's listing chips both use these.

export const TRANSMISSIONS = [
  { value: "automatic", label: "Automatic" },
  { value: "semi_automatic", label: "Semi-automatic" },
  { value: "manual", label: "Manual" },
] as const;

export type Transmission = (typeof TRANSMISSIONS)[number]["value"];

export function transmissionLabel(value: unknown) {
  return TRANSMISSIONS.find((transmission) => transmission.value === value)?.label;
}

// The inclusions PH rental shops advertise and renters look for. Each category ticks its own
// list (VEHICLE_AMENITIES); this map only names them.
export const VEHICLE_AMENITY_LABELS: Record<string, string> = {
  rider_helmet: "Rider helmet",
  passenger_helmet: "Passenger helmet",
  raincoat: "Raincoat",
  phone_holder: "Phone holder",
  full_tank: "Full tank",
  insurance: "Insurance",
  registration_papers: "OR/CR papers",
  lock: "Lock",
  top_box: "Top box",
  cargo_straps: "Cargo straps",
  usb_charger: "USB charger",
  roadside_assistance: "Roadside assistance",
  air_conditioning: "Air conditioning",
  child_seat: "Child seat",
  bluetooth_audio: "Bluetooth / CarPlay",
  dashcam: "Dashcam",
  reverse_camera: "Reverse camera",
  rfid_toll: "RFID toll tags",
  early_warning_device: "Early warning device",
  spare_tire_tools: "Spare tire and tools",
  first_aid_kit: "First aid kit",
};

// What a rider gets with a motorbike or a trike. The km limit, delivery and a driver are the
// pricing step's, so none of them is an inclusion.
const TWO_WHEEL = [
  "rider_helmet",
  "passenger_helmet",
  "raincoat",
  "phone_holder",
  "full_tank",
  "insurance",
  "registration_papers",
  "lock",
  "top_box",
  "cargo_straps",
  "usb_charger",
  "roadside_assistance",
];

// What a car or van renter looks for, the most searched first.
const CAR = [
  "air_conditioning",
  "full_tank",
  "insurance",
  "child_seat",
  "bluetooth_audio",
  "dashcam",
  "reverse_camera",
  "usb_charger",
  "phone_holder",
  "rfid_toll",
  "registration_papers",
  "roadside_assistance",
  "early_warning_device",
  "spare_tire_tools",
  "first_aid_kit",
];

// A multicab is a basic utility vehicle: no reverse camera or toll tags.
const MULTICAB = CAR.filter((amenity) => !["reverse_camera", "rfid_toll"].includes(amenity));

const VEHICLE_AMENITIES: Record<string, string[]> = {
  motorcycle: TWO_WHEEL,
  tricycle: TWO_WHEEL,
  car: CAR,
  "van-rental": CAR,
  multicab: MULTICAB,
};

// Cars, vans and multicabs: they take the car fee presets too.
export function isFourWheel(slug: string | undefined) {
  return slug === "car" || slug === "van-rental" || slug === "multicab";
}

// A motorbike's shop can offer child helmets, free or for a fee (RAA-205); no other vehicle.
export function hasChildHelmets(slug: string | undefined) {
  return slug === "motorcycle";
}

// The vehicles a partner can rent out with a driver; a motorbike is always self-drive.
export function hasDriverOption(slug: string | undefined) {
  return isFourWheel(slug) || slug === "tricycle";
}

// The amenities a vehicle of this category slug can tick.
export function vehicleAmenities(slug: string | undefined) {
  return (slug && VEHICLE_AMENITIES[slug]) || TWO_WHEEL;
}
