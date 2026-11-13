import type { LatLng } from "./geo";

// Address search and place names from Photon, and where a map opens. Kept apart from map.ts,
// which loads MapLibre: a form that only looks an address up (delivery options, the stay pin)
// imported these from map.ts and so put MapLibre in every page's first load (RAA-231).

const PHOTON = "https://photon.komoot.io";

// Where an address is, from Photon's public instance (OSM-based, no key; self-hosted at M8),
// limited to the Philippines. Null when nothing matches; throws when Photon can't be reached.
export async function geocodeAddress(query: string, signal?: AbortSignal): Promise<LatLng | null> {
  const params = new URLSearchParams({ q: query, limit: "1", countrycode: "PH" });
  const response = await fetch(`${PHOTON}/api?${params}`, { signal });
  if (!response.ok) throw new Error(`Photon: ${response.status}`);
  const body: { features?: { geometry?: { coordinates?: [number, number] } }[] } = await response.json();
  const coordinates = body.features?.[0]?.geometry?.coordinates;
  return coordinates ? { lat: coordinates[1], lng: coordinates[0] } : null;
}

// A place a guest picks while typing an address (RAA-205): its name, where it is ("Santa Fe,
// Cebu") and its point.
export type PlaceSuggestion = { name: string; detail: string; point: LatLng };

const NEAR_DEGREES = 0.3;

// Places matching what is typed so far, from Photon, nearest `near` first and within about
// 30 km of it, so a search for a resort stays on the island. Throws when Photon can't be reached.
export async function searchPlaces(query: string, near: LatLng, signal?: AbortSignal): Promise<PlaceSuggestion[]> {
  const box = [near.lng - NEAR_DEGREES, near.lat - NEAR_DEGREES, near.lng + NEAR_DEGREES, near.lat + NEAR_DEGREES];
  const params = new URLSearchParams({ q: query, limit: "5", lat: String(near.lat), lon: String(near.lng), bbox: box.join(",") });
  const response = await fetch(`${PHOTON}/api?${params}`, { signal });
  if (!response.ok) throw new Error(`Photon: ${response.status}`);
  const body: { features?: { geometry?: { coordinates?: [number, number] }; properties?: ReversePlace }[] } = await response.json();
  return (body.features ?? []).flatMap((feature) => {
    const coordinates = feature.geometry?.coordinates;
    const place = feature.properties ?? {};
    const name = place.name ?? [place.housenumber, place.street].filter(Boolean).join(" ");
    if (!coordinates || !name) return [];
    const detail = [place.locality ?? place.district, place.city, place.state].filter((part) => part && part !== name).join(", ");
    return [{ name, detail, point: { lat: coordinates[1], lng: coordinates[0] } }];
  }).filter((place, index, places) => places.findIndex((other) => other.name === place.name && other.detail === place.detail) === index);
}

// What Photon knows about the place at a point (RAA-111), as OpenStreetMap names it: in the
// Philippines `state` is the province and `locality` or `district` the barangay. Null when
// nothing is near; throws when Photon can't be reached.
export type ReversePlace = {
  type?: string;
  name?: string;
  housenumber?: string;
  street?: string;
  locality?: string;
  district?: string;
  city?: string;
  county?: string;
  state?: string;
  postcode?: string;
  countrycode?: string;
};

export async function reverseGeocode(point: LatLng, signal?: AbortSignal): Promise<ReversePlace | null> {
  const params = new URLSearchParams({ lat: String(point.lat), lon: String(point.lng), limit: "1" });
  const response = await fetch(`${PHOTON}/reverse?${params}`, { signal });
  if (!response.ok) throw new Error(`Photon: ${response.status}`);
  const body: { features?: { properties?: ReversePlace }[] } = await response.json();
  return body.features?.[0]?.properties ?? null;
}

// Where a map opens before anything is chosen: Cebu, the first areas' province.
export const DEFAULT_MAP_CENTER: LatLng = { lat: 10.3, lng: 123.9 };
