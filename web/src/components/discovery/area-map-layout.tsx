"use client";

import { useEffect, useState, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/components/ui/cn";
import { AreaMap } from "./area-map";
import { useAreaMap } from "./area-map-context";
import { ListGlyph, MapGlyph } from "./tag-glyphs";

const WIDE = "(min-width: 64rem)";

// The sections under an area page's search bar with its map. From lg, while the map is on, the
// sections keep to the left and the map sticks to the right under the search bar (the banner and
// the search bar above keep the full width); the grid is set in CSS from the first paint, so the
// map's column is held before the map itself mounts. Below lg there's no room for both: a Map
// button opens it full screen, and List goes back. One map at a time, so MapLibre runs once.
export function AreaMapLayout({
  children,
  map,
}: {
  children: ReactNode;
  // Null when there is nothing to pin: the sections then keep the page width, with no map.
  map: Omit<ComponentProps<typeof AreaMap>, "full"> | null;
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
    return () => {
      document.body.style.overflow = previous;
    };
  }, [fullOpen]);

  return (
    <div
      data-map={on ? "on" : "off"}
      className={cn(
        "group/map mx-auto w-full max-w-page",
        on && "lg:grid lg:max-w-split lg:grid-cols-[minmax(0,1fr)_minmax(20rem,36%)] lg:items-start lg:gap-gutter",
      )}
    >
      {children}
      {on && (
        <aside aria-label="Map" className="sticky top-(--chrome) hidden h-[calc(100dvh-var(--chrome)-1rem)] pt-block lg:block">
          {wide && map && <AreaMap {...map} />}
        </aside>
      )}
      {fullOpen && map && (
        <div className="fixed inset-0 z-50 bg-sky-mist">
          <AreaMap {...map} full />
        </div>
      )}
      {map && (
      <button
        type="button"
        onClick={() => setPhoneOpen(!phoneOpen)}
        data-testid="map-toggle"
        className="fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] left-1/2 z-[60] flex min-h-12 -translate-x-1/2 items-center gap-2 rounded-full bg-navy px-5 font-bold text-white shadow-float lg:hidden"
      >
        {fullOpen ? <ListGlyph className="size-4.5" /> : <MapGlyph className="size-4.5" />}
        {fullOpen ? "List" : "Map"}
      </button>
      )}
    </div>
  );
}
