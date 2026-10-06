// Maps are Google Maps Platform (SPEC.md): the Maps JavaScript API with Advanced Markers.
// The browser key comes from NEXT_PUBLIC_GOOGLE_MAPS_API_KEY; without one there is no map.
// Advanced Markers only render on a map with a map ID; DEMO_MAP_ID is Google's stand-in
// until NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID names our own.
export function googleMapsConfig(): { key: string; mapId: string } | null {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key) return null;
  return { key, mapId: process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID" };
}

export type LatLng = { lat: number; lng: number };

// Where a map opens before anything is chosen: Cebu, the first areas' province.
export const DEFAULT_MAP_CENTER: LatLng = { lat: 10.3, lng: 123.9 };
