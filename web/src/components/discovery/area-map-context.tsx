"use client";

import { createContext, useCallback, useContext, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { cn } from "@/components/ui/cn";

export { listingKey, placeKey } from "./area-map-pins";

// What an area page's map shares with the cards and rows beside it: the pin under the pointer
// (from either side), the pin whose pop-up is open, whether the map is shown, what What to book
// is showing (its group and the rows its filters hide), and, while searching by distance, how
// far each listing is from the guest's pin. A pin's key is `listing-<id>` or `place-<slug>`.
export type MapView = { group: string | null; hidden: number[] };

type AreaMapState = {
  // The pins lit by a pointer: one pin, or a business card's pins.
  hover: string[];
  setHover: (key: string | string[] | null) => void;
  selected: string | null;
  setSelected: (key: string | null) => void;
  mapOn: boolean;
  setMapOn: (on: boolean) => void;
  view: MapView;
  setView: (view: MapView) => void;
  near: Map<number, number> | null;
  setNear: (near: Map<number, number> | null) => void;
};

const AreaMapContext = createContext<AreaMapState | null>(null);

// The map starts off, so the rows get the page's width; a guest who turns it on keeps it on
// from page to page (this browser only). Off on the server and until hydration; where storage is
// blocked the choice lasts as long as the page.
const MAP_ON_KEY = "area-map-on";
const mapOnListeners = new Set<() => void>();
let mapOnFallback = false;

function subscribeMapOn(listener: () => void) {
  mapOnListeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    mapOnListeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function readMapOn() {
  try {
    const stored = localStorage.getItem(MAP_ON_KEY);
    return stored === null ? mapOnFallback : stored === "1";
  } catch {
    return mapOnFallback;
  }
}

function setMapOn(on: boolean) {
  mapOnFallback = on;
  try {
    localStorage.setItem(MAP_ON_KEY, on ? "1" : "0");
  } catch {}
  mapOnListeners.forEach((listener) => listener());
}

// Turning the map on or off reflows the sections (narrower beside it, wider without), which
// would leave the guest somewhere else on the page: the first row or section still in view keeps
// its place on screen across the change.
function keepingPlace(on: boolean) {
  // A row or a section's heading block first; a whole section only when neither is in view.
  const inView = (selector: string) =>
    [...document.querySelectorAll<HTMLElement>(selector)].find((element) => element.getBoundingClientRect().bottom > 160);
  const anchor = inView('[id^="listing-"], [id$="-top"]') ?? inView("main section[id]");
  const top = anchor?.getBoundingClientRect().top;
  setMapOn(on);
  if (!anchor || top === undefined) return;
  requestAnimationFrame(() =>
    requestAnimationFrame(() => window.scrollBy({ top: anchor.getBoundingClientRect().top - top, behavior: "instant" })),
  );
}

export function AreaMapProvider({ children }: { children: ReactNode }) {
  const [hover, setHoverKeys] = useState<string[]>([]);
  const setHover = useCallback(
    (key: string | string[] | null) => setHoverKeys(key === null ? [] : Array.isArray(key) ? key : [key]),
    [],
  );
  const [selected, setSelected] = useState<string | null>(null);
  const mapOn = useSyncExternalStore(subscribeMapOn, readMapOn, () => false);
  const [view, setView] = useState<MapView>({ group: null, hidden: [] });
  const [near, setNear] = useState<Map<number, number> | null>(null);
  const value = useMemo(
    () => ({ hover, setHover, selected, setSelected, mapOn, setMapOn: keepingPlace, view, setView, near, setNear }),
    [hover, setHover, selected, mapOn, view, near],
  );
  return <AreaMapContext.Provider value={value}>{children}</AreaMapContext.Provider>;
}

// Null outside an area page, so the shared pieces (the listing browser) work without a map.
export function useAreaMap() {
  return useContext(AreaMapContext);
}

// Whether the map is beside the sections (set by AreaMapLayout: the map on, with pins to show),
// which folds What to book's rail into a bar over its rows from lg.
export const BesideMapContext = createContext(false);

export function useBesideMap() {
  return useContext(BesideMapContext);
}

// A mouse on a screen that can hover: a finger scrolling or tapping fires pointer events too
// (some as "mouse"), which left a card ringed on a phone.
function hovering(event: { pointerType: string }) {
  return event.pointerType === "mouse" && window.matchMedia("(hover: hover)").matches;
}

// A card or row that lights up its pins while the pointer is on it (a business card has one per
// listing), and is ringed while one of them is hovered or open on the map.
export function MapHoverTarget({ pin, children, className }: { pin: string | string[]; children: ReactNode; className?: string }) {
  const map = useAreaMap();
  const pins = Array.isArray(pin) ? pin : [pin];
  // Lit only while the map shows: with it off, a ring on hover read as "selected".
  const lit = Boolean(map?.mapOn && pins.some((key) => map.hover.includes(key) || map.selected === key));
  return (
    <div
      onPointerEnter={(event) => hovering(event) && map?.setHover(pins)}
      onPointerLeave={(event) => hovering(event) && map?.hover.some((key) => pins.includes(key)) && map.setHover(null)}
      data-map-lit={lit || undefined}
      className={cn("rounded-card transition-shadow duration-300 ease-calm", lit && "ring-1 ring-primary ring-offset-2 ring-offset-transparent", className)}
    >
      {children}
    </div>
  );
}

// The rail's switch for the map beside the sections (from lg, where there is room for both).
// With the map on, the rail folds into a bar over the rows and the map's own Hide map turns it off.
export function MapSwitch() {
  const map = useAreaMap();
  if (!map) return null;
  return (
    <div className="hidden flex-col gap-2 rounded-card bg-surface p-4 card-edge-line shadow-soft lg:flex">
      <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 text-sm font-semibold">
        Show map
        <button
          type="button"
          role="switch"
          aria-checked={map.mapOn}
          onClick={() => map.setMapOn(!map.mapOn)}
          data-testid="map-switch"
          className={cn(
            "relative h-6.5 w-11 shrink-0 rounded-full transition-colors duration-300 ease-calm after:absolute after:top-0.75 after:left-0.75 after:size-5 after:rounded-full after:bg-surface after:shadow after:transition-transform after:duration-300 after:ease-calm",
            map.mapOn ? "bg-primary after:translate-x-4.5" : "bg-line-strong",
          )}
        />
      </label>
      <p className="text-xs text-pretty text-muted">Pins follow the group and filters you pick.</p>
    </div>
  );
}
