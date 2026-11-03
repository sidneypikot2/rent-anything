"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { ComboboxField } from "@/components/ui/combobox-field";
import { reverseGeocode, searchPlaces, type LatLng, type PlaceSuggestion } from "@/lib/map";

const ZoneMap = dynamic(() => import("@/components/trips/zone-map"), {
  ssr: false,
  loading: () => <div className="h-52 w-full rounded-control bg-mist" />,
});

const SEARCH_DELAY_MS = 300;
const NAME_LENGTH = 120;

export type StayPoint = { name: string; location: LatLng | null };

// Where the guest is staying when they booked it themselves (A2): type a hotel or an address,
// picked from the place search (as a delivery's address is), or tap the map. The pin can be
// dragged to the exact spot, and a pin with no name typed takes the nearest place's name.
export function StayPin({ value, onChange, center }: { value: StayPoint; onChange: (value: StayPoint) => void; center: LatLng }) {
  const [found, setFound] = useState<PlaceSuggestion[]>([]);
  const [unreachable, setUnreachable] = useState(false);
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);
  // The name the pin filled in, replaced by the next drag; one the guest typed is kept.
  const filledRef = useRef<string | null>(null);

  const query = value.name.trim();
  const { lat, lng } = center;
  useEffect(() => {
    if (query.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      searchPlaces(query, { lat, lng }, controller.signal)
        .then((places) => {
          setFound(places);
          setUnreachable(false);
        })
        .catch(() => {
          if (!controller.signal.aborted) setUnreachable(true);
        });
    }, SEARCH_DELAY_MS);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query, lat, lng]);

  const lookupRef = useRef<AbortController | undefined>(undefined);
  function placePin(point: LatLng) {
    onChange({ ...valueRef.current, location: point });
    const typed = valueRef.current.name.trim();
    if (typed && typed !== filledRef.current) return;
    lookupRef.current?.abort();
    const controller = new AbortController();
    lookupRef.current = controller;
    reverseGeocode(point, controller.signal)
      .then((place) => {
        if (!place || controller.signal.aborted) return;
        const name = place.name ?? ([place.street, place.locality ?? place.district].filter(Boolean).join(", ") || place.city);
        if (!name) return;
        filledRef.current = name;
        onChange({ ...valueRef.current, name: name.slice(0, NAME_LENGTH) });
      })
      .catch(() => undefined);
  }

  const options = found.map((place, index) => ({ value: String(index), label: place.detail ? `${place.name} · ${place.detail}` : place.name }));
  return (
    <div className="flex flex-col gap-3" data-testid="plan-stay-pin">
      <ComboboxField
        label="Hotel or address"
        placeholder="Kota Beach Resort"
        value={value.name}
        maxLength={NAME_LENGTH}
        options={query.length >= 2 ? options : []}
        onChange={(text, option) => {
          const place = option ? found[Number(option.value)] : undefined;
          filledRef.current = null;
          onChange(place ? { name: place.name, location: place.point } : { ...value, name: text });
        }}
        hint={unreachable ? "Place search isn't answering: tap the map where you're staying instead." : undefined}
        data-testid="plan-stay-name"
      />
      <ZoneMap center={value.location ?? center} zones={[]} pin={value.location} onPin={placePin} className="h-52" />
      <p className="text-small text-muted">
        {value.location ? "Drag the pin to the exact spot." : "Pick a place above, or tap the map where you're staying."}
      </p>
    </div>
  );
}
