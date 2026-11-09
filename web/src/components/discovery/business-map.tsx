"use client";

import { Map as MapLibreMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/components/ui/cn";
import { FLAT_MAP, keepMapFlat, MAP_STYLE_URL, setMapWorker, toLngLat, type LatLng } from "@/lib/map";

// A business's door on its shop page (RAA-281): one pin, flat with north up, that guests can pan
// and zoom but not move. Load it with next/dynamic (BusinessMapLoader): MapLibre stays out of the
// page until it shows.
export default function BusinessMap({ point, name, className }: { point: LatLng; name: string; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const initial = useRef(point);

  useEffect(() => {
    if (!containerRef.current) return;
    setMapWorker();
    let map: MapLibreMap;
    try {
      map = new MapLibreMap({
        container: containerRef.current,
        style: MAP_STYLE_URL,
        center: toLngLat(initial.current),
        zoom: 15,
        attributionControl: { compact: true },
        cooperativeGestures: true,
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
    map.on("load", () => {
      loaded = true;
    });
    const pin = document.createElement("div");
    pin.setAttribute("aria-hidden", "true");
    pin.innerHTML =
      '<span class="block size-5 rounded-full border-4 border-white bg-primary shadow-float"></span>';
    new Marker({ element: pin }).setLngLat(toLngLat(initial.current)).addTo(map);
    return () => map.remove();
  }, []);

  if (failed) return null;
  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={`Map showing where ${name} is`}
      data-testid="business-map"
      className={cn("h-56 w-full overflow-hidden rounded-card card-edge-line sm:h-72", className)}
    />
  );
}
