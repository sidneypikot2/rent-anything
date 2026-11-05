"use client";

import { LngLatBounds, Map as MapLibreMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import { MapButton, ZoomButton } from "@/components/discovery/map-controls";
import { CloseGlyph, FitGlyph, MinusGlyph, PlusGlyph, tagPaths } from "@/components/discovery/tag-glyphs";
import { cn } from "@/components/ui/cn";
import { FLAT_MAP, keepMapFlat, MAP_STYLE_URL, setMapWorker, toLngLat, type LatLng } from "@/lib/map";

// `label`: the price on the pill; `name`: what a screen reader hears ("Island hopping, from ₱1,500").
// `icon`: a tag slug: the pin is that icon on its exact point, with `label` only on hover or when lit.
export type ResultPin = { id: number; point: LatLng; label: string; name: string; icon?: string };

const PIN = "tap-target rounded-full px-2.5 py-1 text-small font-bold whitespace-nowrap tabular-nums shadow-lift transition-[background-color,color,scale] duration-300 ease-calm cursor-pointer";
const PIN_REST = "bg-surface text-navy";
const PIN_ON = "bg-navy text-white scale-110";
// A place the guest picked: navy at rest too, so the picks read as a cluster.
const PIN_PICKED = "bg-navy text-white";
// An icon pin (a place to see), the area map's shape: its tail's tip is the point, and it is tapped
// across 44px (the invisible ::before).
const ICON_PIN =
  "group relative mb-1.5 flex size-8 origin-bottom cursor-pointer items-center justify-center rounded-full border-2 border-surface shadow-lift transition-[background-color,color,scale] duration-300 ease-calm before:absolute before:-inset-1.5 before:rounded-full before:content-[''] after:absolute after:-bottom-1.5 after:left-1/2 after:size-2.5 after:-translate-x-1/2 after:rotate-45 after:border-r-2 after:border-b-2 after:border-surface after:content-['']";
const ICON_PIN_REST = "bg-surface text-navy after:bg-surface";
const ICON_PIN_PICKED = "bg-navy text-white after:bg-navy";
const ICON_PIN_ON = "bg-navy text-white after:bg-navy scale-110";
const PIN_NAME =
  "pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden -translate-x-1/2 rounded-full bg-surface px-2.5 py-1 text-small font-bold whitespace-nowrap text-navy shadow-lift group-hover:block group-data-[on=true]:block";
// A fixed point that isn't an option (a port): a small dashed disc, its name on hover.
const MARK = "group relative flex size-7 items-center justify-center rounded-full border border-dashed border-muted bg-surface text-muted";
const MARK_ICON = "island-hopping";
// Pins on one point (locations are rounded, so a town's businesses share a few) sit in a grid
// around it, this many across and this far apart in pixels, so each can be seen and tapped.
const GRID_COLUMNS = 3;
const GRID_X = 80;
const GRID_Y = 36;
const FIT_PADDING = 64;
const NAME_PADDING = 84;

const pointKey = ({ lat, lng }: LatLng) => `${lat},${lng}`;

// A tag's icon, as the Glyphs draw it, for a marker built outside React.
function iconElement(slug: string) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.8");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("class", "relative z-10 size-4");
  for (const d of tagPaths(slug)) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    svg.append(path);
  }
  return svg;
}

function nameElement(text: string) {
  const name = document.createElement("span");
  name.className = PIN_NAME;
  name.textContent = text;
  name.setAttribute("aria-hidden", "true");
  return name;
}

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
// `picked`: pins that stay navy, lit without placing them again, so a heart never moves the map.
// `marks`: fixed points that aren't options (a port), dashed. `controls`: the zoom buttons
// without Hide map.
// Load it with next/dynamic, so MapLibre stays out of the page until it shows.
export default function ResultsMap({
  pins,
  stay,
  active,
  onPick,
  covered = 0,
  refit = 0,
  onHide,
  picked,
  marks = [],
  controls = false,
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
  picked?: Set<number>;
  marks?: { point: LatLng; label: string }[];
  controls?: boolean;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const elements = useRef(new Map<number, HTMLElement>());
  const pickRef = useRef(onPick);
  const coveredRef = useRef(covered);
  const fitRef = useRef<((animate: boolean) => void) | null>(null);
  const activeRef = useRef(active);
  const pickedRef = useRef(picked);
  const pointsRef = useRef<LatLng[]>([]);
  const [failed, setFailed] = useState(false);
  const key = JSON.stringify([pins, stay, marks]);
  const pickedKey = [...(picked ?? [])].join();
  const points = [...pins.map((pin) => pin.point), ...marks.map((mark) => mark.point), ...(stay ? [stay.point] : [])];
  const hasPoints = points.length > 0;

  useEffect(() => {
    pickRef.current = onPick;
    coveredRef.current = covered;
    activeRef.current = active;
    pickedRef.current = picked;
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
    // Icon pins keep their exact points.
    const offsets = gridOffsets(pins.filter((pin) => pin.icon === undefined));
    const markers = pins.map((pin) => {
      const button = document.createElement("button");
      button.type = "button";
      const icon = pin.icon !== undefined;
      button.className = icon ? cn(ICON_PIN, ICON_PIN_REST) : cn(PIN, PIN_REST);
      if (icon) {
        button.dataset.icon = "true";
        button.append(iconElement(pin.icon ?? ""), nameElement(pin.label));
      } else button.textContent = pin.label;
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
      if (icon) {
        // Above its neighbours while its name shows.
        button.addEventListener("pointerenter", () => (element.style.zIndex = "3"));
        button.addEventListener("pointerleave", () => (element.style.zIndex = button.dataset.on === "true" ? "2" : "1"));
        return new Marker({ element, anchor: "bottom" }).setLngLat(toLngLat(pin.point)).addTo(map);
      }
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
    for (const mark of marks) {
      const disc = document.createElement("span");
      disc.className = MARK;
      disc.setAttribute("role", "img");
      disc.setAttribute("aria-label", mark.label);
      disc.dataset.testid = "plan-map-mark";
      disc.append(iconElement(MARK_ICON), nameElement(mark.label));
      const element = document.createElement("div");
      element.append(disc);
      element.style.zIndex = "0";
      disc.addEventListener("pointerenter", () => (element.style.zIndex = "3"));
      disc.addEventListener("pointerleave", () => (element.style.zIndex = "0"));
      markers.push(new Marker({ element }).setLngLat(toLngLat(mark.point)).addTo(map));
    }
    lightPins(shown, activeRef.current, pickedRef.current);
    const bounds = points.reduce((box, point) => box.extend(toLngLat(point)), new LngLatBounds(toLngLat(points[0]), toLngLat(points[0])));
    // Clear of the edges by a grid's reach as well, so its outer pins stay in view.
    const spread = [...offsets.values()];
    // An icon pin's name opens centred over it, so room for that at the sides.
    const edge = pins.some((pin) => pin.icon !== undefined) ? NAME_PADDING : FIT_PADDING;
    const side = edge + Math.max(0, ...spread.map(([x]) => Math.abs(x)));
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
  // `pickedKey` stands for the picked set's contents.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => lightPins(elements.current, active, picked), [active, key, pickedKey]);

  if (failed) return <p className="p-4 text-sm text-muted">The map couldn&apos;t load here.</p>;
  const mapDiv = <div ref={containerRef} className={cn("size-full overflow-hidden bg-sky-mist", className)} data-testid="plan-results-map" />;
  if (!onHide && !controls) return mapDiv;
  return (
    <div className="relative size-full">
      {mapDiv}
      {onHide && (
        <div className="absolute top-3 right-16 left-3 z-10 flex flex-wrap gap-2">
          <MapButton onClick={onHide} data-testid="plan-map-hide">
            <CloseGlyph className="size-4.5" />
            Hide map
          </MapButton>
        </div>
      )}
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

function lightPins(elements: Map<number, HTMLElement>, active: number | null, picked?: Set<number>) {
  for (const [id, element] of elements) {
    const on = id === active;
    const chosen = picked?.has(id);
    element.dataset.on = String(on);
    element.className = element.dataset.icon
      ? cn(ICON_PIN, on ? ICON_PIN_ON : chosen ? ICON_PIN_PICKED : ICON_PIN_REST)
      : cn(PIN, on ? PIN_ON : chosen ? PIN_PICKED : PIN_REST);
    // Above the stay's pill (0) at rest, above the other prices when lit; on the marker, as the
    // markers are what stack.
    if (element.parentElement) element.parentElement.style.zIndex = on ? "2" : "1";
    element.setAttribute("aria-pressed", String(on));
  }
}
