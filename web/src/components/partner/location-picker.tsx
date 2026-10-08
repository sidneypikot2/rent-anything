"use client";

import { importLibrary } from "@googlemaps/js-api-loader";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/components/ui/cn";
import { DEFAULT_MAP_CENTER, googleMapsConfig, setMapsOptions, type LatLng } from "@/lib/map";

type Props = {
  value: LatLng | null;
  onChange: (location: LatLng) => void;
  // An address to put the pin on once it settles (RAA-41); the partner can still drag it.
  geocodeQuery?: string;
  error?: string;
};

const CONFIG = googleMapsConfig();
const GEOCODE_DELAY_MS = 600;

// A Google map the partner clicks to drop the listing's pin on, then drags to adjust it.
// A complete address moves the pin there too. A pin given when the map opens (a saved
// listing, RAA-47) is shown there, and the map starts on it.
export function LocationPicker({ value, onChange, geocodeQuery, error }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
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
    if (!CONFIG) return;
    let cancelled = false;
    let clickListener: google.maps.MapsEventListener | undefined;
    let marker: google.maps.marker.AdvancedMarkerElement | undefined;

    setMapsOptions(CONFIG);

    Promise.all([importLibrary("maps"), importLibrary("marker")])
      .then(([{ Map }, { AdvancedMarkerElement }]) => {
        if (cancelled || !containerRef.current) return;
        const initial = initialValueRef.current;
        const map = new Map(containerRef.current, {
          center: initial ?? DEFAULT_MAP_CENTER,
          zoom: initial ? 16 : 7,
          mapId: CONFIG.mapId,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
          clickableIcons: false,
        });

        // Puts the pin at a point, creating it the first time, without reporting it.
        const showPin = (point: LatLng) => {
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
        };
        if (initial) showPin(initial);

        placePinRef.current = (point) => {
          showPin(point);
          setNotFound(false);
          onChangeRef.current(point);
        };

        clickListener = map.addListener("click", (event: google.maps.MapMouseEvent) => {
          if (event.latLng) placePinRef.current?.({ lat: event.latLng.lat(), lng: event.latLng.lng() });
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
      placePinRef.current = null;
    };
  }, []);

  // Once the address stops changing, look it up and move the pin there.
  useEffect(() => {
    if (!CONFIG || !geocodeQuery) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      importLibrary("geocoding")
        .then(({ Geocoder }) => new Geocoder().geocode({ address: geocodeQuery, componentRestrictions: { country: "PH" } }))
        .then(({ results }) => {
          const location = results[0]?.geometry.location;
          if (cancelled || !location || !placePinRef.current || !mapRef.current) return;
          const point = { lat: location.lat(), lng: location.lng() };
          placePinRef.current(point);
          mapRef.current.panTo(point);
          mapRef.current.setZoom(16);
        })
        // ZERO_RESULTS rejects too: leave the pin where it is and say so.
        .catch(() => {
          if (!cancelled) setNotFound(true);
        });
    }, GEOCODE_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [geocodeQuery]);

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
