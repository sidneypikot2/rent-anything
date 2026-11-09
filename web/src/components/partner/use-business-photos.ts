"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import type { components } from "@/api/schema";
import { useSession } from "@/lib/auth/session";
import { md5Base64, putWithProgress, type OnUploadProgress } from "./use-listing-photos";
import { saveError } from "./use-partner-listings";
import { partnerBusinessKey } from "./use-partner-businesses";

type UploadBody = components["schemas"]["photo_upload_body"];
export type BusinessPhoto = components["schemas"]["partner_photo"];

// What the API takes (Business::MAX_COVER_PHOTOS).
export const MAX_COVER_PHOTOS = 8;

// A business's cover photos and logo (RAA-281), uploaded as a listing photo is
// (use-listing-photos.ts): the API makes the row and signs an upload, the browser PUTs the bytes
// straight to storage, then confirms. Each change is saved at once and the business asked for
// again, as a destination's photos are (use-admin-photos.ts).
async function uploadFile(
  add: (body: UploadBody) => Promise<{ data?: { id: number; upload: { url: string; headers: Record<string, string> } }; error?: unknown }>,
  confirm: (id: number) => Promise<{ data?: unknown; error?: unknown }>,
  undo: (id: number) => Promise<unknown>,
  file: File,
  onProgress?: OnUploadProgress,
) {
  onProgress?.({ stage: "preparing", sent: 0 });
  const { data, error } = await add({
    filename: file.name,
    byte_size: file.size,
    checksum: await md5Base64(file),
    content_type: file.type as UploadBody["content_type"],
  });
  if (!data) throw saveError(error, `Couldn't add ${file.name}.`);
  try {
    const stored = await putWithProgress(data.upload.url, data.upload.headers, file, onProgress);
    if (!stored) throw new Error(`Couldn't upload ${file.name}.`);
    onProgress?.({ stage: "finishing", sent: 1 });
    const confirmed = await confirm(data.id);
    if (!confirmed.data) throw saveError(confirmed.error, `Couldn't finish ${file.name}.`);
  } catch (error) {
    await undo(data.id).catch(() => undefined);
    throw error;
  }
  return data.id;
}

export function useBusinessPhotos(businessId: number) {
  const queryClient = useQueryClient();
  const userId = useSession()?.user.id;
  const path = { business_id: businessId };
  const refresh = () => queryClient.invalidateQueries({ queryKey: partnerBusinessKey(userId, businessId) });

  const upload = useMutation({
    mutationFn: ({ file, onProgress }: { file: File; onProgress?: OnUploadProgress }) =>
      uploadFile(
        (body) => apiClient().POST("/api/v1/partner/businesses/{business_id}/photos", { params: { path }, body }),
        (id) => apiClient().PATCH("/api/v1/partner/businesses/{business_id}/photos/{id}", { params: { path: { ...path, id } }, body: { uploaded: true } }),
        (id) => apiClient().DELETE("/api/v1/partner/businesses/{business_id}/photos/{id}", { params: { path: { ...path, id } } }),
        file,
        onProgress,
      ),
    onSettled: refresh,
  });

  const move = useMutation({
    mutationFn: async ({ id, position }: { id: number; position: number }) => {
      const { data, error } = await apiClient().PATCH("/api/v1/partner/businesses/{business_id}/photos/{id}", {
        params: { path: { ...path, id } },
        body: { position },
      });
      if (!data) throw saveError(error, "Couldn't move the photo.");
    },
    onSettled: refresh,
  });

  const remove = useMutation({
    mutationFn: async (id: number) => {
      const { response } = await apiClient().DELETE("/api/v1/partner/businesses/{business_id}/photos/{id}", {
        params: { path: { ...path, id } },
      });
      if (!response.ok) throw new Error("Couldn't delete the photo.");
    },
    onSettled: refresh,
  });

  // A new logo replaces the one before.
  const uploadLogo = useMutation({
    mutationFn: ({ file, onProgress }: { file: File; onProgress?: OnUploadProgress }) =>
      uploadFile(
        (body) => apiClient().POST("/api/v1/partner/businesses/{business_id}/logo", { params: { path }, body }),
        () => apiClient().PATCH("/api/v1/partner/businesses/{business_id}/logo", { params: { path }, body: { uploaded: true } }),
        () => apiClient().DELETE("/api/v1/partner/businesses/{business_id}/logo", { params: { path } }),
        file,
        onProgress,
      ),
    onSettled: refresh,
  });

  const removeLogo = useMutation({
    mutationFn: async () => {
      const { response } = await apiClient().DELETE("/api/v1/partner/businesses/{business_id}/logo", { params: { path } });
      if (!response.ok) throw new Error("Couldn't remove the logo.");
    },
    onSettled: refresh,
  });

  return { upload, move, remove, uploadLogo, removeLogo };
}
