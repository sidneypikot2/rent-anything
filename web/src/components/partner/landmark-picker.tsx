"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckboxField } from "@/components/ui/checkbox-field";
import { Field } from "@/components/ui/field";
import { Pill } from "@/components/ui/pill";
import { distanceKm, type LatLng } from "@/lib/map";
import { usePartnerLandmarks, type PartnerLandmark } from "./use-partner-landmarks";

const DEBOUNCE_MS = 250;
// A landmark this far from every other one on the route gets a warning, never a block.
export const ROUTE_GAP_KM = 50;
// The API's limit (Listings::ListingValues::MAX_LANDMARKS).
const MAX_LANDMARKS = 30;

// What a picked landmark list covers, by destination name: "Bantayan Island, Malapascua".
// The saved listing's `covers` follows the same rule; this one is for an unsaved pick.
export function landmarkCovers(landmarks: PartnerLandmark[]) {
  const names = landmarks.flatMap((landmark) => (landmark.destination ? [landmark.destination.name] : []));
  return [...new Set(names)].sort();
}

// The picked landmarks far from all the others, with how far the nearest one is.
function distantLandmarks(landmarks: PartnerLandmark[]) {
  if (landmarks.length < 2) return [];
  return landmarks.flatMap((landmark) => {
    const nearest = Math.min(
      ...landmarks.filter((other) => other.id !== landmark.id).map((other) => distanceKm(landmark.location, other.location)),
    );
    return nearest > ROUTE_GAP_KM ? [{ landmark, km: Math.round(nearest) }] : [];
  });
}

// The landmarks a tour or activity visits (RAA-70, trips proposal decision 6). Search
// covers every landmark, each shown with its area; the destination chips are an optional
// filter with "Select all". A distant landmark gets a warning, not a block.
export function LandmarkPicker({
  value,
  onChange,
  near,
}: {
  value: PartnerLandmark[];
  onChange: (landmarks: PartnerLandmark[]) => void;
  near: LatLng | null;
}) {
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const [area, setArea] = useState<string>();
  const { data, isError, isFetching, isPlaceholderData } = usePartnerLandmarks({ q: query, area, near });

  useEffect(() => {
    const timer = setTimeout(() => setQuery(text.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text]);

  const picked = new Set(value.map((landmark) => landmark.id));
  const results = data?.landmarks ?? [];
  const destination = data?.destinations.find((option) => option.slug === area);
  const room = MAX_LANDMARKS - value.length;
  const unpicked = results.filter((landmark) => !picked.has(landmark.id));
  // Results may still be the previous filter's while the new ones load.
  const canSelectAll = !isPlaceholderData && unpicked.length > 0 && unpicked.length <= room;
  const covers = landmarkCovers(value);
  const distant = distantLandmarks(value);

  function toggle(landmark: PartnerLandmark) {
    onChange(picked.has(landmark.id) ? value.filter((other) => other.id !== landmark.id) : [...value, landmark]);
  }

  return (
    <div data-testid="landmark-picker" className="flex flex-col gap-4">
      <Field
        label="Search landmarks"
        type="search"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="e.g. Kawasan Falls"
        data-testid="landmark-search"
      />

      {data && data.destinations.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Browse by area</span>
            {(area || text) && (
              <button
                type="button"
                className="text-link hover:underline"
                onClick={() => {
                  setArea(undefined);
                  setText("");
                }}
              >
                Clear
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {data.destinations.map((option) => (
              <Pill
                key={option.slug}
                on={option.slug === area}
                onClick={() => setArea(option.slug === area ? undefined : option.slug)}
                data-testid="landmark-area"
              >
                {option.name}
              </Pill>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {destination && (
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold">
              {destination.name} · {destination.landmark_count}
            </span>
            <Button
              type="button"
              size="sm"
              variant="soft"
              disabled={!canSelectAll}
              onClick={() => onChange([...value, ...unpicked])}
              data-testid="landmark-select-all"
            >
              Select all
            </Button>
          </div>
        )}
        {isError ? (
          <p role="alert" className="text-sm text-danger">
            Couldn&apos;t load landmarks.
          </p>
        ) : !data ? (
          <p className="text-sm text-muted">Loading landmarks…</p>
        ) : results.length === 0 ? (
          <p className="text-sm text-muted">No landmarks match{isFetching ? "…" : "."}</p>
        ) : (
          <ul
            data-testid="landmark-results"
            className="flex max-h-72 flex-col gap-2 overflow-y-auto rounded-lg border-[1.5px] border-line-strong p-3"
          >
            {results.map((landmark) => (
              <li key={landmark.id}>
                <CheckboxField
                  label={`${landmark.name} — ${landmark.area.name}`}
                  checked={picked.has(landmark.id)}
                  disabled={!picked.has(landmark.id) && room <= 0}
                  onChange={() => toggle(landmark)}
                  className="font-normal"
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div data-testid="landmark-picked" className="flex flex-col gap-2 text-sm">
        <span className="font-medium">
          {value.length === 0 ? "No landmarks picked yet" : `Visits ${value.length} landmark${value.length === 1 ? "" : "s"}`}
          {room <= 0 && <span className="font-normal text-muted"> · {MAX_LANDMARKS} is the most a listing can visit</span>}
        </span>
        {value.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {value.map((landmark) => (
              <Pill
                key={landmark.id}
                on
                onClick={() => toggle(landmark)}
                aria-label={`Remove ${landmark.name}`}
              >
                {landmark.name} ×
              </Pill>
            ))}
          </div>
        )}
        {covers.length > 0 && (
          <p data-testid="landmark-covers" className="text-muted">
            Covers: <span className="text-foreground">{covers.join(", ")}</span>
          </p>
        )}
        {distant.map(({ landmark, km }) => (
          <p key={landmark.id} role="status" data-testid="landmark-distant" className="text-warning">
            ⚠ {landmark.name} is {km} km from the rest of the route. Is that right?
          </p>
        ))}
      </div>
    </div>
  );
}
