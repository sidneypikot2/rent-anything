"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import type { MapPinsPage } from "@/api/discovery";
import type { paths } from "@/api/schema";

// What to book's map's query beyond the box: the section's group (none under All), the search,
// the dates and, with a group, its filters (GET /areas/{slug}/map_pins, 2026-11-11).
export type MapPinsQuery = Omit<NonNullable<paths["/api/v1/areas/{slug}/map_pins"]["get"]["parameters"]["query"]>, "bbox">;
// The box in view: west, south, east, north.
export type MapBox = [number, number, number, number];

// The listings on the part of the map in view, or their clusters when there are too many. null
// skips the request. The pins on show stay while the next box loads, so panning doesn't blink.
export function useMapPins(slug: string, box: MapBox | null, query: MapPinsQuery) {
  // Rounded, so a nudge of the map asks again only when it has moved noticeably.
  const bbox = box?.map((value) => value.toFixed(3)).join(",");
  return useQuery({
    queryKey: ["map-pins", slug, bbox, query],
    queryFn: async (): Promise<MapPinsPage> => {
      const { data, error } = await apiClient().GET("/api/v1/areas/{slug}/map_pins", {
        params: { path: { slug }, query: { ...query, bbox: bbox! } },
      });
      if (error || !data) throw new Error("Couldn't load the map's pins");
      return data;
    },
    enabled: Boolean(bbox),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}
