"use client";

import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/components/ui/cn";
import { DEFAULT_MAP_CENTER, googleMapsConfig, type LatLng } from "@/lib/map";

type Props = {
  value: LatLng | null;
  onChange: (location: LatLng) => void;
  // A point to move to, such as the chosen area's center. The pin stays where it is.
  focus?: LatLng;
  error?: string;
};

const CONFIG = googleMapsConfig();
let optionsSet = false;

// A Google map the partner clicks to drop the listing's pin on, then drags to adjust it.
export function LocationPicker({ value, onChange, focus, error }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const [failed, setFailed] = useState(false);
  // The latest callback, so the map's listeners, bound once, never call a stale one.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!CONFIG) return;
    let cancelled = false;
    let clickListener: google.maps.MapsEventListener | undefined;
    let marker: google.maps.marker.AdvancedMarkerElement | undefined;

    if (!optionsSet) {
      setOptions({ key: CONFIG.key, v: "weekly" });
      optionsSet = true;
    }

    Promise.all([importLibrary("maps"), importLibrary("marker")])
      .then(([{ Map }, { AdvancedMarkerElement }]) => {
        if (cancelled || !containerRef.current) return;
        const map = new Map(containerRef.current, {
          center: DEFAULT_MAP_CENTER,
          zoom: 7,
          mapId: CONFIG.mapId,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
          clickableIcons: false,
        });
        clickListener = map.addListener("click", (event: google.maps.MapMouseEvent) => {
          if (!event.latLng) return;
          const point = { lat: event.latLng.lat(), lng: event.latLng.lng() };
          if (!marker) {
            marker = new AdvancedMarkerElement({ map, position: point, gmpDraggable: true, title: "Listing location" });
            const placed = marker;
            placed.addEventListener("gmp-dragend", () => {
              const position = placed.position;
              if (!position) return;
              const latLng = new google.maps.LatLng(position);
              onChangeRef.current({ lat: latLng.lat(), lng: latLng.lng() });
            });
          } else {
            marker.position = point;
          }
          onChangeRef.current(point);
        });
        mapRef.current = map;
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      clickListener?.remove();
      if (marker) marker.map = null;
      mapRef.current = null;
    };
  }, []);

  const focusLat = focus?.lat;
  const focusLng = focus?.lng;
  useEffect(() => {
    if (focusLat === undefined || focusLng === undefined || !mapRef.current) return;
    mapRef.current.panTo({ lat: focusLat, lng: focusLng });
    mapRef.current.setZoom(13);
  }, [focusLat, focusLng]);

  const unavailable = !CONFIG || failed;

  return (
    <div data-testid="location-picker" className="flex flex-col gap-1 text-sm font-medium">
      <span>Pin the spot</span>
      {unavailable ? (
        <p
          role="status"
          className="flex h-80 w-full items-center justify-center rounded-lg border-[1.5px] border-line-strong bg-surface-2 px-6 text-center font-normal text-muted"
        >
          {CONFIG
            ? "The map couldn't load. Check the Google Maps key and try again."
            : "Map unavailable: the Google Maps key isn't set (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY)."}
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
      <span className={cn("text-xs font-normal", error ? "text-danger" : "text-muted")}>
        {error ??
          (value
            ? `Pinned at ${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}. Drag the pin to adjust.`
            : "Click the map to drop a pin where travellers meet you or pick it up.")}
      </span>
    </div>
  );
}
