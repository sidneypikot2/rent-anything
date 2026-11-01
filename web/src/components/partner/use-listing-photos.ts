"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import SparkMD5 from "spark-md5";
import { apiClient } from "@/api/client";
import type { components } from "@/api/schema";
import { useSession } from "@/lib/auth/session";
import { partnerListingKey, saveError } from "./use-partner-listings";

export type PartnerPhoto = components["schemas"]["partner_photo"];
type PhotoType = components["schemas"]["photo_upload_body"]["content_type"];

// What the API takes (RAA-106): checked here first so a partner hears at once, not after a
// request. How many a listing takes is its photo_limit (RAA-110).
export const PHOTO_TYPES: PhotoType[] = ["image/jpeg", "image/png", "image/webp"];
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

// Why a file can't be a listing photo; undefined when it can.
export function photoProblem(file: File) {
  if (!PHOTO_TYPES.includes(file.type as PhotoType)) return `${file.name}: only JPG, PNG or WebP photos`;
  if (file.size > MAX_PHOTO_BYTES) return `${file.name}: larger than 10 MB`;
  if (file.size === 0) return `${file.name}: the file is empty`;
  return undefined;
}

// The file's MD5, base64-encoded, as the signed upload expects in Content-MD5. Web Crypto
// has no MD5, hence spark-md5 (its raw digest is a binary string, which btoa encodes).
export async function md5Base64(file: File) {
  return btoa(SparkMD5.ArrayBuffer.hash(await file.arrayBuffer(), true));
}

// Where one photo's upload is (PhotoManager shows it): working out its checksum and asking the
// API for the upload ("preparing"), its bytes going to storage ("sending", `sent` from 0 to 1),
// then the confirm ("finishing").
export type UploadProgress = { stage: "preparing" | "sending" | "finishing"; sent: number };
export type OnUploadProgress = (progress: UploadProgress) => void;

// PUTs a file to its signed storage URL, reporting the bytes sent. XMLHttpRequest rather than
// fetch, which can't report an upload's progress; this is the one request in the app that
// doesn't go through apiClient(), as it goes to storage, not the API. Resolves with whether
// storage took it.
export function putWithProgress(url: string, headers: Record<string, string>, file: File, onProgress?: OnUploadProgress) {
  return new Promise<boolean>((resolve) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url);
    for (const [name, value] of Object.entries(headers)) request.setRequestHeader(name, value);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.({ stage: "sending", sent: event.loaded / event.total });
    };
    request.onload = () => resolve(request.status >= 200 && request.status < 300);
    request.onerror = request.onabort = () => resolve(false);
    request.send(file);
  });
}

// Adding a photo to a listing that already exists (RAA-109): the API makes the row and signs
// an upload; the browser PUTs the bytes straight to storage (R2, or the local stack's
// stand-in), which is not the API and so not apiClient(); then the upload is confirmed. Returns
// the new photo's id.
async function uploadPhoto(listingId: number, file: File, onProgress?: OnUploadProgress) {
  onProgress?.({ stage: "preparing", sent: 0 });
  const client = apiClient();
  const path = { listing_id: listingId };
  const { data, error } = await client.POST("/api/v1/partner/listings/{listing_id}/photos", {
    params: { path },
    body: {
      filename: file.name,
      byte_size: file.size,
      checksum: await md5Base64(file),
      content_type: file.type as PhotoType,
    },
  });
  if (!data) throw saveError(error, `Couldn't add ${file.name}.`);

  const photo = { params: { path: { ...path, id: data.id } } };
  try {
    const stored = await putWithProgress(data.upload.url, data.upload.headers, file, onProgress);
    if (!stored) throw new Error(`Couldn't upload ${file.name}.`);
    onProgress?.({ stage: "finishing", sent: 1 });
    const confirmed = await client.PATCH("/api/v1/partner/listings/{listing_id}/photos/{id}", {
      ...photo,
      body: { uploaded: true },
    });
    if (!confirmed.data) throw saveError(confirmed.error, `Couldn't finish ${file.name}.`);
  } catch (error) {
    // Don't leave the row holding one of the listing's places; the API would purge it in two days anyway.
    await client.DELETE("/api/v1/partner/listings/{listing_id}/photos/{id}", photo).catch(() => undefined);
    throw error;
  }  return data.id;
}

// Only a confirmed photo has a file behind it: an unconfirmed row is another file still
// uploading, or one whose upload failed.
export function uploadedPhotos(photos: PartnerPhoto[]) {
  return photos.filter((photo) => photo.uploaded);
}

// A listing's photos: each upload or delete is saved at once and the listing asked for
// again. Their order is part of the listing itself (`photos` in its body).
export function useListingPhotos(listingId: number) {
  const userId = useSession()?.user.id;
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: partnerListingKey(userId, listingId) });

  const upload = useMutation({
    mutationFn: ({ file, onProgress }: { file: File; onProgress?: OnUploadProgress }) => uploadPhoto(listingId, file, onProgress),
    onSettled: refresh,
  });

  const remove = useMutation({
    mutationFn: async (id: number) => {
      const { response } = await apiClient().DELETE("/api/v1/partner/listings/{listing_id}/photos/{id}", {
        params: { path: { listing_id: listingId, id } },
      });
      if (!response.ok) throw new Error("Couldn't delete the photo.");
    },
    onSettled: refresh,
  });

  return { upload, remove };
}
