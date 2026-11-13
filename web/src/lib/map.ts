import { getVersion, LngLatBounds, setWorkerUrl, type LngLatLike, type Map as MapLibreMap } from "maplibre-gl";
import { EARTH_RADIUS_KM, type LatLng } from "./geo";

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

// A guest's map stays flat with north up, so a stray drag can't turn or tilt it: these go in
// new Map(), and keepMapFlat(map) after it stops the two gestures the options can't.
export const FLAT_MAP = { dragRotate: false, pitchWithRotate: false, touchPitch: false, maxPitch: 0 } as const;

export function keepMapFlat(map: MapLibreMap) {
  map.touchZoomRotate.disableRotation();
  map.keyboard.disableRotation();
}

// Plain geometry lives in geo.ts, free of MapLibre, so pages can measure without loading it.
export { distanceKm, type LatLng } from "./geo";

// MapLibre takes and gives [lng, lat]; the app and the API use { lat, lng }.
export function toLngLat(point: LatLng): LngLatLike {
  return [point.lng, point.lat];
}

export function fromLngLat(point: { lng: number; lat: number }): LatLng {
  return { lat: point.lat, lng: point.lng };
}

const rad = (degrees: number) => (degrees * Math.PI) / 180;
const deg = (radians: number) => (radians * 180) / Math.PI;

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
