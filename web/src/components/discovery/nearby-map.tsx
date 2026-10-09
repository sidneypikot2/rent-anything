"use client";

import { Map as MapLibreMap, Marker, type GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import type { ExplorePlace } from "@/api/discovery";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardLink } from "@/components/ui/card";
import { SectionTitle } from "@/components/ui/typography";
import {
  circlePolygon,
  DEFAULT_MAP_CENTER,
  fromLngLat,
  MAP_STYLE_URL,
  setMapWorker,
  toLngLat,
  type LatLng,
} from "@/lib/map";
import { useExplore } from "./use-explore";

const RADIUS_SOURCE = "radius";
const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
const MIN_KM = 1;
const MAX_KM = 50;
const DEFAULT_KM = 5;
// Wait for the slider to settle before asking the API again.
const KM_DEBOUNCE_MS = 300;

// A theme colour for the map's own drawing (it takes colour strings, not classes).
function themeColor(name: string): string | undefined {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || undefined;
}

// A small coloured dot for a listing or landmark on the map.
function dot(className: string): HTMLElement {
  const element = document.createElement("span");
  element.className = `block size-3.5 rounded-full border-2 border-surface shadow ${className}`;
  return element;
}

// Testing page (RAA-53): the guest clicks the map to drop a pin and drags it to adjust.
// Confirming locks the map and the pin; a range then draws a circle around the pin, and
// the explore endpoint (RAA-57) returns what is within it: listings (kept to the island
// when the pin is on one), nearby destinations, and destinations often visited with them.
export function NearbyMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const pinRef = useRef<Marker | null>(null);
  const lockedRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pin, setPin] = useState<LatLng | null>(null);
  const [locked, setLocked] = useState(false);
  const [km, setKm] = useState(DEFAULT_KM);
  const [queryKm, setQueryKm] = useState(DEFAULT_KM);

  useEffect(() => {
    const timer = setTimeout(() => setQueryKm(km), KM_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [km]);

  const { data: explore, isError, isFetching } = useExplore(locked ? pin : null, queryKm);
  const results = locked && pin ? explore : undefined;

  useEffect(() => {
    if (!containerRef.current) return;
    setMapWorker();
    let map: MapLibreMap;
    try {
      map = new MapLibreMap({
        container: containerRef.current,
        style: MAP_STYLE_URL,
        center: toLngLat(DEFAULT_MAP_CENTER),
        zoom: 9,
        attributionControl: { compact: true },
      });
    } catch {
      // No WebGL in this browser: the constructor throws, so report it after this effect.
      queueMicrotask(() => setFailed(true));
      return;
    }
    let loaded = false;

    // A failure before the map has drawn (the style or worker didn't load) leaves no map;
    // a tile failing later doesn't.
    map.on("error", () => {
      if (!loaded) setFailed(true);
    });

    map.on("load", () => {
      loaded = true;
      const primary = themeColor("--color-primary");
      map.addSource(RADIUS_SOURCE, { type: "geojson", data: EMPTY });
      map.addLayer({
        id: "radius-fill",
        type: "fill",
        source: RADIUS_SOURCE,
        paint: { ...(primary && { "fill-color": primary }), "fill-opacity": 0.12 },
      });
      map.addLayer({
        id: "radius-line",
        type: "line",
        source: RADIUS_SOURCE,
        paint: { ...(primary && { "line-color": primary }), "line-width": 2 },
      });
      setReady(true);
    });

    map.on("click", (event) => {
      if (lockedRef.current) return;
      const point = fromLngLat(event.lngLat);
      if (!pinRef.current) {
        const marker = new Marker({ draggable: true }).setLngLat(event.lngLat).addTo(map);
        marker.getElement().title = "Your pin";
        marker.on("dragend", () => setPin(fromLngLat(marker.getLngLat())));
        pinRef.current = marker;
      } else {
        pinRef.current.setLngLat(event.lngLat);
      }
      setPin(point);
    });

    mapRef.current = map;
    return () => {
      map.remove();
      pinRef.current = null;
      mapRef.current = null;
    };
  }, []);

  // Locked: the pin can't be dragged, and the map ignores clicks and gestures.
  useEffect(() => {
    lockedRef.current = locked;
    pinRef.current?.setDraggable(!locked);
    const map = mapRef.current;
    if (!map) return;
    for (const handler of [
      map.dragPan,
      map.dragRotate,
      map.scrollZoom,
      map.boxZoom,
      map.doubleClickZoom,
      map.keyboard,
      map.touchZoomRotate,
    ]) {
      if (locked) handler.disable();
      else handler.enable();
    }
  }, [locked]);

  // The radius circle, shown once the pin is confirmed, with the map fitted to it.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const source = map.getSource<GeoJSONSource>(RADIUS_SOURCE);
    if (!locked || !pin) {
      source?.setData(EMPTY);
      return;
    }
    const { polygon, bounds } = circlePolygon(pin, km);
    source?.setData(polygon);
    map.fitBounds(bounds, { padding: 24 });
  }, [ready, locked, pin, km]);

  // A dot on the map for each listing and nearby destination in range.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !results) return;
    const place = (point: LatLng, title: string, className: string) => {
      const element = dot(className);
      element.title = title;
      return new Marker({ element }).setLngLat(toLngLat(point)).addTo(map);
    };
    const markers = [
      ...results.listings.map((listing) => place(listing.location, listing.title, "bg-primary")),
      ...results.destinations.map((destination) => place(destination.location, destination.name, "bg-secondary")),
    ];
    return () => markers.forEach((marker) => marker.remove());
  }, [ready, results]);

  const unavailable = failed;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        {unavailable ? (
          <p
            role="status"
            className="flex h-96 w-full items-center justify-center rounded-lg border-[1.5px] border-line-strong bg-surface-2 px-6 text-center text-muted"
          >
            The map couldn&apos;t load. Reload the page to try again.
          </p>
        ) : (
          <div
            ref={containerRef}
            data-testid="nearby-map"
            aria-label="Map: click to drop your pin"
            className="h-96 w-full overflow-hidden rounded-lg border-[1.5px] border-line-strong"
          />
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">
            {!pin
              ? "Click the map to drop your pin."
              : locked
                ? `Pin locked at ${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}.`
                : `Pinned at ${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}. Drag it to adjust, then confirm.`}
          </p>
          {locked ? (
            <Button variant="soft" size="sm" onClick={() => setLocked(false)}>
              Change pin
            </Button>
          ) : (
            <Button data-testid="nearby-confirm" size="sm" disabled={!pin} onClick={() => setLocked(true)}>
              Confirm pin
            </Button>
          )}
        </div>
        <label className="flex flex-col gap-2 text-sm font-medium">
          <span>
            Within <span className="font-semibold text-primary">{km} km</span>
          </span>
          <input
            data-testid="nearby-range"
            type="range"
            min={MIN_KM}
            max={MAX_KM}
            step={1}
            value={km}
            disabled={!locked}
            onChange={(event) => setKm(Number(event.target.value))}
            className="w-full accent-primary disabled:opacity-50"
          />
        </label>
      </div>

      {locked && pin && isError && !results && (
        <p role="alert" className="text-danger">
          Couldn&apos;t load what&apos;s nearby. Try again.
        </p>
      )}

      {results && (
        <div data-testid="nearby-results" className={`flex flex-col gap-6 ${isFetching ? "opacity-60" : ""}`}>
          {results.anchor.isolated_to && (
            <p data-testid="nearby-isolated" className="rounded-lg bg-surface-2 px-4 py-3 text-sm font-medium">
              Showing {results.anchor.isolated_to.name} only: the pin is on the island.
            </p>
          )}
          <div className="grid gap-6 md:grid-cols-2">
            <ResultList
              title="Listings"
              empty="No listings within this distance."
              note="Listing locations are approximate (about 1 km)."
              items={results.listings.map((listing) => ({
                key: `listing-${listing.id}`,
                name: listing.title,
                detail: listing.category,
                distance: `~${listing.distance_km.toFixed(1)} km`,
                dotClass: "bg-primary",
              }))}
            />
            <ResultList
              title="Nearby destinations"
              empty="No destinations within this distance."
              items={results.destinations.map((place) => placeResult(place, "bg-secondary"))}
            />
          </div>
          {results.recommendations.length > 0 && (
            <ResultList
              title="Often visited with"
              empty=""
              items={results.recommendations.map((place) => ({
                ...placeResult(place, "bg-aqua"),
                detail: place.reason === "bundled" ? "Often done on the same trip" : "Next door",
              }))}
            />
          )}
        </div>
      )}
    </div>
  );
}

// A destination in a result list, linking to its area page.
function placeResult(place: ExplorePlace, dotClass: string): Result {
  return {
    key: `${place.type}-${place.slug}`,
    name: place.name,
    detail: place.type === "landmark" ? `Place to see · ${place.area_slug}` : (place.kind ?? "area"),
    distance: `${place.distance_km.toFixed(1)} km`,
    dotClass,
    href: place.type === "landmark" ? `/${place.area_slug}#${place.slug}` : `/${place.slug}`,
  };
}

type Result = { key: string; name: string; detail: string; distance: string; dotClass: string; href?: string };

function ResultList({ title, empty, note, items }: { title: string; empty: string; note?: string; items: Result[] }) {
  return (
    <section className="flex flex-col gap-3">
      <SectionTitle>
        {title} ({items.length})
      </SectionTitle>
      {note && <p className="text-xs text-muted">{note}</p>}
      {items.length === 0 ? (
        <p className="text-muted">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li key={item.key}>
              {item.href ? (
                <CardLink href={item.href} className="flex items-center gap-3 p-3">
                  <ResultRow item={item} />
                </CardLink>
              ) : (
                <Card>
                  <CardBody pad="sm" className="flex items-center gap-3">
                    <ResultRow item={item} />
                  </CardBody>
                </Card>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ResultRow({ item }: { item: Result }) {
  return (
    <>
      <span className={`size-3 shrink-0 rounded-full ${item.dotClass}`} aria-hidden />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium">{item.name}</span>
        <span className="truncate text-xs text-muted">{item.detail}</span>
      </span>
      <span className="shrink-0 text-sm font-semibold">{item.distance}</span>
    </>
  );
}
