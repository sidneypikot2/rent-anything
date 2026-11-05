"use client";

import { LngLatBounds, Map as MapLibreMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import { MapButton, ZoomButton } from "@/components/discovery/map-controls";
import { CloseGlyph, FitGlyph, MinusGlyph, PlusGlyph } from "@/components/discovery/tag-glyphs";
import { cn } from "@/components/ui/cn";
import { FLAT_MAP, keepMapFlat, MAP_STYLE_URL, setMapWorker, toLngLat, type LatLng } from "@/lib/map";

// `label`: the price on the pill; `name`: what a screen reader hears ("Island hopping, from ₱1,500").
export type ResultPin = { id: number; point: LatLng; label: string; name: string };

const PIN = "tap-target rounded-full px-2.5 py-1 text-small font-bold whitespace-nowrap tabular-nums shadow-lift transition-[background-color,color,scale] duration-300 ease-calm cursor-pointer";
const PIN_REST = "bg-surface text-navy";
const PIN_ON = "bg-navy text-white scale-110";
// Pins on one point (locations are rounded, so a town's businesses share a few) sit in a grid
// around it, this many across and this far apart in pixels, so each can be seen and tapped.
const GRID_COLUMNS = 3;
const GRID_X = 80;
const GRID_Y = 36;
const FIT_PADDING = 64;

const pointKey = ({ lat, lng }: LatLng) => `${lat},${lng}`;

// Each pin's place in the grid around its point, in pixels; a pin alone stays on its point.
function gridOffsets(pins: ResultPin[]) {
  const points = new Map<string, ResultPin[]>();
  for (const pin of pins) points.set(pointKey(pin.point), [...(points.get(pointKey(pin.point)) ?? []), pin]);
  const offsets = new Map<number, [number, number]>();
  for (const group of points.values()) {
    const rows = Math.ceil(group.length / GRID_COLUMNS);
    group.forEach((pin, index) => {
      const row = Math.floor(index / GRID_COLUMNS);
      const across = Math.min(GRID_COLUMNS, group.length - row * GRID_COLUMNS);
      offsets.set(pin.id, [((index % GRID_COLUMNS) - (across - 1) / 2) * GRID_X, (row - (rows - 1) / 2) * GRID_Y]);
    });
  }
  return offsets;
}

// The results' map (Airbnb's search, 2026-11-03): each option a white price pill, the one under
// the pointer or picked in navy and raised; the guest's stay a forest pill. A tap on a pill picks
// it, a tap on the map lets it go. One map for every page: each page's pins are placed and
// fitted once, so picking one never moves the map.
// With `onHide` (the step's map beside its options, from lg) it carries the area map's controls:
// Hide map at the top left, zoom in / out / show every pin at the top right.
// Load it with next/dynamic, so MapLibre stays out of the page until it shows.
export default function ResultsMap({
  pins,
  stay,
  active,
  onPick,
  covered = 0,
  refit = 0,
  onHide,
  className,
}: {
  pins: ResultPin[];
  stay: { point: LatLng; name: string } | null;
  // The pin to light: the card under the pointer, else the one picked.
  active: number | null;
  onPick: (id: number | null) => void;
  // How much of the map's height something over its foot covers (a phone's sheet of results),
  // so the first fit keeps every pin above it.
  covered?: number;
  // Bumped when the guest moves the sheet: the map fits its pins above it again.
  refit?: number;
  // Turns the map off from inside it.
  onHide?: () => void;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const elements = useRef(new Map<number, HTMLElement>());
  const pickRef = useRef(onPick);
  const coveredRef = useRef(covered);
  const fitRef = useRef<((animate: boolean) => void) | null>(null);
  const activeRef = useRef(active);
  const pointsRef = useRef<LatLng[]>([]);
  const [failed, setFailed] = useState(false);
  const key = JSON.stringify([pins, stay]);
  const points = [...pins.map((pin) => pin.point), ...(stay ? [stay.point] : [])];
  const hasPoints = points.length > 0;

  useEffect(() => {
    pickRef.current = onPick;
    coveredRef.current = covered;
    activeRef.current = active;
    pointsRef.current = points;
  });

  const [ready, setReady] = useState(false);

  // The map itself, made once and kept while the guest pages through the options.
  useEffect(() => {
    if (!containerRef.current || !hasPoints) return;
    setMapWorker();
    let map: MapLibreMap;
    try {
      map = new MapLibreMap({
        container: containerRef.current,
        style: MAP_STYLE_URL,
        center: toLngLat(pointsRef.current[0]),
        zoom: 12,
        attributionControl: { compact: true },
        ...FLAT_MAP,
      });
    } catch {
      queueMicrotask(() => setFailed(true));
      return;
    }
    keepMapFlat(map);
    let loaded = false;
    map.on("error", () => {
      if (!loaded) setFailed(true);
    });
    map.on("click", () => pickRef.current(null));
    map.on("load", () => {
      loaded = true;
      // The credits open expanded; on a phone's short map they cover the pins. The ⓘ opens them.
      map.getContainer().querySelector(".maplibregl-compact-show")?.classList.remove("maplibregl-compact-show");
      setReady(true);
    });
    mapRef.current = map;
    const resize = new ResizeObserver(() => map.resize());
    resize.observe(containerRef.current);
    return () => {
      setReady(false);
      mapRef.current = null;
      resize.disconnect();
      map.remove();
    };
  }, [hasPoints]);

  // The page's pins, placed again for each page, and the map fitted to them.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || points.length === 0) return;
    const shown = elements.current;
    shown.clear();
    const offsets = gridOffsets(pins);
    const markers = pins.map((pin) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = cn(PIN, PIN_REST);
      button.textContent = pin.label;
      button.setAttribute("aria-label", pin.name);
      button.dataset.testid = "plan-map-pin";
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        pickRef.current(pin.id);
      });
      shown.set(pin.id, button);
      // The marker's element is MapLibre's: it places it by its classes and transform, so the
      // pill that changes its own sits inside.
      const element = document.createElement("div");
      element.append(button);
      return new Marker({ element, offset: offsets.get(pin.id) }).setLngLat(toLngLat(pin.point)).addTo(map);
    });
    if (stay) {
      const under = pins.filter((pin) => pointKey(pin.point) === pointKey(stay.point)).map((pin) => offsets.get(pin.id)?.[1] ?? 0);
      // Hung under its point and beneath the prices, so an option next door stays readable.
      const element = document.createElement("span");
      element.className = "rounded-full bg-forest px-2.5 py-1 text-small font-bold whitespace-nowrap text-white shadow-lift";
      element.textContent = "Your stay";
      element.style.zIndex = "0";
      markers.push(new Marker({ element, anchor: "top", offset: [0, 14 + Math.max(0, ...under)] }).setLngLat(toLngLat(stay.point)).addTo(map));
    }
    lightPins(shown, activeRef.current);
    const bounds = points.reduce((box, point) => box.extend(toLngLat(point)), new LngLatBounds(toLngLat(points[0]), toLngLat(points[0])));
    // Clear of the edges by a grid's reach as well, so its outer pins stay in view.
    const spread = [...offsets.values()];
    const side = FIT_PADDING + Math.max(0, ...spread.map(([x]) => Math.abs(x)));
    const top = FIT_PADDING + Math.max(0, ...spread.map(([, y]) => Math.abs(y)));
    // One point fits too, so it moves up out from under the sheet.
    const fit = (animate: boolean) => {
      const bottom = top + map.getContainer().clientHeight * coveredRef.current;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      map.fitBounds(bounds, { padding: { top, right: side, left: side, bottom }, maxZoom: 14, animate: animate && !reduce, duration: 500 });
    };
    fit(false);
    fitRef.current = fit;
    return () => {
      fitRef.current = null;
      markers.forEach((marker) => marker.remove());
    };
    // `key` stands for the pins' contents.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ready]);

  // After the covered share is updated above (effects run in order).
  useEffect(() => {
    if (refit > 0) fitRef.current?.(true);
  }, [refit]);

  // Light the active pin without rebuilding the map.
  useEffect(() => lightPins(elements.current, active), [active, key]);

  if (failed) return <p className="p-4 text-sm text-muted">The map couldn&apos;t load here.</p>;
  const mapDiv = <div ref={containerRef} className={cn("size-full overflow-hidden bg-sky-mist", className)} data-testid="plan-results-map" />;
  if (!onHide) return mapDiv;
  return (
    <div className="relative size-full">
      {mapDiv}
      <div className="absolute top-3 right-16 left-3 z-10 flex flex-wrap gap-2">
        <MapButton onClick={onHide} data-testid="plan-map-hide">
          <CloseGlyph className="size-4.5" />
          Hide map
        </MapButton>
      </div>
      <div className="absolute top-3 right-3 z-10 flex flex-col overflow-hidden rounded-control bg-surface card-edge shadow-lift">
        <ZoomButton label="Zoom in" onClick={() => mapRef.current?.zoomIn()}>
          <PlusGlyph className="size-4.5" />
        </ZoomButton>
        <ZoomButton label="Zoom out" onClick={() => mapRef.current?.zoomOut()}>
          <MinusGlyph className="size-4.5" />
        </ZoomButton>
        <ZoomButton label="Show every pin" onClick={() => fitRef.current?.(true)}>
          <FitGlyph className="size-4.5" />
        </ZoomButton>
      </div>
    </div>
  );
}

function lightPins(elements: Map<number, HTMLElement>, active: number | null) {
  for (const [id, element] of elements) {
    const on = id === active;
    element.className = cn(PIN, on ? PIN_ON : PIN_REST);
    // Above the stay's pill (0) at rest, above the other prices when lit; on the marker, as the
    // markers are what stack.
    if (element.parentElement) element.parentElement.style.zIndex = on ? "2" : "1";
    element.setAttribute("aria-pressed", String(on));
  }
}
