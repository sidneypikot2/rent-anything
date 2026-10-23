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

// The inclusions PH rental shops advertise and riders look for, in the order they're listed.
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
};

// Only a car, a van or a multicab has these.
const FOUR_WHEEL_AMENITIES = ["air_conditioning", "child_seat", "driver_available"];
const FOUR_WHEEL_SLUGS = ["car", "van-rental", "multicab"];

// The amenities a vehicle of this category slug can tick.
export function vehicleAmenities(slug: string | undefined) {
  const fourWheel = slug !== undefined && FOUR_WHEEL_SLUGS.includes(slug);
  return Object.keys(VEHICLE_AMENITY_LABELS).filter((amenity) => fourWheel || !FOUR_WHEEL_AMENITIES.includes(amenity));
}
