"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { apiClient } from "@/api/client";
import type { components } from "@/api/schema";
import { md5Base64 } from "@/components/partner/use-listing-photos";
import { saveError } from "@/components/partner/use-partner-listings";

export type AdminArea = components["schemas"]["admin_area"];
export type AdminAreaRow = components["schemas"]["admin_area_row"];
export type AdminAreaBody = components["schemas"]["admin_area_body"];
export type AreaKind = AdminArea["kind"];
export type AreaStatus = AdminArea["status"];
export type SeedStatus = AdminArea["seed_status"];
type PhotoType = components["schemas"]["photo_upload_body"]["content_type"];

export type AreaFilters = { q: string; status: AreaStatus | ""; kind: AreaKind | ""; page: number };

// What the API's list serves at once (Admin::AreasController::PER_PAGE).
export const AREAS_PER_PAGE = 50;

// How often an area being seeded is asked for again.
const SEED_POLL_MS = 3000;

const LIST_KEY = ["admin-areas"] as const;
const areaKey = (slug: string) => ["admin-area", slug] as const;

// Every destination, drafts included (GET /admin/areas, RAA-164): published first, then by
// name; `q` matches the name, slug or an alias. The last page stays shown while the next loads.
export function useAdminAreas({ q, status, kind, page }: AreaFilters) {
  return useQuery({
    queryKey: [...LIST_KEY, q, status, kind, page],
    queryFn: async () => {
      const { data } = await apiClient().GET("/api/v1/admin/areas", {
        params: { query: { q: q || undefined, status: status || undefined, kind: kind || undefined, page } },
      });
      if (!data) throw new Error("Couldn't load the destinations. Try again.");
      return data;
    },
    placeholderData: keepPreviousData,
    refetchInterval: (query) => (query.state.data?.areas.some(isSeeding) ? SEED_POLL_MS : false),
  });
}

// One destination with all its details. While its banner is uploaded but not ready (being
// sized), it is asked for again every two seconds, as a partner's listing is, and every three
// while it is being seeded.
export function useAdminArea(slug: string | undefined) {
  return useQuery({
    queryKey: areaKey(slug ?? ""),
    queryFn: async () => {
      const { data } = await apiClient().GET("/api/v1/admin/areas/{slug}", { params: { path: { slug: slug! } } });
      if (!data) throw new Error("Couldn't load the destination. Try again.");
      return data;
    },
    enabled: slug !== undefined,
    refetchInterval: (query) => {
      const photo = query.state.data?.banner_photo;
      if (photo?.uploaded && !photo.ready) return 2000;
      return query.state.data && isSeeding(query.state.data) ? SEED_POLL_MS : false;
    },
  });
}

// What the form offers: the kinds of area and every tag.
export function useAreaOptions() {
  return useQuery({
    queryKey: ["admin-area-options"],
    queryFn: async () => {
      const { data } = await apiClient().GET("/api/v1/admin/area_options");
      if (!data) throw new Error("Couldn't load the destination options. Try again.");
      return data;
    },
    staleTime: Infinity,
  });
}

// Adds a destination (no slug yet) or changes one: on a change, a field left out is kept.
// The slug can change too, so the saved area is cached under the slug it comes back with.
export function useSaveArea() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ slug, body }: { slug?: string; body: AdminAreaBody }) => {
      const client = apiClient();
      const { data, error } = slug
        ? await client.PATCH("/api/v1/admin/areas/{slug}", { params: { path: { slug } }, body })
        : await client.POST("/api/v1/admin/areas", { body });
      if (!data) throw saveError(error, "Couldn't save the destination.");
      return data;
    },
    onSuccess: (area) => {
      queryClient.setQueryData(areaKey(area.slug), area);
      return queryClient.invalidateQueries({ queryKey: LIST_KEY });
    },
  });
}

// Setting the banner as a listing photo is added (use-listing-photos.ts): the API makes the row
// and signs an upload, the browser PUTs the bytes straight to storage (not the API, so not
// apiClient()), then confirms. A new banner replaces the old one.
async function uploadBanner(slug: string, file: File) {
  const client = apiClient();
  const path = { params: { path: { area_slug: slug } } };
  const { data, error } = await client.POST("/api/v1/admin/areas/{area_slug}/banner_photo", {
    ...path,
    body: {
      filename: file.name,
      byte_size: file.size,
      checksum: await md5Base64(file),
      content_type: file.type as PhotoType,
    },
  });
  if (!data) throw saveError(error, `Couldn't add ${file.name}.`);

  try {
    const stored = await fetch(data.upload.url, { method: "PUT", headers: data.upload.headers, body: file });
    if (!stored.ok) throw new Error(`Couldn't upload ${file.name}.`);
    const confirmed = await client.PATCH("/api/v1/admin/areas/{area_slug}/banner_photo", {
      ...path,
      body: { uploaded: true },
    });
    if (!confirmed.data) throw saveError(confirmed.error, `Couldn't finish ${file.name}.`);
  } catch (error) {
    // Don't leave an unfinished banner in place; the API would purge it in two days anyway.
    await client.DELETE("/api/v1/admin/areas/{area_slug}/banner_photo", path).catch(() => undefined);
    throw error;
  }
}

// A destination's banner photo: an upload or removal is saved at once and the area asked for again.
export function useAreaBanner(slug: string) {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: areaKey(slug) });

  const upload = useMutation({ mutationFn: (file: File) => uploadBanner(slug, file), onSettled: refresh });

  const remove = useMutation({
    mutationFn: async () => {
      const { response } = await apiClient().DELETE("/api/v1/admin/areas/{area_slug}/banner_photo", {
        params: { path: { area_slug: slug } },
      });
      if (!response.ok) throw new Error("Couldn't remove the banner photo.");
    },
    onSettled: refresh,
  });

  return { upload, remove };
}

// A seed run waiting or under way (RAA-168), which the API refuses to start again.
export function isSeeding(area: { seed_status: SeedStatus }) {
  return area.seed_status === "queued" || area.seed_status === "running";
}

// Seeds a destination from Wikidata (POST /admin/areas/{slug}/seed, RAA-168): queued at once,
// run in the background. It stays pending until the list has the queued area, so the button
// doesn't light up again in between.
export function useSeedArea() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (slug: string) => {
      const { data, error, response } = await apiClient().POST("/api/v1/admin/areas/{slug}/seed", {
        params: { path: { slug } },
      });
      if (response.status === 409) throw new Error("This destination is already being seeded.");
      if (!data) throw saveError(error, "Couldn't start seeding.");
      return data;
    },
    onSuccess: (area) => queryClient.setQueryData(areaKey(area.slug), area),
    onSettled: (_area, _error, slug) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: LIST_KEY }),
        queryClient.invalidateQueries({ queryKey: areaKey(slug) }),
      ]),
  });
}

type SeedRun = Pick<AdminAreaRow, "slug" | "seed_status" | "seeded_at">;

// Calls onEnd once for each shown area whose seed run ends: it was queued or running, or it
// ended again (a run quicker than one poll), and now it isn't.
export function useSeedEnds<Area extends SeedRun>(areas: Area[] | undefined, onEnd: (area: Area) => void) {
  const seen = useRef(new Map<string, SeedRun>());
  useEffect(() => {
    for (const area of areas ?? []) {
      const before = seen.current.get(area.slug);
      seen.current.set(area.slug, area);
      if (before && !isSeeding(area) && (isSeeding(before) || before.seeded_at !== area.seeded_at)) onEnd(area);
    }
  }, [areas, onEnd]);
}
