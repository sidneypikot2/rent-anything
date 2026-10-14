"use client";

import { Map as MapLibreMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import {
  DEFAULT_MAP_CENTER,
  fromLngLat,
  geocodeAddress,
  MAP_STYLE_URL,
  reverseGeocode,
  setMapWorker,
  toLngLat,
  type LatLng,
  type ReversePlace,
} from "@/lib/map";

type Props = {
  value: LatLng | null;
  onChange: (location: LatLng) => void;
  // An address to put the pin on once it settles (RAA-41); the partner can still drag it.
  geocodeQuery?: string;
  error?: string;
  // Shows the pin without letting it move: a listing using its business's pin (RAA-101).
  readOnly?: boolean;
  label?: string;
  // The address where "Use my location" put the pin (RAA-111), for the form to fill in.
  onLocated?: (place: ReversePlace) => void;
};

const GEOCODE_DELAY_MS = 600;

// A map the partner clicks to drop the listing's pin on, then drags to adjust it.
// A complete address moves the pin there too. A pin given when the map opens (a saved
// listing, RAA-47) is shown there, and the map starts on it; a pin given later (copied from
// the business, RAA-101) moves the map to it. "Use my location" pins the spot the partner
// is standing on, which also gives a keyboard-only partner a way to place it besides the address,
// and hands the address there to onLocated. A located pin is more exact than an address lookup,
// so the address no longer moves it; dragging or tapping still does.
export function LocationPicker({
  value,
  onChange,
  geocodeQuery,
  error,
  readOnly = false,
  label = "Pin the spot",
  onLocated,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  // Puts the pin at a point (creating it the first time) and reports it; set once the map loads.
  const placePinRef = useRef<((point: LatLng) => void) | null>(null);
  // Puts the pin at a point and centres the map on it, without reporting it.
  const showPinRef = useRef<((point: LatLng) => void) | null>(null);
  const markerRef = useRef<Marker | undefined>(undefined);
  const readOnlyRef = useRef(readOnly);
  const [failed, setFailed] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string>();
  const [located, setLocated] = useState(false);
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

    // A failure before the map has drawn leaves no map; a tile failing later doesn't.
    map.on("error", () => {
      if (!loaded) setFailed(true);
    });
    map.on("load", () => {
      loaded = true;
    });

    // Puts the pin at a point, creating it the first time, without reporting it.
    const showPin = (point: LatLng) => {
      if (!markerRef.current) {
        const placed = new Marker({ draggable: !readOnlyRef.current }).setLngLat(toLngLat(point)).addTo(map);
        placed.getElement().title = "Location";
        placed.on("dragend", () => onChangeRef.current(fromLngLat(placed.getLngLat())));
        markerRef.current = placed;
      } else {
        markerRef.current.setLngLat(toLngLat(point));
      }
    };
    if (initial) showPin(initial);
    showPinRef.current = (point) => {
      showPin(point);
      map.jumpTo({ center: toLngLat(point), zoom: 16 });
    };

    placePinRef.current = (point) => {
      showPin(point);
      setNotFound(false);
      onChangeRef.current(point);
    };

    map.on("click", (event) => {
      if (!readOnlyRef.current) placePinRef.current?.(fromLngLat(event.lngLat));
    });
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      placePinRef.current = null;
      showPinRef.current = null;
      markerRef.current = undefined;
    };
  }, []);

  useEffect(() => {
    readOnlyRef.current = readOnly;
    markerRef.current?.setDraggable(!readOnly);
  }, [readOnly]);

  // A pin set from outside the map: show it, unless the pin is already there (a drag or a
  // geocoded address reports the point the pin is on).
  const lat = value?.lat;
  const lng = value?.lng;
  useEffect(() => {
    if (lat === undefined || lng === undefined) return;
    const current = markerRef.current?.getLngLat();
    if (current && current.lat === lat && current.lng === lng) return;
    showPinRef.current?.({ lat, lng });
  }, [lat, lng]);

  // Once the address stops changing, look it up and move the pin there.
  useEffect(() => {
    if (!geocodeQuery || located) return;
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
  }, [geocodeQuery, located]);

  const unavailable = failed;
  function locateMe() {
    if (!("geolocation" in navigator)) {
      setLocateError("This browser can't share your location. Drop the pin on the map instead.");
      return;
    }
    setLocating(true);
    setLocateError(undefined);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocating(false);
        const point = { lat: coords.latitude, lng: coords.longitude };
        if (!placePinRef.current || !mapRef.current) return;
        placePinRef.current(point);
        mapRef.current.jumpTo({ center: toLngLat(point), zoom: 17 });
        setLocated(true);
        // No address found, or Photon unreachable: the pin is placed, the partner types the address.
        if (onLocated) {
          void reverseGeocode(point)
            .then((place) => place && onLocated(place))
            .catch(() => undefined);
        }
      },
      (problem) => {
        setLocating(false);
        setLocateError(
          problem.code === problem.PERMISSION_DENIED
            ? "Location is blocked for this site. Allow it in your browser, or drop the pin on the map."
            : "Couldn't find where you are. Drop the pin on the map instead.",
        );
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  return (
    <div data-testid="location-picker" className="flex flex-col gap-1 text-sm font-medium">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>{label}</span>
        {!readOnly && !unavailable && (
          <Button type="button" size="sm" variant="soft" onClick={locateMe} disabled={locating} data-testid="use-my-location">
            {locating ? "Finding you…" : "Use my location"}
          </Button>
        )}
      </div>
      {unavailable ? (
        <p
          role="status"
          className="flex h-80 w-full items-center justify-center rounded-control border border-line-strong bg-surface-2 px-6 text-center font-normal text-muted"
        >
          The map couldn&apos;t load. Reload the page to try again.
        </p>
      ) : (
        <div
          ref={containerRef}
          aria-label={readOnly ? "Map showing the pin" : "Map: tap to drop the pin, or use your location or the address"}
          className={cn(
            "h-80 w-full overflow-hidden rounded-control border",
            error ? "border-danger" : "border-line-strong",
          )}
        />
      )}
      <span
        role={locateError ? "alert" : undefined}
        className={cn("text-xs font-normal", error || notFound || locateError ? "text-danger" : "text-muted")}
      >
        {error ??
          locateError ??
          (notFound
            ? "Couldn't find that address on the map. Drop the pin yourself."
            : value
              ? readOnly
                ? "Pinned at the business's spot."
                : located
                  ? "Pinned where you are. Drag it to where travellers meet you."
                  : "Pin placed. Drag it to where travellers meet you."
              : "Tap the map where travellers meet you, use your location, or fill in the address.")}
      </span>
    </div>
  );
}
