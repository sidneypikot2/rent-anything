import { getVersion, LngLatBounds, setWorkerUrl, type LngLatLike } from "maplibre-gl";

// Maps are MapLibre GL JS with OpenFreeMap's vector tiles (SPEC.md, RAA-61): free and keyless.
// The style carries the OpenStreetMap credit, shown by the map's attribution control.
export const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

let workerSet = false;

// Points MapLibre at its worker, copied to public/ by next.config.ts; call before new Map().
// The version query keeps a browser from running an old worker after an upgrade.
export function setMapWorker() {
  if (workerSet) return;
  setWorkerUrl(`/maplibre/maplibre-gl-worker.mjs?v=${getVersion()}`);
  workerSet = true;
}

export type LatLng = { lat: number; lng: number };

// MapLibre takes and gives [lng, lat]; the app and the API use { lat, lng }.
export function toLngLat(point: LatLng): LngLatLike {
  return [point.lng, point.lat];
}

export function fromLngLat(point: { lng: number; lat: number }): LatLng {
  return { lat: point.lat, lng: point.lng };
}

const EARTH_RADIUS_KM = 6371;
const rad = (degrees: number) => (degrees * Math.PI) / 180;
const deg = (radians: number) => (radians * 180) / Math.PI;

// Great-circle (haversine) distance between two points, in km.
export function distanceKm(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

const CIRCLE_STEPS = 64;

// A circle of radius km around a point, as a GeoJSON polygon (MapLibre draws no circles of
// its own), with the bounds to fit the map to.
export function circlePolygon(center: LatLng, km: number): { polygon: GeoJSON.Polygon; bounds: LngLatBounds } {
  const angular = km / EARTH_RADIUS_KM;
  const lat1 = rad(center.lat);
  const lng1 = rad(center.lng);
  const ring: [number, number][] = [];
  for (let step = 0; step <= CIRCLE_STEPS; step++) {
    const bearing = (2 * Math.PI * step) / CIRCLE_STEPS;
    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(angular) + Math.cos(lat1) * Math.sin(angular) * Math.cos(bearing));
    const lng2 =
      lng1 +
      Math.atan2(Math.sin(bearing) * Math.sin(angular) * Math.cos(lat1), Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2));
    ring.push([deg(lng2), deg(lat2)]);
  }
  const bounds = ring.reduce((box, coord) => box.extend(coord), new LngLatBounds(ring[0], ring[0]));
  return { polygon: { type: "Polygon", coordinates: [ring] }, bounds };
}

const PHOTON_URL = "https://photon.komoot.io/api";

// Where an address is, from Photon's public instance (OSM-based, no key; self-hosted at M8),
// limited to the Philippines. Null when nothing matches; throws when Photon can't be reached.
export async function geocodeAddress(query: string, signal?: AbortSignal): Promise<LatLng | null> {
  const params = new URLSearchParams({ q: query, limit: "1", countrycode: "PH" });
  const response = await fetch(`${PHOTON_URL}?${params}`, { signal });
  if (!response.ok) throw new Error(`Photon: ${response.status}`);
  const body: { features?: { geometry?: { coordinates?: [number, number] } }[] } = await response.json();
  const coordinates = body.features?.[0]?.geometry?.coordinates;
  return coordinates ? { lat: coordinates[1], lng: coordinates[0] } : null;
}

// Where a map opens before anything is chosen: Cebu, the first areas' province.
export const DEFAULT_MAP_CENTER: LatLng = { lat: 10.3, lng: 123.9 };
