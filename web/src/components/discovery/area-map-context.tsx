"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { cn } from "@/components/ui/cn";

export { listingKey, placeKey } from "./area-map-pins";

// What an area page's map shares with the cards and rows beside it: the pin under the pointer
// (from either side), the pin whose pop-up is open, whether the map is shown, what What to book
// is showing (its group and the rows its filters hide), and, while searching by distance, how
// far each listing is from the guest's pin. A pin's key is `listing-<id>` or `place-<slug>`.
export type MapView = { bookingType: string | null; hidden: number[] };

type AreaMapState = {
  hover: string | null;
  setHover: (key: string | null) => void;
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

export function AreaMapProvider({ children }: { children: ReactNode }) {
  const [hover, setHover] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [mapOn, setMapOn] = useState(true);
  const [view, setView] = useState<MapView>({ bookingType: null, hidden: [] });
  const [near, setNear] = useState<Map<number, number> | null>(null);
  const value = useMemo(
    () => ({ hover, setHover, selected, setSelected, mapOn, setMapOn, view, setView, near, setNear }),
    [hover, selected, mapOn, view, near],
  );
  return <AreaMapContext.Provider value={value}>{children}</AreaMapContext.Provider>;
}

// Null outside an area page, so the shared pieces (the listing browser) work without a map.
export function useAreaMap() {
  return useContext(AreaMapContext);
}

// A card or row that lights up its pin while the pointer is on it, and is ringed while its pin
// is hovered or open on the map.
export function MapHoverTarget({ pin, children, className }: { pin: string; children: ReactNode; className?: string }) {
  const map = useAreaMap();
  const lit = Boolean(map && (map.hover === pin || map.selected === pin));
  return (
    <div
      onPointerEnter={() => map?.setHover(pin)}
      onPointerLeave={() => map?.hover === pin && map.setHover(null)}
      data-map-lit={lit || undefined}
      className={cn("rounded-card transition-shadow duration-300 ease-calm", lit && "ring-2 ring-primary ring-offset-2 ring-offset-transparent", className)}
    >
      {children}
    </div>
  );
}

// The rail's switch for the map beside the sections (from lg, where there is room for both).
export function MapSwitch() {
  const map = useAreaMap();
  if (!map) return null;
  return (
    <div className="hidden flex-col gap-2 rounded-card bg-surface p-4 card-edge shadow-soft lg:flex">
      <label className="flex cursor-pointer items-center justify-between gap-3 text-sm font-semibold">
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
      <p className="text-xs text-muted">Pins follow the group and filters you pick.</p>
    </div>
  );
}
