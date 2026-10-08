import { setOptions } from "@googlemaps/js-api-loader";

// Maps are Google Maps Platform (SPEC.md): the Maps JavaScript API with Advanced Markers.
// The browser key comes from NEXT_PUBLIC_GOOGLE_MAPS_API_KEY (web/.env.local locally, the
// Vercel dashboard in production); without one there is no map.
// Advanced Markers only render on a map with a map ID; DEMO_MAP_ID is Google's stand-in
// until NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID names our own.
export function googleMapsConfig(): { key: string; mapId: string } | null {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key) return null;
  return { key, mapId: process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID" };
}

let optionsSet = false;

// Points the Maps JS API loader at our key, once per page; call before importLibrary().
export function setMapsOptions(config: { key: string }) {
  if (optionsSet) return;
  setOptions({ key: config.key, v: "weekly" });
  optionsSet = true;
}

export type LatLng = { lat: number; lng: number };

const EARTH_RADIUS_KM = 6371;

// Great-circle (haversine) distance between two points, in km.
export function distanceKm(a: LatLng, b: LatLng): number {
  const rad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

// Where a map opens before anything is chosen: Cebu, the first areas' province.
export const DEFAULT_MAP_CENTER: LatLng = { lat: 10.3, lng: 123.9 };
