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
  unlimited_km: "Unlimited km",
  maintenance_checked: "Maintenance checked",
  air_conditioning: "Air conditioning",
  child_seat: "Child seat",
  driver_available: "Driver available",
  bluetooth_audio: "Bluetooth audio",
  carplay_android_auto: "Apple CarPlay / Android Auto",
  gps_navigation: "GPS navigation",
  dashcam: "Dashcam",
  reverse_camera: "Reverse camera",
  rfid_toll: "RFID toll tags",
  early_warning_device: "Early warning device",
  spare_tire_tools: "Spare tire and tools",
  first_aid_kit: "First aid kit",
};

// What a rider gets with a motorbike or a trike.
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
  "unlimited_km",
  "maintenance_checked",
];

// What a car or van renter looks for, the most searched first.
const CAR = [
  "air_conditioning",
  "full_tank",
  "insurance",
  "unlimited_km",
  "driver_available",
  "child_seat",
  "bluetooth_audio",
  "carplay_android_auto",
  "gps_navigation",
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
  "maintenance_checked",
];

// A multicab is a basic utility vehicle: no infotainment, camera or toll tags.
const MULTICAB = CAR.filter((amenity) => !["carplay_android_auto", "reverse_camera", "rfid_toll"].includes(amenity));

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

// The amenities a vehicle of this category slug can tick.
export function vehicleAmenities(slug: string | undefined) {
  return (slug && VEHICLE_AMENITIES[slug]) || TWO_WHEEL;
}
