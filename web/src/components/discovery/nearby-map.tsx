"use client";

import { importLibrary } from "@googlemaps/js-api-loader";
import { useEffect, useMemo, useRef, useState } from "react";
import type { LandmarkPin, ListingPin } from "@/api/discovery";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { SectionTitle } from "@/components/ui/typography";
import { DEFAULT_MAP_CENTER, distanceKm, googleMapsConfig, setMapsOptions, type LatLng } from "@/lib/map";

type Props = { listings: ListingPin[]; landmarks: LandmarkPin[] };
type InRange<T> = T & { distance: number };

const CONFIG = googleMapsConfig();
const MIN_KM = 1;
const MAX_KM = 50;
const DEFAULT_KM = 5;

// The places within `km` of the pin, nearest first.
function withinRange<T extends { location: LatLng }>(items: T[], pin: LatLng, km: number): InRange<T>[] {
  return items
    .map((item) => ({ ...item, distance: distanceKm(pin, item.location) }))
    .filter((item) => item.distance <= km)
    .sort((a, b) => a.distance - b.distance);
}

// A theme colour for the map's own drawing (it takes colour strings, not classes).
function themeColor(name: string): string | undefined {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || undefined;
}

// A small coloured dot for a listing or landmark on the map.
function dot(className: string): HTMLElement {
  const element = document.createElement("span");
  element.className = `block size-3.5 rounded-full border-2 border-surface shadow ${className}`;
  return element;
}

// Testing page (RAA-53): the guest clicks the map to drop a pin and drags it to adjust.
// Confirming locks the map and the pin; a range then draws a circle around the pin and
// lists the listings and landmarks inside it, by straight-line distance computed here.
export function NearbyMap({ listings, landmarks }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const pinRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const circleRef = useRef<google.maps.Circle | null>(null);
  const markerClassRef = useRef<typeof google.maps.marker.AdvancedMarkerElement | null>(null);
  const lockedRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pin, setPin] = useState<LatLng | null>(null);
  const [locked, setLocked] = useState(false);
  const [km, setKm] = useState(DEFAULT_KM);

  useEffect(() => {
    if (!CONFIG) return;
    let cancelled = false;
    let clickListener: google.maps.MapsEventListener | undefined;
    setMapsOptions(CONFIG);

    Promise.all([importLibrary("maps"), importLibrary("marker")])
      .then(([{ Map, Circle }, { AdvancedMarkerElement }]) => {
        if (cancelled || !containerRef.current) return;
        const map = new Map(containerRef.current, {
          center: DEFAULT_MAP_CENTER,
          zoom: 9,
          mapId: CONFIG.mapId,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
          clickableIcons: false,
        });
        const primary = themeColor("--color-primary");
        circleRef.current = new Circle({
          strokeColor: primary,
          strokeWeight: 2,
          fillColor: primary,
          fillOpacity: 0.12,
          clickable: false,
        });

        clickListener = map.addListener("click", (event: google.maps.MapMouseEvent) => {
          if (lockedRef.current || !event.latLng) return;
          const point = { lat: event.latLng.lat(), lng: event.latLng.lng() };
          if (!pinRef.current) {
            const marker = new AdvancedMarkerElement({ map, position: point, gmpDraggable: true, title: "Your pin" });
            marker.addEventListener("gmp-dragend", () => {
              if (!marker.position) return;
              const latLng = new google.maps.LatLng(marker.position);
              setPin({ lat: latLng.lat(), lng: latLng.lng() });
            });
            pinRef.current = marker;
          } else {
            pinRef.current.position = point;
          }
          setPin(point);
        });

        mapRef.current = map;
        markerClassRef.current = AdvancedMarkerElement;
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      clickListener?.remove();
      if (pinRef.current) pinRef.current.map = null;
      circleRef.current?.setMap(null);
      pinRef.current = null;
      circleRef.current = null;
      mapRef.current = null;
    };
  }, []);

  // Locked: the pin can't be dragged, and the map ignores clicks and gestures.
  useEffect(() => {
    lockedRef.current = locked;
    if (pinRef.current) pinRef.current.gmpDraggable = !locked;
    mapRef.current?.setOptions({
      gestureHandling: locked ? "none" : "auto",
      disableDefaultUI: locked,
      keyboardShortcuts: !locked,
    });
  }, [locked]);

  // The radius circle, shown once the pin is confirmed, with the map fitted to it.
  useEffect(() => {
    const circle = circleRef.current;
    const map = mapRef.current;
    if (!ready || !circle || !map) return;
    if (!locked || !pin) {
      circle.setMap(null);
      return;
    }
    circle.setOptions({ map, center: pin, radius: km * 1000 });
    const bounds = circle.getBounds();
    if (bounds) map.fitBounds(bounds);
  }, [ready, locked, pin, km]);

  const nearbyListings = useMemo(() => (locked && pin ? withinRange(listings, pin, km) : []), [locked, pin, km, listings]);
  const nearbyLandmarks = useMemo(
    () => (locked && pin ? withinRange(landmarks, pin, km) : []),
    [locked, pin, km, landmarks],
  );

  // A dot on the map for each place in range.
  useEffect(() => {
    const map = mapRef.current;
    const Marker = markerClassRef.current;
    if (!ready || !map || !Marker) return;
    const markers = [
      ...nearbyListings.map(
        (listing) => new Marker({ map, position: listing.location, title: listing.title, content: dot("bg-primary") }),
      ),
      ...nearbyLandmarks.map(
        (landmark) => new Marker({ map, position: landmark.location, title: landmark.name, content: dot("bg-secondary") }),
      ),
    ];
    return () => markers.forEach((marker) => (marker.map = null));
  }, [ready, nearbyListings, nearbyLandmarks]);

  const unavailable = !CONFIG || failed;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        {unavailable ? (
          <p
            role="status"
            className="flex h-96 w-full items-center justify-center rounded-lg border-[1.5px] border-line-strong bg-surface-2 px-6 text-center text-muted"
          >
            {CONFIG
              ? "The map couldn't load. Check the Google Maps key and try again."
              : "Map unavailable: the Google Maps key isn't set (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY)."}
          </p>
        ) : (
          <div
            ref={containerRef}
            data-testid="nearby-map"
            aria-label="Map: click to drop your pin"
            className="h-96 w-full overflow-hidden rounded-lg border-[1.5px] border-line-strong"
          />
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">
            {!pin
              ? "Click the map to drop your pin."
              : locked
                ? `Pin locked at ${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}.`
                : `Pinned at ${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}. Drag it to adjust, then confirm.`}
          </p>
          {locked ? (
            <Button variant="soft" size="sm" onClick={() => setLocked(false)}>
              Change pin
            </Button>
          ) : (
            <Button data-testid="nearby-confirm" size="sm" disabled={!pin} onClick={() => setLocked(true)}>
              Confirm pin
            </Button>
          )}
        </div>
        <label className="flex flex-col gap-2 text-sm font-medium">
          <span>
            Within <span className="font-semibold text-primary">{km} km</span>
          </span>
          <input
            data-testid="nearby-range"
            type="range"
            min={MIN_KM}
            max={MAX_KM}
            step={1}
            value={km}
            disabled={!locked}
            onChange={(event) => setKm(Number(event.target.value))}
            className="w-full accent-primary disabled:opacity-50"
          />
        </label>
      </div>

      {locked && pin && (
        <div data-testid="nearby-results" className="grid gap-6 md:grid-cols-2">
          <ResultList
            title="Listings"
            empty="No listings within this distance."
            note="Listing locations are approximate (about 1 km)."
            items={nearbyListings.map((listing) => ({
              key: `listing-${listing.id}`,
              name: listing.title,
              detail: listing.category,
              distance: `~${listing.distance.toFixed(1)} km`,
              dotClass: "bg-primary",
            }))}
          />
          <ResultList
            title="Landmarks"
            empty="No landmarks within this distance."
            items={nearbyLandmarks.map((landmark) => ({
              key: `landmark-${landmark.slug}`,
              name: landmark.name,
              detail: landmark.area_slug,
              distance: `${landmark.distance.toFixed(1)} km`,
              dotClass: "bg-secondary",
            }))}
          />
        </div>
      )}
    </div>
  );
}

type Result = { key: string; name: string; detail: string; distance: string; dotClass: string };

function ResultList({ title, empty, note, items }: { title: string; empty: string; note?: string; items: Result[] }) {
  return (
    <section className="flex flex-col gap-3">
      <SectionTitle>
        {title} ({items.length})
      </SectionTitle>
      {note && <p className="text-xs text-muted">{note}</p>}
      {items.length === 0 ? (
        <p className="text-muted">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li key={item.key}>
              <Card>
                <CardBody pad="sm" className="flex items-center gap-3">
                  <span className={`size-3 shrink-0 rounded-full ${item.dotClass}`} aria-hidden />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium">{item.name}</span>
                    <span className="truncate text-xs text-muted">{item.detail}</span>
                  </div>
                  <span className="shrink-0 text-sm font-semibold">{item.distance}</span>
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
