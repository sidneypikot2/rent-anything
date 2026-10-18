"use client";

import { LngLatBounds, Map as MapLibreMap, Marker, type GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { isApiPhoto } from "@/components/landing/sample-photos";
import { AddToTripButton } from "@/components/trips/add-to-trip-button";
import type { TripDates } from "@/components/trips/trip-dates";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { Price } from "@/components/ui/typography";
import { circlePolygon, fromLngLat, MAP_STYLE_URL, setMapWorker, toLngLat, type LatLng } from "@/lib/map";
import { useAreaMap } from "./area-map-context";
import { BOOKING_GROUPS } from "./categories";
import { listingPin, placePins, type AreaPin, type LandmarkInfo, type ListingPin } from "./area-map-pins";
import { DetailPanelButton, LandmarkPanel, ListingPanel, PanelActions, PanelPhoto } from "./detail-panel";
import {
  CategoryGlyph,
  CloseGlyph,
  FitGlyph,
  LocateGlyph,
  MinusGlyph,
  PlaceGlyph,
  PlusGlyph,
  RadiusGlyph,
} from "./tag-glyphs";
import { useExplore } from "./use-explore";

const RADIUS_SOURCE = "radius";
const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
const MIN_KM = 1;
const MAX_KM = 50;
const DEFAULT_KM = 5;
const KM_DEBOUNCE_MS = 300;
// How far a stack's pins spread from its point when it opens, in pixels.
const RING_PX = 52;

// A pin's colour by what it is (the pin-* tokens); written out whole so Tailwind finds them.
const PIN_COLOR: Record<string, string> = {
  activity: "bg-pin-activity after:bg-pin-activity",
  transfer: "bg-pin-transfer after:bg-pin-transfer",
  rental: "bg-pin-rental after:bg-pin-rental",
  stay: "bg-pin-stay after:bg-pin-stay",
  place: "bg-navy after:bg-navy",
};
const DOT_COLOR: Record<string, string> = {
  activity: "bg-pin-activity",
  transfer: "bg-pin-transfer",
  rental: "bg-pin-rental",
  stay: "bg-pin-stay",
  place: "bg-navy",
};
const GROUP_NAMES = BOOKING_GROUPS.map(({ group, title }) => [group, title] as const);

function themeColor(name: string): string | undefined {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || undefined;
}

// Listings that round to one point share a stack (their locations are only good to about 1 km).
const pointKey = (pin: { lat: number; lng: number }) => `${pin.lat.toFixed(2)},${pin.lng.toFixed(2)}`;

type Spec =
  | { id: string; kind: "pin"; pin: AreaPin; lngLat: LatLng; offset: [number, number] }
  | { id: string; kind: "stack"; pins: ListingPin[]; lngLat: LatLng };

// An area page's map (beside the sections from lg, full screen on a phone): each listing as a pin
// in its group's colour with its icon and price, places to see as navy pins, listings that share
// a point as one stack that opens into a ring. A pin's pop-up opens in the middle of the map,
// leaving the map where it is. Pins follow What to book's group and filters, and light up with
// the card or row under the pointer. Search by distance drops the guest's pin (a tap, or their
// location) and shows what is within the range, narrowing the rows to match.
export function AreaMap({
  pins,
  center,
  dates,
  datesQuery,
  areaName,
  landmarks,
  full = false,
}: {
  pins: AreaPin[];
  center: LatLng;
  dates: TripDates;
  datesQuery: string;
  areaName: string;
  landmarks: Record<string, LandmarkInfo>;
  full?: boolean;
}) {
  const shared = useAreaMap();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef(new Map<string, Marker>());
  // Each marker's element, which its pin renders into through a portal.
  const [elements, setElements] = useState<Map<string, HTMLElement>>(() => new Map());
  const youRef = useRef<Marker | null>(null);
  const distanceRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [placesOn, setPlacesOn] = useState(true);
  const [distance, setDistance] = useState(false);
  const [you, setYou] = useState<LatLng | null>(null);
  const [km, setKm] = useState(DEFAULT_KM);
  const [queryKm, setQueryKm] = useState(DEFAULT_KM);
  const [locating, setLocating] = useState<"idle" | "busy" | "failed">("idle");

  const hover = shared?.hover ?? null;
  const selected = shared?.selected ?? null;
  const view = shared?.view;
  const setNear = shared?.setNear;

  useEffect(() => {
    const timer = setTimeout(() => setQueryKm(km), KM_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [km]);

  const { data: nearby, isFetching } = useExplore(distance ? you : null, queryKm);
  const results = distance && you ? nearby : undefined;

  // What the rows show while searching by distance: each listing in range with its distance.
  useEffect(() => {
    if (!setNear) return;
    setNear(results ? new Map(results.listings.map((listing) => [listing.id, listing.distance_km])) : null);
  }, [results, setNear]);
  useEffect(() => () => setNear?.(null), [setNear]);

  // The pins on show: the page's, or what a distance search found (reusing what the page knows
  // about each), then What to book's group and filters.
  const shown = useMemo(() => {
    const known = new Map(pins.map((pin) => [pin.key, pin]));
    const landmarkInfo = new Map(Object.entries(landmarks));
    const base: AreaPin[] = results
      ? [
          ...results.listings.map((listing, index) => {
            const page = known.get(`listing-${listing.id}`);
            return listingPin(listing, index, page?.kind === "listing" ? page.info : undefined);
          }),
          ...placePins(results.destinations, landmarkInfo),
        ]
      : pins;
    const hidden = new Set(view?.hidden ?? []);
    return base.filter((pin) =>
      pin.kind === "place"
        ? placesOn
        : (!view?.bookingType || pin.bookingType === view.bookingType) && !hidden.has(pin.id),
    );
  }, [pins, landmarks, results, view, placesOn]);

  const specs = useMemo<Spec[]>(() => {
    const out: Spec[] = [];
    const stacks = new Map<string, ListingPin[]>();
    for (const pin of shown) {
      if (pin.kind === "place") out.push({ id: pin.key, kind: "pin", pin, lngLat: pin, offset: [0, 0] });
      else stacks.set(pointKey(pin), [...(stacks.get(pointKey(pin)) ?? []), pin]);
    }
    for (const [key, group] of stacks) {
      if (group.length === 1) out.push({ id: group[0].key, kind: "pin", pin: group[0], lngLat: group[0], offset: [0, 0] });
      else if (key === expanded)
        group.forEach((pin, index) => {
          const angle = -Math.PI / 2 + (index * 2 * Math.PI) / group.length;
          const radius = RING_PX + group.length * 4;
          out.push({
            id: pin.key,
            kind: "pin",
            pin,
            lngLat: pin,
            offset: [Math.round(Math.cos(angle) * radius), Math.round(Math.sin(angle) * radius + 16)],
          });
        });
      else out.push({ id: `stack-${key}`, kind: "stack", pins: group, lngLat: group[0] });
    }
    return out;
  }, [shown, expanded]);

  useEffect(() => {
    if (!containerRef.current) return;
    setMapWorker();
    let map: MapLibreMap;
    try {
      map = new MapLibreMap({
        container: containerRef.current,
        style: MAP_STYLE_URL,
        center: toLngLat(center),
        zoom: 11,
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
      map.addSource(RADIUS_SOURCE, { type: "geojson", data: EMPTY });
      map.addLayer({ id: "radius-fill", type: "fill", source: RADIUS_SOURCE, paint: { ...(primary && { "fill-color": primary }), "fill-opacity": 0.1 } });
      map.addLayer({
        id: "radius-line",
        type: "line",
        source: RADIUS_SOURCE,
        paint: { ...(primary && { "line-color": primary }), "line-width": 2, "line-dasharray": [2, 2] },
      });
      setReady(true);
    });
    const markers = markersRef.current;
    mapRef.current = map;
    return () => {
      markers.forEach((marker) => marker.remove());
      markers.clear();
      youRef.current?.remove();
      youRef.current = null;
      map.remove();
      mapRef.current = null;
    };
    // The map is made once; later centres come from fitting the pins.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A tap on the map itself: drops the guest's pin while searching by distance, else closes
  // the pop-up and any open stack. Taps on a pin are the pin's own.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const onClick = (event: { originalEvent: MouseEvent; lngLat: { lng: number; lat: number } }) => {
      if ((event.originalEvent.target as HTMLElement | null)?.closest("[data-map-pin]")) return;
      if (distanceRef.current) {
        setYou(fromLngLat(event.lngLat));
        return;
      }
      shared?.setSelected(null);
      setExpanded(null);
    };
    map.on("click", onClick);
    return () => {
      map.off("click", onClick);
    };
  }, [ready, shared]);

  // Markers follow the specs: new ones added, gone ones removed, a ring's offsets updated.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const markers = markersRef.current;
    const ids = new Set(specs.map((spec) => spec.id));
    for (const [id, marker] of markers)
      if (!ids.has(id)) {
        marker.remove();
        markers.delete(id);
      }
    for (const spec of specs) {
      const offset: [number, number] = spec.kind === "pin" ? spec.offset : [0, 0];
      const marker = markers.get(spec.id);
      if (marker) marker.setLngLat(toLngLat(spec.lngLat)).setOffset(offset);
      else {
        const element = document.createElement("div");
        element.dataset.mapPin = spec.id;
        markers.set(spec.id, new Marker({ element, anchor: "bottom", offset }).setLngLat(toLngLat(spec.lngLat)).addTo(map));
      }
    }
    setElements(new Map([...markers].map(([id, marker]) => [id, marker.getElement()])));
  }, [ready, specs]);

  // The lit and the open pin sit over their neighbours.
  useEffect(() => {
    const litStack = specs.find((spec) => spec.kind === "stack" && spec.pins.some((pin) => pin.key === hover))?.id;
    markersRef.current.forEach((marker, id) => {
      marker.getElement().style.zIndex = id === selected ? "3" : id === hover || id === litStack ? "2" : "";
    });
  }, [hover, selected, specs, elements]);

  // On load: to the pin the URL names (a search for a place lands on it), else every pin.
  const fit = (list: { lat: number; lng: number }[], animate = true) => {
    const map = mapRef.current;
    if (!map || list.length === 0) return;
    const bounds = list.reduce((box, pin) => box.extend(toLngLat(pin)), new LngLatBounds(toLngLat(list[0]), toLngLat(list[0])));
    map.fitBounds(bounds, { padding: full ? { top: 80, bottom: 120, left: 40, right: 40 } : 64, maxZoom: 14, animate });
  };
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const hash = decodeURIComponent(window.location.hash.slice(1));
    const target = pins.find((pin) => (pin.kind === "place" ? pin.slug === hash : `listing-${pin.id}` === hash));
    if (target) {
      map.jumpTo({ center: toLngLat(target), zoom: 14 });
      shared?.setSelected(target.key);
    } else fit(shown, false);
    // Once, when the map is ready.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // Another group picked in What to book: fit to its pins.
  const bookingType = view?.bookingType ?? null;
  const firstFit = useRef(true);
  useEffect(() => {
    if (!ready) return;
    if (firstFit.current) {
      firstFit.current = false;
      return;
    }
    if (!distance) fit(shown);
    // Only when the group changes, not on every filter or hover.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingType]);

  // Distance search: the guest's pin (draggable), the circle, and the map fitted to it.
  useEffect(() => {
    distanceRef.current = distance;
    const map = mapRef.current;
    if (!ready || !map) return;
    map.getCanvas().style.cursor = distance ? "crosshair" : "";
    const source = map.getSource<GeoJSONSource>(RADIUS_SOURCE);
    if (!distance || !you) {
      source?.setData(EMPTY);
      youRef.current?.remove();
      youRef.current = null;
      return;
    }
    if (!youRef.current) {
      const element = document.createElement("div");
      element.dataset.mapPin = "you";
      element.title = "Your pin: drag to move it";
      element.className = "cursor-grab pb-1";
      // The teardrop is turned inside the marker: turning the marker itself would turn the
      // offset MapLibre places it with, and the pin would drift off its point.
      const drop = document.createElement("span");
      drop.className = "block size-8 -rotate-45 rounded-[50%_50%_50%_0] border-[3px] border-surface bg-primary shadow-lift";
      element.append(drop);
      const marker = new Marker({ element, draggable: true, anchor: "bottom" }).setLngLat(toLngLat(you)).addTo(map);
      marker.on("dragend", () => setYou(fromLngLat(marker.getLngLat())));
      youRef.current = marker;
    } else youRef.current.setLngLat(toLngLat(you));
    const { polygon, bounds } = circlePolygon(you, km);
    source?.setData(polygon);
    map.fitBounds(bounds, { padding: full ? { top: 80, bottom: 260, left: 24, right: 24 } : 40 });
  }, [ready, distance, you, km, full]);

  const select = (pin: AreaPin) => {
    shared?.setSelected(pin.key);
    // Beside the rows, the picked listing's row comes into view too.
    if (!full && pin.kind === "listing")
      document.getElementById(`listing-${pin.id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  const locate = () => {
    if (!navigator.geolocation) {
      setLocating("failed");
      return;
    }
    setLocating("busy");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating("idle");
        setYou({ lat: position.coords.latitude, lng: position.coords.longitude });
      },
      () => setLocating("failed"),
      { enableHighAccuracy: false, timeout: 10_000 },
    );
  };

  const open = selected ? shown.find((pin) => pin.key === selected) ?? null : null;
  const near = results ? new Map(results.listings.map((listing) => [listing.id, listing.distance_km])) : null;
  const groupsShown = GROUP_NAMES.filter(([type]) => pins.some((pin) => pin.kind === "listing" && pin.bookingType === type));

  if (failed)
    return (
      <p role="status" className="flex h-full items-center justify-center rounded-card bg-surface-2 p-6 text-center text-muted card-edge">
        The map couldn&apos;t load. Reload the page to try again.
      </p>
    );

  return (
    <div className={cn("relative h-full w-full overflow-hidden bg-sky-mist", !full && "rounded-card card-edge shadow-soft")}>
      {/* MapLibre makes its container position: relative, so it fills by size, not by inset. */}
      <div ref={containerRef} data-testid="area-map" aria-label={`Map of ${areaName}`} className="h-full w-full" />

      {specs.map((spec) => {
        const element = elements.get(spec.id);
        return element && createPortal(
          spec.kind === "pin" ? (
            <PinButton
              pin={spec.pin}
              lit={hover === spec.pin.key}
              open={selected === spec.pin.key}
              onSelect={() => select(spec.pin)}
              onHover={(on) => shared?.setHover(on ? spec.pin.key : null)}
            />
          ) : (
            <StackButton
              pins={spec.pins}
              lit={spec.pins.some((pin) => pin.key === hover)}
              onOpen={() => {
                setExpanded(spec.id.slice("stack-".length));
                shared?.setSelected(null);
              }}
            />
          ),
          element,
          spec.id,
        );
      })}

      {/* Distance search and the zoom, over the map's corners. */}
      <div className={cn("absolute top-3 left-3 z-10 flex flex-wrap gap-2", full ? "right-3" : "right-16")}>
        <MapButton
          pressed={distance}
          onClick={() => {
            setDistance(!distance);
            setYou(null);
            setExpanded(null);
            shared?.setSelected(null);
          }}
          data-testid="map-distance"
        >
          <RadiusGlyph className="size-4.5" />
          Search by distance
        </MapButton>
      </div>
      <div className={cn("absolute right-3 z-10 flex flex-col overflow-hidden rounded-control bg-surface card-edge shadow-lift", full ? "top-16" : "top-3")}>
        <ZoomButton label="Zoom in" onClick={() => mapRef.current?.zoomIn()}>
          <PlusGlyph className="size-4.5" />
        </ZoomButton>
        <ZoomButton label="Zoom out" onClick={() => mapRef.current?.zoomOut()}>
          <MinusGlyph className="size-4.5" />
        </ZoomButton>
        <ZoomButton
          label="Show every pin"
          onClick={() => {
            setExpanded(null);
            fit(results && you ? [you, ...shown] : shown);
          }}
        >
          <FitGlyph className="size-4.5" />
        </ZoomButton>
      </div>

      {distance && (
        <Card
          role="region"
          aria-label="Search by distance"
          className={cn("absolute z-10 flex flex-col gap-2.5 p-4", full ? "inset-x-0 bottom-0 rounded-b-none pb-24" : "top-16 left-3 w-[min(19rem,calc(100%-1.5rem))]")}
        >
          {you ? (
            <>
              <p className="text-sm font-semibold">
                Within <span className="text-primary">{km} km</span> of your pin
              </p>
              <input
                type="range"
                min={MIN_KM}
                max={MAX_KM}
                step={1}
                value={km}
                aria-label="Distance in km"
                data-testid="map-distance-range"
                onChange={(event) => setKm(Number(event.target.value))}
                className="w-full accent-primary"
              />
              <p className={cn("text-xs text-muted", isFetching && "opacity-60")} role="status">
                {results
                  ? `${results.listings.length} to book and ${results.destinations.filter((place) => place.type === "landmark").length} places to see. Drag the pin, or tap the map to move it.`
                  : "Looking around your pin…"}
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold">Drop a pin</p>
              <p className="text-xs text-muted">Tap the map where you&apos;ll be, like your stay or the pier, or use your location.</p>
            </>
          )}
          {locating === "failed" && <p className="text-xs text-danger">Couldn&apos;t get your location. Tap the map instead.</p>}
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="soft" size="sm" onClick={locate} disabled={locating === "busy"}>
              <LocateGlyph className="size-4" />
              {locating === "busy" ? "Finding you…" : "Use my location"}
            </Button>
            {you && (
              <button type="button" onClick={() => setYou(null)} className="px-2 text-sm font-semibold text-link underline-offset-4 hover:underline">
                Clear
              </button>
            )}
          </div>
        </Card>
      )}

      {!distance && (
        <details className={cn("absolute left-3 z-10 rounded-control bg-surface px-3 py-2 text-xs font-semibold card-edge shadow-lift", full ? "bottom-24" : "bottom-3")} open={!full}>
          <summary className="cursor-pointer list-none">Key</summary>
          <ul className="mt-1.5 flex flex-col gap-1">
            {groupsShown.map(([type, name]) => (
              <li key={type} className="flex items-center gap-2">
                <span aria-hidden className={cn("size-2.5 rounded-full", DOT_COLOR[type])} />
                {name}
              </li>
            ))}
            <li>
              <label className="flex cursor-pointer items-center gap-2">
                <input type="checkbox" checked={placesOn} onChange={(event) => setPlacesOn(event.target.checked)} className="accent-primary" />
                <span aria-hidden className="size-2.5 rounded-full bg-navy" />
                Places to see
              </label>
            </li>
          </ul>
          <p className="mt-1.5 max-w-52 font-normal text-muted">Pins sit within about 1 km of the listing; the exact spot comes with the booking.</p>
        </details>
      )}

      {open && (
        <MapPopup
          key={open.key}
          pin={open}
          full={full}
          distanceKm={open.kind === "listing" ? near?.get(open.id) : undefined}
          dates={dates}
          datesQuery={datesQuery}
          areaName={areaName}
          onClose={() => shared?.setSelected(null)}
        />
      )}
    </div>
  );
}

function MapButton({
  pressed,
  onClick,
  children,
  "data-testid": testId,
}: {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
  "data-testid"?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      data-testid={testId}
      className={cn(
        "flex min-h-10 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold card-edge shadow-lift transition-colors duration-300 ease-calm",
        pressed ? "bg-primary text-white" : "bg-surface text-foreground [&_svg]:text-primary",
      )}
    >
      {children}
    </button>
  );
}

function ZoomButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-label={label} onClick={onClick} className="flex size-10 items-center justify-center border-line not-first:border-t hover:bg-surface-2">
      {children}
    </button>
  );
}

// A pin: its group's colour, its category icon and, once it has one, its price; a place to see
// is a navy disc with the place icon.
function PinButton({
  pin,
  lit,
  open,
  onSelect,
  onHover,
}: {
  pin: AreaPin;
  lit: boolean;
  open: boolean;
  onSelect: () => void;
  onHover: (on: boolean) => void;
}) {
  const color = PIN_COLOR[pin.kind === "place" ? "place" : pin.bookingType] ?? PIN_COLOR.place;
  return (
    <button
      type="button"
      onClick={onSelect}
      onPointerEnter={() => onHover(true)}
      onPointerLeave={() => onHover(false)}
      aria-label={pin.kind === "listing" && pin.price ? `${pin.title}, from ${pin.price.amount}` : pin.title}
      aria-pressed={open}
      data-testid="map-pin"
      className={cn(
        "relative mb-1.5 flex h-8 items-center gap-1.5 rounded-full border-2 border-surface text-small font-bold whitespace-nowrap text-white tabular-nums shadow-lift transition-transform duration-300 ease-calm",
        "after:absolute after:-bottom-1.5 after:left-1/2 after:size-2.5 after:-translate-x-1/2 after:rotate-45 after:border-r-2 after:border-b-2 after:border-surface after:content-['']",
        color,
        pin.kind === "place" ? "w-8 justify-center" : pin.price ? "pr-3 pl-2" : "px-1.5",
        (lit || open) && "scale-110",
        open && "ring-4 ring-sky-pale",
      )}
    >
      <span className="relative z-10 flex items-center gap-1.5">
        {pin.kind === "place" ? <PlaceGlyph className="size-4" /> : <CategoryGlyph name={pin.category} className="size-4" />}
        {pin.kind === "listing" && pin.price && pin.price.amount}
      </span>
    </button>
  );
}

// Listings that share a point: a dot per group in it and the count; a tap spreads them out.
function StackButton({ pins, lit, onOpen }: { pins: ListingPin[]; lit: boolean; onOpen: () => void }) {
  const types = [...new Set(pins.map((pin) => pin.bookingType))].slice(0, 3);
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${pins.length} listings here: show them`}
      data-testid="map-stack"
      className={cn(
        "mb-1 flex h-9 items-center gap-1.5 rounded-full border-2 border-surface bg-navy pr-3 pl-1.5 text-small font-extrabold text-white shadow-lift transition-shadow duration-300 ease-calm",
        lit && "ring-4 ring-sky-pale",
      )}
    >
      <span aria-hidden className="flex">
        {types.map((type) => (
          <span key={type} className={cn("-ml-1.5 size-4 rounded-full border-2 border-navy first:ml-0", DOT_COLOR[type])} />
        ))}
      </span>
      {pins.length}
      <span className="font-semibold text-sky-pale">here</span>
    </button>
  );
}

// A pin's pop-up, in the middle of the map (a card along the bottom on a phone): its photo,
// name, what it is, its price and Add to trip; the name opens the side panel the rows open.
function MapPopup({
  pin,
  full,
  distanceKm,
  dates,
  datesQuery,
  areaName,
  onClose,
}: {
  pin: AreaPin;
  full: boolean;
  distanceKm?: number;
  dates: TripDates;
  datesQuery: string;
  areaName: string;
  onClose: () => void;
}) {
  const price = pin.kind === "listing" && pin.price ? { prefix: "from", amount: pin.price.amount, unit: pin.price.unit } : undefined;
  const action =
    pin.kind === "listing" ? (
      <AddToTripButton listing={{ id: pin.id, title: pin.title, booking_type: pin.bookingType }} dates={dates} />
    ) : undefined;
  const title =
    pin.kind === "listing" ? (
      <DetailPanelButton
        title={pin.title}
        media={<PanelPhoto photo={pin.photo} />}
        panel={
          <ListingPanel
            listingId={pin.id}
            href={`/listings/${pin.id}${datesQuery}`}
            category={pin.category}
            by={pin.info?.by ?? ""}
            summary={pin.info?.summary}
            features={pin.info?.features ?? []}
          />
        }
        actions={<PanelActions price={price} action={action} />}
        className="underline-offset-4 hover:underline"
        data-testid="map-popup-open"
      >
        {pin.title}
      </DetailPanelButton>
    ) : pin.landmark ? (
      <DetailPanelButton
        title={pin.title}
        media={<PanelPhoto photo={pin.photo} />}
        panel={<LandmarkPanel landmark={pin.landmark} areaName={areaName} />}
        className="underline-offset-4 hover:underline"
        data-testid="map-popup-open"
      >
        {pin.title}
      </DetailPanelButton>
    ) : (
      <Link href={`/${pin.areaSlug}#${pin.slug}`} className="underline-offset-4 hover:underline">
        {pin.title}
      </Link>
    );

  return (
    <Card
      role="dialog"
      aria-label={pin.title}
      data-testid="map-popup"
      className={cn(
        "absolute z-20 shadow-float",
        full
          ? "inset-x-3 bottom-24 grid grid-cols-[7rem_minmax(0,1fr)]"
          : "top-1/2 left-1/2 w-72 max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2",
      )}
    >
      <div className={cn("relative bg-mist", full ? "min-h-full" : "aspect-[16/9]")}>
        <Image src={pin.photo.src} alt={pin.photo.alt} fill unoptimized={isApiPhoto(pin.photo.src)} sizes="18rem" className="object-cover" />
      </div>
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute top-2 right-2 z-20 flex size-8 items-center justify-center rounded-full bg-scrim/55 text-white backdrop-blur-sm"
      >
        <CloseGlyph className="size-4" />
      </button>
      <div className="flex min-w-0 flex-col gap-2 p-3.5">
        <h3 className="pr-8 font-semibold leading-snug">{title}</h3>
        <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
          <Badge tone="mist" className="min-h-6 px-2.5 text-xs">
            {pin.kind === "listing" ? <CategoryGlyph name={pin.category} className="size-3.5" /> : <PlaceGlyph className="size-3.5" />}
            {pin.kind === "listing" ? pin.category : "Place to see"}
          </Badge>
          {distanceKm !== undefined && <span className="font-semibold text-foreground">{distanceKm.toFixed(1)} km from your pin</span>}
        </p>
        {pin.kind === "listing" && <p className="text-xs text-muted">Approximate location</p>}
        {(price || action) && (
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-2">
            {price ? <Price {...price} /> : <span />}
            {action}
          </div>
        )}
      </div>
    </Card>
  );
}
