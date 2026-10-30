import { formatPeso } from "@/lib/money";

// Delivery zones as guests read them (RAA-205), shared by server and client components.

// One of a shop's zones (the API's `delivery_zone`): up to max_distance_m from it, fee_cents a vehicle.
export type DeliveryZone = { max_distance_m: number; fee_cents: number };

const km = (metres: number) => `${Math.round(metres / 100) / 10} km`;

// A ring's label on the map: "Free · 1 km", "₱150 · 3 km".
export function zoneLabel(zone: DeliveryZone) {
  return `${zone.fee_cents === 0 ? "Free" : formatPeso(zone.fee_cents)} · ${km(zone.max_distance_m)}`;
}

// The zones in a line: "Free up to 1 km, ₱150 up to 3 km".
export function zonesText(zones: DeliveryZone[]) {
  const text = [...zones]
    .sort((a, b) => a.max_distance_m - b.max_distance_m)
    .map((zone) => `${zone.fee_cents === 0 ? "free" : formatPeso(zone.fee_cents)} up to ${km(zone.max_distance_m)}`)
    .join(", ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}
