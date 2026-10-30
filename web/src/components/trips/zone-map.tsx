"use client";

import { Map as MapLibreMap, Marker, type GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/components/ui/cn";
import { circlePolygon, fromLngLat, MAP_STYLE_URL, setMapWorker, toLngLat, type LatLng } from "@/lib/map";
import { zoneLabel, type DeliveryZone } from "./delivery-zones";

const ZONES_SOURCE = "zones";
const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
// A degree of latitude, in km: where a ring's label goes, at its top.
const KM_PER_DEGREE = 110.6;

function themeColor(name: string): string | undefined {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || undefined;
}

// A shop's delivery zones (RAA-205) as rings around `center`, each labelled with its fee and
// reach, the map fitted to the farthest. The partner's (`shop`) is drawn around its exact pin,
// with the shop marked; a guest's around the listing's rounded point (`approximate`: dashed,
// no shop). With `onPin` the guest taps or drags a pin to where the rider meets them (`pin`).
// Load it with next/dynamic: MapLibre stays out of the page until a map shows.
export default function ZoneMap({
  center,
  zones,
  pin,
  onPin,
  shop = false,
  approximate = false,
  className,
}: {
  center: LatLng;
  zones: DeliveryZone[];
  pin?: LatLng | null;
  onPin?: (point: LatLng) => void;
  shop?: boolean;
  approximate?: boolean;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const pinRef = useRef<Marker | null>(null);
  const onPinRef = useRef(onPin);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    onPinRef.current = onPin;
  }, [onPin]);
  const initialRef = useRef({ center, pin });

  useEffect(() => {
    if (!containerRef.current) return;
    setMapWorker();
    let map: MapLibreMap;
    try {
      map = new MapLibreMap({
        container: containerRef.current,
        style: MAP_STYLE_URL,
        center: toLngLat(initialRef.current.pin ?? initialRef.current.center),
        zoom: 13,
        attributionControl: { compact: true },
      });
    } catch {
      queueMicrotask(() => setFailed(true));
      return;
    }
    let loaded = false;
    map.on("error", () => {
      if (!loaded) setFailed(true);
    });
    map.on("load", () => {
      loaded = true;
      const primary = themeColor("--color-primary");
      map.addSource(ZONES_SOURCE, { type: "geojson", data: EMPTY });
      map.addLayer({
        id: "zones-fill",
        type: "fill",
        source: ZONES_SOURCE,
        paint: { ...(primary && { "fill-color": primary }), "fill-opacity": 0.08 },
      });
      map.addLayer({
        id: "zones-line",
        type: "line",
        source: ZONES_SOURCE,
        paint: { ...(primary && { "line-color": primary }), "line-width": 2, ...(approximate && { "line-dasharray": [2, 2] }) },
      });
      setReady(true);
    });
    map.on("click", (event) => onPinRef.current?.(fromLngLat(event.lngLat)));
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      pinRef.current = null;
    };
  }, [approximate]);

  // The rings, their labels and the shop, redrawn as the zones change; fitted to the farthest.
  const key = JSON.stringify(zones);
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const sorted = [...zones].filter((zone) => zone.max_distance_m > 0).sort((a, b) => a.max_distance_m - b.max_distance_m);
    const circles = sorted.map((zone) => circlePolygon(center, zone.max_distance_m / 1000));
    map.getSource<GeoJSONSource>(ZONES_SOURCE)?.setData({
      type: "FeatureCollection",
      features: circles.map(({ polygon }) => ({ type: "Feature", geometry: polygon, properties: {} })),
    });
    const labels = sorted.map((zone) => {
      const element = document.createElement("span");
      element.className = "rounded-chip bg-surface px-2 py-0.5 text-small font-semibold text-foreground shadow-soft";
      element.textContent = zoneLabel(zone);
      const top = { lat: center.lat + zone.max_distance_m / 1000 / KM_PER_DEGREE, lng: center.lng };
      return new Marker({ element }).setLngLat(toLngLat(top)).addTo(map);
    });
    let marker: Marker | undefined;
    if (shop) {
      const element = document.createElement("span");
      element.className = "block size-4 rounded-full border-2 border-surface bg-foreground shadow";
      element.title = "Your shop";
      marker = new Marker({ element }).setLngLat(toLngLat(center)).addTo(map);
    }
    const farthest = circles.at(-1);
    if (farthest && !initialRef.current.pin) map.fitBounds(farthest.bounds, { padding: 24, animate: false });
    return () => {
      labels.forEach((label) => label.remove());
      marker?.remove();
    };
    // `key` stands for the zones' contents.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, key, center.lat, center.lng, shop]);

  // The guest's pin, draggable, moved when it is set from outside (a picked address).
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    if (!pin) {
      pinRef.current?.remove();
      pinRef.current = null;
      return;
    }
    if (!pinRef.current) {
      const marker = new Marker({ draggable: Boolean(onPinRef.current) }).setLngLat(toLngLat(pin)).addTo(map);
      marker.getElement().title = "Where the rider meets you";
      marker.on("dragend", () => onPinRef.current?.(fromLngLat(marker.getLngLat())));
      pinRef.current = marker;
    } else {
      const at = pinRef.current.getLngLat();
      if (at.lat === pin.lat && at.lng === pin.lng) return;
      pinRef.current.setLngLat(toLngLat(pin));
    }
    map.easeTo({ center: toLngLat(pin), zoom: Math.max(map.getZoom(), 14) });
  }, [ready, pin]);

  if (failed) {
    return <p className="text-sm text-muted">The map couldn&apos;t load here. Search for the place above instead.</p>;
  }
  return <div ref={containerRef} className={cn("h-64 w-full overflow-hidden rounded-control border border-line", className)} data-testid="zone-map" />;
}
