"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, type ComponentProps, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/components/ui/cn";
import { BesideMapContext, useAreaMap } from "./area-map-context";
import { setDockPinned, useFloatingDock } from "./floating-dock";
import { ListGlyph, MapGlyph } from "./tag-glyphs";

const WIDE = "(min-width: 64rem)";

// MapLibre is most of the map's weight, and the map starts off (a phone opens it from a button),
// so it loads only once the map shows; the Map button starts it loading on a hover or a touch.
const loadMap = () => import("./area-map").then((module) => module.AreaMap);
const AreaMap = dynamic(loadMap, {
  ssr: false,
  loading: () => <div aria-hidden className="size-full rounded-card bg-sky-mist motion-safe:animate-pulse" />,
});
type AreaMapProps = ComponentProps<Awaited<ReturnType<typeof loadMap>>>;

// The sections under an area page's search bar with its map. From lg, while the map is on, the
// sections keep to the left and the map sticks to the right under the search bar, all within the
// page's width, so they line up with the banner and the search bar above (What to book folds its
// rail into a bar over the rows to keep them readable, BesideMapContext). The map starts off
// and the guest's choice is kept (AreaMapProvider). Below lg there's no room for both: a Map
// button opens it full screen, and List goes back. One map at a time, so MapLibre runs once.
export function AreaMapLayout({
  children,
  map,
}: {
  children: ReactNode;
  // Null when there is nothing to pin: the sections then keep the page width, with no map.
  map: Omit<AreaMapProps, "full"> | null;
}) {
  const shared = useAreaMap();
  const on = Boolean(map && shared?.mapOn);
  const [wide, setWide] = useState(false);
  const [phoneOpen, setPhoneOpen] = useState(false);

  useEffect(() => {
    const query = window.matchMedia(WIDE);
    const update = () => setWide(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  const fullOpen = phoneOpen && !wide;
  useEffect(() => {
    if (!fullOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Its List button, in the dock, is the way back, whatever the page's scroll.
    setDockPinned(true);
    return () => {
      document.body.style.overflow = previous;
      setDockPinned(false);
    };
  }, [fullOpen]);
  const dock = useFloatingDock();

  return (
    <div
      data-map={on ? "on" : "off"}
      className={cn(
        "group/map mx-auto w-full max-w-page",
        on && "lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(20rem,40%)] lg:items-start lg:gap-gutter",
      )}
    >
      <BesideMapContext.Provider value={on}>{children}</BesideMapContext.Provider>
      {on && (
        // It ends above the window's foot bar (floating-dock.ts), which otherwise covered the
        // map's corner and its attribution.
        <aside
          aria-label="Map"
          className="sticky top-(--chrome) hidden h-[calc(100dvh-var(--chrome)-5.5rem)] pt-block lg:block"
        >
          {wide && map && <AreaMap {...map} />}
        </aside>
      )}
      {fullOpen && map && (
        <div data-map-full className="fixed inset-0 z-50 bg-sky-mist">
          <AreaMap {...map} full />
        </div>
      )}
      {/* In the window's foot bar with the trip checklist (floating-dock.ts), first. */}
      {map &&
        dock &&
        createPortal(
          <button
            type="button"
            onClick={() => setPhoneOpen(!phoneOpen)}
            onPointerDown={loadMap}
            onPointerEnter={loadMap}
            data-testid="map-toggle"
            data-floating
            className="order-1 flex min-h-12 items-center gap-2 rounded-full bg-navy px-5 font-bold text-white shadow-float lg:hidden"
          >
            {fullOpen ? <ListGlyph className="size-4.5" /> : <MapGlyph className="size-4.5" />}
            {fullOpen ? "List" : "Map"}
          </button>,
          dock,
        )}
    </div>
  );
}
