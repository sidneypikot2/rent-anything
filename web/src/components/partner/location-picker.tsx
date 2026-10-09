"use client";

import { Map as MapLibreMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/components/ui/cn";
import {
  DEFAULT_MAP_CENTER,
  fromLngLat,
  geocodeAddress,
  MAP_STYLE_URL,
  setMapWorker,
  toLngLat,
  type LatLng,
} from "@/lib/map";

type Props = {
  value: LatLng | null;
  onChange: (location: LatLng) => void;
  // An address to put the pin on once it settles (RAA-41); the partner can still drag it.
  geocodeQuery?: string;
  error?: string;
};

const GEOCODE_DELAY_MS = 600;

// A map the partner clicks to drop the listing's pin on, then drags to adjust it.
// A complete address moves the pin there too. A pin given when the map opens (a saved
// listing, RAA-47) is shown there, and the map starts on it.
export function LocationPicker({ value, onChange, geocodeQuery, error }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  // Puts the pin at a point (creating it the first time) and reports it; set once the map loads.
  const placePinRef = useRef<((point: LatLng) => void) | null>(null);
  const [failed, setFailed] = useState(false);
  const [notFound, setNotFound] = useState(false);
  // The latest callback, so the map's listeners, bound once, never call a stale one.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  // The pin when the map opens; read once, when it has loaded.
  const initialValueRef = useRef(value);

  useEffect(() => {
    if (!containerRef.current) return;
    setMapWorker();
    const initial = initialValueRef.current;
    let map: MapLibreMap;
    try {
      map = new MapLibreMap({
        container: containerRef.current,
        style: MAP_STYLE_URL,
        center: toLngLat(initial ?? DEFAULT_MAP_CENTER),
        zoom: initial ? 16 : 7,
        attributionControl: { compact: true },
      });
    } catch {
      // No WebGL in this browser: the constructor throws, so report it after this effect.
      queueMicrotask(() => setFailed(true));
      return;
    }
    let loaded = false;
    let marker: Marker | undefined;

    // A failure before the map has drawn leaves no map; a tile failing later doesn't.
    map.on("error", () => {
      if (!loaded) setFailed(true);
    });
    map.on("load", () => {
      loaded = true;
    });

    // Puts the pin at a point, creating it the first time, without reporting it.
    const showPin = (point: LatLng) => {
      if (!marker) {
        const placed = new Marker({ draggable: true }).setLngLat(toLngLat(point)).addTo(map);
        placed.getElement().title = "Listing location";
        placed.on("dragend", () => onChangeRef.current(fromLngLat(placed.getLngLat())));
        marker = placed;
      } else {
        marker.setLngLat(toLngLat(point));
      }
    };
    if (initial) showPin(initial);

    placePinRef.current = (point) => {
      showPin(point);
      setNotFound(false);
      onChangeRef.current(point);
    };

    map.on("click", (event) => placePinRef.current?.(fromLngLat(event.lngLat)));
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      placePinRef.current = null;
    };
  }, []);

  // Once the address stops changing, look it up and move the pin there.
  useEffect(() => {
    if (!geocodeQuery) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      geocodeAddress(geocodeQuery, controller.signal)
        .then((point) => {
          if (controller.signal.aborted) return;
          if (!point) {
            setNotFound(true);
            return;
          }
          if (!placePinRef.current || !mapRef.current) return;
          placePinRef.current(point);
          mapRef.current.jumpTo({ center: toLngLat(point), zoom: 16 });
        })
        // Photon unreachable: leave the pin where it is and say so.
        .catch(() => {
          if (!controller.signal.aborted) setNotFound(true);
        });
    }, GEOCODE_DELAY_MS);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [geocodeQuery]);

  const unavailable = failed;

  return (
    <div data-testid="location-picker" className="flex flex-col gap-1 text-sm font-medium">
      <span>Pin the spot</span>
      {unavailable ? (
        <p
          role="status"
          className="flex h-80 w-full items-center justify-center rounded-lg border-[1.5px] border-line-strong bg-surface-2 px-6 text-center font-normal text-muted"
        >
          The map couldn&apos;t load. Reload the page to try again.
        </p>
      ) : (
        <div
          ref={containerRef}
          aria-label="Map: click to drop the listing's pin"
          className={cn(
            "h-80 w-full overflow-hidden rounded-lg border-[1.5px]",
            error ? "border-danger" : "border-line-strong",
          )}
        />
      )}
      <span className={cn("text-xs font-normal", error || notFound ? "text-danger" : "text-muted")}>
        {error ??
          (notFound
            ? "Couldn't find that address on the map; drop the pin yourself."
            : value
              ? `Pinned at ${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}. Drag the pin to adjust.`
              : "Fill in the address to place the pin, or click the map where travellers meet you.")}
      </span>
    </div>
  );
}
