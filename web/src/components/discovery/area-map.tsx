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
import type { AddPreview } from "@/components/trips/use-trips";
import { pricedByText } from "@/lib/pricing";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { Price } from "@/components/ui/typography";
import { circlePolygon, fromLngLat, MAP_STYLE_URL, setMapWorker, toLngLat, type LatLng } from "@/lib/map";
import { useAreaMap } from "./area-map-context";
import { TRIP_ORDER_GROUPS } from "./categories";
import { listingPin, placePins, type AreaPin, type LandmarkInfo, type ListingPin } from "./area-map-pins";
import { DetailPanelButton, LandmarkPanel, ListingPanel, PanelActions, PanelPhoto } from "./detail-panel";
import { InstantBookBadge } from "./instant-book-badge";
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
// How close two stacks' points can come on screen before they merge into one, in pixels.
const MERGE_PX = 56;
// How far apart places to see at one spot sit, side by side, in pixels.
const BUNDLE_PX = 38;
// How far a stack's pins spread from its point when it opens, in pixels.
const RING_PX = 52;
// A stack with more pins than this opens as a list over the map: a ring of twenty is a tangle,
// and zooming in on listings a few hundred metres apart only splits them in two.
const RING_MAX = 6;
// From this zoom a place to see shows its name beside its pin (the island in view, not the province).
const PLACE_LABEL_ZOOM = 12;

// A pin's colour by what it is (the pin-* tokens); written out whole so Tailwind finds them.
const PIN_COLOR: Record<string, string> = {
  activity: "bg-pin-activity after:bg-pin-activity",
  transfer: "bg-pin-transfer after:bg-pin-transfer",
  rental: "bg-pin-rental after:bg-pin-rental",
  stay: "bg-pin-stay after:bg-pin-stay",
  gear: "bg-pin-rental after:bg-pin-rental",
  place: "bg-navy after:bg-navy",
};
const DOT_COLOR: Record<string, string> = {
  activity: "bg-pin-activity",
  transfer: "bg-pin-transfer",
  rental: "bg-pin-rental",
  stay: "bg-pin-stay",
  gear: "bg-pin-rental",
  place: "bg-navy",
};
const NO_HOVER: string[] = [];
const GROUP_NAMES = TRIP_ORDER_GROUPS.map(({ group, title }) => [group, title] as const);

function themeColor(name: string): string | undefined {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || undefined;
}

// A point's place on the Web Mercator world at a zoom, in MapLibre's pixels (512px tiles): what
// tells two stacks that would overlap on screen.
function worldPixel({ lat, lng }: LatLng, zoom: number) {
  const size = 512 * 2 ** zoom;
  const sin = Math.sin((lat * Math.PI) / 180);
  return { x: ((lng + 180) / 360) * size, y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * size };
}

// Listings that round to one point share a stack (their locations are only good to about 1 km).
const pointKey = (pin: { lat: number; lng: number }) => `${pin.lat.toFixed(2)},${pin.lng.toFixed(2)}`;

type Spec =
  | { id: string; kind: "pin"; pin: AreaPin; lngLat: LatLng; offset: [number, number] }
  // `spread`: its pins are at more than one point, merged only because they overlap at this zoom.
  | { id: string; kind: "stack"; pins: ListingPin[]; lngLat: LatLng; offset: [number, number]; spread: boolean };

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
  // The stack open as a list (RING_MAX), by its spec id.
  const [listed, setListed] = useState<string | null>(null);
  const [zoom, setZoom] = useState(0);
  const [placesOn, setPlacesOn] = useState(true);
  const [distance, setDistance] = useState(false);
  const [you, setYou] = useState<LatLng | null>(null);
  const [km, setKm] = useState(DEFAULT_KM);
  const [queryKm, setQueryKm] = useState(DEFAULT_KM);
  const [locating, setLocating] = useState<"idle" | "busy" | "failed">("idle");

  const hover = shared?.hover ?? NO_HOVER;
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
          ...results.listings.map((listing) => {
            const page = known.get(`listing-${listing.id}`);
            return listingPin(listing, page?.kind === "listing" ? page.info : undefined);
          }),
          ...placePins(results.destinations, landmarkInfo),
        ]
      : pins;
    const hidden = new Set(view?.hidden ?? []);
    return base.filter((pin) =>
      pin.kind === "place" ? placesOn : (!view?.group || pin.group === view.group) && !hidden.has(pin.id),
    );
  }, [pins, landmarks, results, view, placesOn]);

  const specs = useMemo<Spec[]>(() => {
    const out: Spec[] = [];
    const points = new Map<string, ListingPin[]>();
    for (const pin of shown) {
      if (pin.kind === "place") out.push({ id: pin.key, kind: "pin", pin, lngLat: pin, offset: [0, 0] });
      else points.set(pointKey(pin), [...(points.get(pointKey(pin)) ?? []), pin]);
    }
    // Points that would overlap at this zoom share one stack too, at the biggest one's point, so
    // "9 here" and "11 here" never sit on top of each other.
    const stacks: { key: string; anchor: ListingPin; pins: ListingPin[]; at: { x: number; y: number } | null }[] = [];
    for (const [key, group] of [...points].sort((a, b) => b[1].length - a[1].length)) {
      const at = ready ? worldPixel(group[0], zoom) : null;
      const near =
        at && stacks.find((stack) => stack.at && Math.hypot(stack.at.x - at.x, stack.at.y - at.y) < MERGE_PX);
      if (near) near.pins.push(...group);
      else stacks.push({ key, anchor: group[0], pins: [...group], at });
    }
    for (const { key, anchor, pins: group } of stacks) {
      if (group.length === 1)
        out.push({ id: group[0].key, kind: "pin", pin: group[0], lngLat: group[0], offset: [0, 0] });
      else if (key === expanded)
        group.forEach((pin, index) => {
          const angle = -Math.PI / 2 + (index * 2 * Math.PI) / group.length;
          const radius = RING_PX + group.length * 4;
          out.push({
            id: pin.key,
            kind: "pin",
            pin,
            // Around the stack's point: a merged stack's pins don't share one.
            lngLat: anchor,
            offset: [Math.round(Math.cos(angle) * radius), Math.round(Math.sin(angle) * radius + 16)],
          });
        });
      else
        out.push({
          id: `stack-${key}`,
          kind: "stack",
          pins: group,
          lngLat: anchor,
          offset: [0, 0],
          spread: new Set(group.map(pointKey)).size > 1,
        });
    }
    // Places to see that would cover each other (a few in one town) sit side by side, in a row at
    // the first one's point, rather than as one disc hiding the rest.
    if (!ready) return out;
    const bundles: { at: { x: number; y: number }; members: Spec[] }[] = [];
    for (const spec of out) {
      if (spec.kind !== "pin" || spec.pin.kind !== "place") continue;
      const at = worldPixel(spec.lngLat, zoom);
      const bundle = bundles.find((each) => Math.hypot(each.at.x - at.x, each.at.y - at.y) < MERGE_PX);
      if (bundle) bundle.members.push(spec);
      else bundles.push({ at, members: [spec] });
    }
    for (const { members } of bundles) {
      if (members.length < 2) continue;
      const anchor = members[0].lngLat;
      members.forEach((spec, index) => {
        spec.lngLat = anchor;
        spec.offset = [Math.round((index - (members.length - 1) / 2) * BUNDLE_PX), 0];
      });
    }
    return out;
  }, [shown, expanded, ready, zoom]);

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
      map.addLayer({
        id: "radius-fill",
        type: "fill",
        source: RADIUS_SOURCE,
        paint: { ...(primary && { "fill-color": primary }), "fill-opacity": 0.1 },
      });
      map.addLayer({
        id: "radius-line",
        type: "line",
        source: RADIUS_SOURCE,
        paint: { ...(primary && { "line-color": primary }), "line-width": 2, "line-dasharray": [2, 2] },
      });
      setZoom(map.getZoom());
      setReady(true);
    });
    map.on("zoomend", () => setZoom(map.getZoom()));
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
      setListed(null);
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
      const offset = spec.offset;
      const marker = markers.get(spec.id);
      if (marker) marker.setLngLat(toLngLat(spec.lngLat)).setOffset(offset);
      else {
        const element = document.createElement("div");
        element.dataset.mapPin = spec.id;
        markers.set(
          spec.id,
          new Marker({ element, anchor: "bottom", offset }).setLngLat(toLngLat(spec.lngLat)).addTo(map),
        );
      }
    }
    setElements(new Map([...markers].map(([id, marker]) => [id, marker.getElement()])));
  }, [ready, specs]);

  // The lit and the open pin sit over their neighbours.
  useEffect(() => {
    const litStack = specs.find(
      (spec) => spec.kind === "stack" && spec.pins.some((pin) => hover.includes(pin.key)),
    )?.id;
    markersRef.current.forEach((marker, id) => {
      marker.getElement().style.zIndex = id === selected ? "3" : hover.includes(id) || id === litStack ? "2" : "";
    });
  }, [hover, selected, specs, elements]);

  // On load: to the pin the URL names (a search for a place lands on it), else every pin.
  const fit = (list: { lat: number; lng: number }[], animate = true, maxZoom = 14) => {
    const map = mapRef.current;
    if (!map || list.length === 0) return;
    const bounds = list.reduce(
      (box, pin) => box.extend(toLngLat(pin)),
      new LngLatBounds(toLngLat(list[0]), toLngLat(list[0])),
    );
    // Clear of the buttons along the top and the key at the foot, and a pin's height above its point.
    map.fitBounds(bounds, {
      padding: full ? { top: 120, bottom: 120, left: 40, right: 40 } : { top: 110, bottom: 64, left: 64, right: 64 },
      maxZoom,
      animate,
    });
  };
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const hash = decodeURIComponent(window.location.hash.slice(1));
    const target = pins.find((pin) => (pin.kind === "place" ? pin.slug === hash : `listing-${pin.id}` === hash));
    if (target) {
      map.jumpTo({ center: toLngLat(target), zoom: 14 });
      shared?.setSelected(target.key);
    } else {
      // Where the listings are, close enough that they part; "Show every pin" takes in the places too.
      const listings = shown.filter((pin) => pin.kind === "listing");
      fit(listings.length > 0 ? listings : shown, false);
    }
    // Once, when the map is ready.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // Another group picked in What to book: fit to its pins.
  const shownGroup = view?.group ?? null;
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
  }, [shownGroup]);

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
      drop.className =
        "block size-8 -rotate-45 rounded-[50%_50%_50%_0] border-[3px] border-surface bg-primary shadow-lift";
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

  const open = selected ? (shown.find((pin) => pin.key === selected) ?? null) : null;
  const listedStack = specs.find(
    (spec): spec is Extract<Spec, { kind: "stack" }> => spec.kind === "stack" && spec.id === listed,
  );
  const near = results ? new Map(results.listings.map((listing) => [listing.id, listing.distance_km])) : null;
  const groupsShown = GROUP_NAMES.filter(([type]) => pins.some((pin) => pin.kind === "listing" && pin.group === type));

  if (failed)
    return (
      <p
        role="status"
        className="flex h-full items-center justify-center rounded-card bg-surface-2 p-6 text-center text-muted card-edge"
      >
        The map couldn&apos;t load. Reload the page to try again.
      </p>
    );

  return (
    <div
      className={cn(
        "relative h-full w-full overflow-hidden bg-sky-mist",
        // Full screen, the map's credits sit above the List button at the window's foot.
        full ? "[&_.maplibregl-ctrl-bottom-right]:mb-24" : "rounded-card card-edge shadow-soft",
      )}
    >
      {/* MapLibre makes its container position: relative, so it fills by size, not by inset. */}
      <div ref={containerRef} data-testid="area-map" aria-label={`Map of ${areaName}`} className="h-full w-full" />
      {/* Until the style and first tiles are in, so a slow connection doesn't show a blank panel. */}
      {!ready && (
        <div role="status" className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="flex items-center gap-2 rounded-full bg-surface px-4 py-2 text-sm font-semibold text-muted card-edge shadow-soft">
            <span aria-hidden className="size-2 rounded-full bg-primary motion-safe:animate-pulse" />
            Loading the map…
          </span>
        </div>
      )}

      {specs.map((spec) => {
        const element = elements.get(spec.id);
        return (
          element &&
          createPortal(
            spec.kind === "pin" ? (
              <PinButton
                pin={spec.pin}
                label={spec.pin.kind === "place" && zoom >= PLACE_LABEL_ZOOM}
                lit={hover.includes(spec.pin.key)}
                open={selected === spec.pin.key}
                onSelect={() => select(spec.pin)}
                onHover={(on) => shared?.setHover(on ? spec.pin.key : null)}
              />
            ) : (
              <StackButton
                pins={spec.pins}
                lit={spec.pins.some((pin) => hover.includes(pin.key))}
                onOpen={() => {
                  shared?.setSelected(null);
                  // A big stack opens as a list; a small one of points that only overlap at this
                  // zoom zooms in until they part, as a map's clusters do, and one point's listings
                  // spread into a ring.
                  if (spec.pins.length > RING_MAX) setListed(spec.id);
                  else if (spec.spread) fit(spec.pins, true, 15);
                  else setExpanded(spec.id.slice("stack-".length));
                }}
              />
            ),
            element,
            spec.id,
          )
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
        {/* Beside the sections, the map turns itself off: the rail's switch is folded away. */}
        {!full && shared && (
          <MapButton onClick={() => shared.setMapOn(false)} data-testid="map-hide">
            <CloseGlyph className="size-4.5" />
            Hide map
          </MapButton>
        )}
      </div>
      <div
        className={cn(
          "absolute right-3 z-10 flex flex-col overflow-hidden rounded-control bg-surface card-edge shadow-lift",
          full ? "top-16" : "top-3",
        )}
      >
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
            setListed(null);
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
          className={cn(
            "absolute z-10 flex flex-col gap-2.5 p-4",
            full ? "inset-x-0 bottom-0 rounded-b-none pb-24" : "top-16 left-3 w-[min(19rem,calc(100%-1.5rem))]",
          )}
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
              <p className="text-xs text-muted">
                Tap the map where you&apos;ll be, like your stay or the pier, or use your location.
              </p>
            </>
          )}
          {locating === "failed" && (
            <p className="text-xs text-danger">Couldn&apos;t get your location. Tap the map instead.</p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="soft" size="sm" onClick={locate} disabled={locating === "busy"}>
              <LocateGlyph className="size-4" />
              {locating === "busy" ? "Finding you…" : "Use my location"}
            </Button>
            {you && (
              <button
                type="button"
                onClick={() => setYou(null)}
                className="px-2 text-sm font-semibold text-link underline-offset-4 hover:underline"
              >
                Clear
              </button>
            )}
          </div>
        </Card>
      )}

      {!distance && (
        <details
          className={cn(
            "absolute left-3 z-10 rounded-control bg-surface px-3 py-2 text-xs font-semibold card-edge shadow-lift",
            // Full screen, under Search by distance: at the foot the attribution ran under it.
            full ? "top-20" : "bottom-3",
          )}
        >
          {/* Closed at first, so it never covers the pins it explains. */}
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
                <input
                  type="checkbox"
                  checked={placesOn}
                  onChange={(event) => setPlacesOn(event.target.checked)}
                  className="accent-primary"
                />
                <span aria-hidden className="size-2.5 rounded-full bg-navy" />
                Places to see
              </label>
            </li>
          </ul>
          <p className="mt-1.5 max-w-52 font-normal text-muted">
            Pins sit within about 1 km of the listing; the exact spot comes with the booking.
          </p>
        </details>
      )}

      {!open && listedStack && (
        <StackList
          pins={listedStack.pins}
          full={full}
          onPick={(pin) => {
            setListed(null);
            select(pin);
          }}
          onHover={(key) => shared?.setHover(key)}
          onClose={() => setListed(null)}
        />
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
  // Left out for a plain action, which isn't a toggle.
  pressed?: boolean;
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
        "flex min-h-11 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold card-edge shadow-lift transition-colors duration-300 ease-calm",
        pressed ? "bg-primary text-white" : "bg-surface text-foreground [&_svg]:text-primary",
      )}
    >
      {children}
    </button>
  );
}

function ZoomButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex size-11 items-center justify-center border-line not-first:border-t hover:bg-surface-2"
    >
      {children}
    </button>
  );
}

// A pin: its group's colour, its category icon and, once it has one, its price; a place to see
// is a navy disc with the place icon.
function PinButton({
  pin,
  label = false,
  lit,
  open,
  onSelect,
  onHover,
}: {
  pin: AreaPin;
  // A place to see's name beside it, from PLACE_LABEL_ZOOM.
  label?: boolean;
  lit: boolean;
  open: boolean;
  onSelect: () => void;
  onHover: (on: boolean) => void;
}) {
  const color = PIN_COLOR[pin.kind === "place" ? "place" : pin.group] ?? PIN_COLOR.place;
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
        // A 32px pin, tapped across 44px (the invisible ::before), as a map's pins are small.
        "relative mb-1.5 flex h-8 items-center gap-1.5 rounded-full border-2 border-surface text-small font-bold whitespace-nowrap text-white tabular-nums shadow-lift transition-transform duration-300 ease-calm before:absolute before:-inset-1.5 before:rounded-full before:content-['']",
        "after:absolute after:-bottom-1.5 after:left-1/2 after:size-2.5 after:-translate-x-1/2 after:rotate-45 after:border-r-2 after:border-b-2 after:border-surface after:content-['']",
        color,
        pin.kind === "place" ? "w-8 justify-center" : pin.price ? "pr-3 pl-2" : "px-1.5",
        (lit || open) && "scale-110",
        open && "ring-4 ring-sky-pale",
      )}
    >
      <span className="relative z-10 flex items-center gap-1.5">
        {pin.kind === "place" ? (
          <PlaceGlyph className="size-4" />
        ) : (
          <CategoryGlyph name={pin.category} className="size-4" />
        )}
        {pin.kind === "listing" && pin.price && pin.price.amount}
      </span>
      {label && (
        <span
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-full ml-1.5 max-w-36 -translate-y-1/2 truncate rounded-full bg-surface/90 px-2 py-0.5 text-small font-semibold text-navy shadow-soft"
        >
          {pin.title}
        </span>
      )}
    </button>
  );
}

// Listings that share a point: a dot per group in it, the count and what they are ("11 Stays ·
// Tours +1"), so the map says what's where before a tap; the place they share, if any, is in its
// label. A tap opens a list (a big one), zooms in or spreads them out.
function StackButton({ pins, lit, onOpen }: { pins: ListingPin[]; lit: boolean; onOpen: () => void }) {
  const groups = TRIP_ORDER_GROUPS.filter(({ group }) => pins.some((pin) => pin.group === group));
  const types = groups.slice(0, 3).map(({ group }) => group);
  const kinds = `${groups.slice(0, 2).map(({ short }) => short).join(" · ")}${groups.length > 2 ? ` +${groups.length - 2}` : ""}`;
  const places = new Set(pins.map((pin) => pin.info?.place));
  const place = places.size === 1 ? [...places][0] : undefined;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${pins.length} listings ${place ? `in ${place}` : "here"} (${groups.map(({ title }) => title).join(", ")}): show them`}
      data-testid="map-stack"
      className={cn(
        "relative mb-1 flex h-9 items-center gap-1.5 rounded-full border-2 border-surface bg-navy pr-3 pl-1.5 text-small font-extrabold text-white shadow-lift transition-shadow duration-300 ease-calm before:absolute before:-inset-1 before:rounded-full before:content-['']",
        lit && "ring-4 ring-sky-pale",
      )}
    >
      <span aria-hidden className="flex">
        {types.map((type) => (
          <span
            key={type}
            className={cn("-ml-1.5 size-4 rounded-full border-2 border-navy first:ml-0", DOT_COLOR[type])}
          />
        ))}
      </span>
      {pins.length}
      <span aria-hidden className="max-w-44 truncate font-semibold text-sky-pale">
        {kinds}
      </span>
    </button>
  );
}

// A big stack's listings as a list over the map, where its pop-up would open: each with its
// group's colour, category icon and price; picking one opens its pop-up and lights its row.
function StackList({
  pins,
  full,
  onPick,
  onHover,
  onClose,
}: {
  pins: ListingPin[];
  full: boolean;
  onPick: (pin: ListingPin) => void;
  onHover: (key: string | null) => void;
  onClose: () => void;
}) {
  const places = new Set(pins.map((pin) => pin.info?.place));
  const place = places.size === 1 ? [...places][0] : undefined;
  return (
    <Card
      role="dialog"
      aria-label={`${pins.length} listings ${place ? `in ${place}` : "here"}`}
      data-testid="map-stack-list"
      className={cn(
        "absolute z-20 flex flex-col shadow-float",
        full
          ? "inset-x-3 bottom-24 max-h-[55%]"
          : "top-1/2 left-1/2 max-h-[min(26rem,calc(100%-2rem))] w-80 max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2",
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-line py-1.5 pr-1.5 pl-4">
        <p className="text-sm font-semibold">
          {pins.length} listings {place ? `in ${place}` : "here"}
        </p>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="flex size-11 items-center justify-center rounded-full text-muted hover:bg-surface-2"
        >
          <CloseGlyph className="size-4" />
        </button>
      </div>
      <ul className="overflow-y-auto overscroll-contain p-1.5">
        {pins.map((pin) => (
          <li key={pin.key}>
            <button
              type="button"
              onClick={() => onPick(pin)}
              onPointerEnter={() => onHover(pin.key)}
              onPointerLeave={() => onHover(null)}
              className="flex min-h-11 w-full items-center gap-3 rounded-control px-2.5 py-1.5 text-left hover:bg-surface-2"
            >
              <span
                aria-hidden
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-full text-white",
                  DOT_COLOR[pin.group] ?? "bg-navy",
                )}
              >
                <CategoryGlyph name={pin.category} className="size-3.5" />
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{pin.title}</span>
              {pin.price && (
                <span className="shrink-0 text-sm font-semibold tabular-nums text-muted">{pin.price.amount}</span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </Card>
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
  const price =
    pin.kind === "listing" && pin.price
      ? { prefix: "from", amount: pin.price.amount, unit: pin.price.unit }
      : undefined;
  const action =
    pin.kind === "listing" ? (
      <AddToTripButton
        listing={{ id: pin.id, title: pin.title, booking_type: pin.bookingType }}
        dates={dates}
        preview={pinPreview(pin)}
      />
    ) : undefined;
  const title =
    pin.kind === "listing" ? (
      <DetailPanelButton
        title={pin.title}
        media={<PanelPhoto photo={pin.photo} icon={<CategoryGlyph name={pin.category} className="size-12" />} />}
        panel={
          <ListingPanel
            listingId={pin.id}
            href={`/listings/${pin.id}${datesQuery}`}
            category={pin.category}
            by={pin.info?.by ?? ""}
            summary={pin.info?.summary}
            features={pin.info?.features ?? []}
            instantBook={pin.instantBook}
            dates={dates}
          />
        }
        actions={
          <PanelActions
            price={price}
            unpriced={pricedByText(pin.bookingType)}
            action={
              <AddToTripButton
                listing={{ id: pin.id, title: pin.title, booking_type: pin.bookingType }}
                dates={dates}
                preview={pinPreview(pin)}
                prominent
              />
            }
          />
        }
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
      <div
        className={cn(
          "relative flex items-center justify-center bg-navy text-sky-mist/50",
          full ? "min-h-full" : "aspect-[16/9]",
        )}
      >
        {pin.photo ? (
          <Image
            src={pin.photo.src}
            alt={pin.photo.alt}
            fill
            unoptimized={isApiPhoto(pin.photo.src)}
            sizes="18rem"
            className="object-cover"
          />
        ) : pin.kind === "listing" ? (
          <CategoryGlyph name={pin.category} className="size-8" />
        ) : (
          <PlaceGlyph className="size-8" />
        )}
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
            {pin.kind === "listing" ? (
              <CategoryGlyph name={pin.category} className="size-3.5" />
            ) : (
              <PlaceGlyph className="size-3.5" />
            )}
            {pin.kind === "listing" ? pin.category : "Place to see"}
          </Badge>
          {pin.kind === "listing" && pin.instantBook && <InstantBookBadge small />}
          {distanceKm !== undefined && (
            <span className="font-semibold text-foreground">{distanceKm.toFixed(1)} km from your pin</span>
          )}
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

// A pin's add sheet: its row's when the page has one, else what the pin knows.
function pinPreview(pin: ListingPin): AddPreview {
  return (
    pin.info?.add ?? {
      category: pin.category,
      photo: pin.photo,
      price: pin.price
        ? ["From", pin.price.amount, pin.price.unit].filter(Boolean).join(" ")
        : pricedByText(pin.bookingType),
    }
  );
}
