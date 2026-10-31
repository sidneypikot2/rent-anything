"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import type { components } from "@/api/schema";
import { md5Base64 } from "@/components/partner/use-listing-photos";
import { saveError } from "@/components/partner/use-partner-listings";

export type AdminPhoto = components["schemas"]["admin_photo"];
type UploadBody = components["schemas"]["photo_upload_body"];
type UpdateBody = components["schemas"]["admin_photo_update_body"];

// Whose photos: a destination's (the first is its banner) or a place to see's (the first is
// its card's), by slug (RAA-210).
export type PhotoOwner = { kind: "area" | "landmark"; slug: string };

// What the API takes for either (GalleryPhotos::MAX).
export const MAX_GALLERY_PHOTOS = 12;

export const adminAreaKey = (slug: string) => ["admin-area", slug] as const;
export const adminLandmarkKey = (slug: string) => ["admin-landmark", slug] as const;

// While a photo is uploaded but not ready (being sized), its owner is asked for again every two
// seconds, as a partner's listing is.
export function photoPollMs(photos: AdminPhoto[] | undefined) {
  return photos?.some((photo) => photo.uploaded && !photo.ready) ? 2000 : false;
}

// Only a confirmed photo has a file behind it: an unconfirmed row is another file still
// uploading, or one whose upload failed.
export function uploadedAdminPhotos(photos: AdminPhoto[]) {
  return photos.filter((photo) => photo.uploaded);
}

// The three calls, on the owner's own paths.
function addPhoto(owner: PhotoOwner, body: UploadBody) {
  const client = apiClient();
  return owner.kind === "area"
    ? client.POST("/api/v1/admin/areas/{area_slug}/photos", { params: { path: { area_slug: owner.slug } }, body })
    : client.POST("/api/v1/admin/landmarks/{landmark_slug}/photos", {
        params: { path: { landmark_slug: owner.slug } },
        body,
      });
}

function updatePhoto(owner: PhotoOwner, id: number, body: UpdateBody) {
  const client = apiClient();
  return owner.kind === "area"
    ? client.PATCH("/api/v1/admin/areas/{area_slug}/photos/{id}", { params: { path: { area_slug: owner.slug, id } }, body })
    : client.PATCH("/api/v1/admin/landmarks/{landmark_slug}/photos/{id}", {
        params: { path: { landmark_slug: owner.slug, id } },
        body,
      });
}

function deletePhoto(owner: PhotoOwner, id: number) {
  const client = apiClient();
  return owner.kind === "area"
    ? client.DELETE("/api/v1/admin/areas/{area_slug}/photos/{id}", { params: { path: { area_slug: owner.slug, id } } })
    : client.DELETE("/api/v1/admin/landmarks/{landmark_slug}/photos/{id}", {
        params: { path: { landmark_slug: owner.slug, id } },
      });
}

// Adding a photo as a listing photo is added (use-listing-photos.ts): the API makes the row after
// the others and signs an upload, the browser PUTs the bytes straight to storage (not the API,
// so not apiClient()), then confirms. Returns the new photo's id.
async function uploadPhoto(owner: PhotoOwner, file: File) {
  const { data, error } = await addPhoto(owner, {
    filename: file.name,
    byte_size: file.size,
    checksum: await md5Base64(file),
    content_type: file.type as UploadBody["content_type"],
  });
  if (!data) throw saveError(error, `Couldn't add ${file.name}.`);

  try {
    const stored = await fetch(data.upload.url, { method: "PUT", headers: data.upload.headers, body: file });
    if (!stored.ok) throw new Error(`Couldn't upload ${file.name}.`);
    const confirmed = await updatePhoto(owner, data.id, { uploaded: true });
    if (!confirmed.data) throw saveError(confirmed.error, `Couldn't finish ${file.name}.`);
  } catch (error) {
    // Don't leave the row holding one of the places; the API would purge it in two days anyway.
    await deletePhoto(owner, data.id).catch(() => undefined);
    throw error;
  }
  return data.id;
}

async function movePhoto(owner: PhotoOwner, id: number, position: number) {
  const { data, error } = await updatePhoto(owner, id, { position });
  if (!data) throw saveError(error, "Couldn't move the photo.");
}

async function removePhoto(owner: PhotoOwner, id: number) {
  const { response } = await deletePhoto(owner, id);
  if (!response.ok) throw new Error("Couldn't delete the photo.");
}

// A destination's or a place to see's photos: every change is saved at once and the owner asked
// for again. `position` is 1-based, in the owner's `photos` (which the API keeps numbered 1..n).
// Replacing one adds the new file, moves it into the old one's place, then deletes the old, so
// the banner stays a banner.
export function useAdminPhotos(owner: PhotoOwner) {
  const queryClient = useQueryClient();
  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: owner.kind === "area" ? adminAreaKey(owner.slug) : adminLandmarkKey(owner.slug),
    });

  const upload = useMutation({ mutationFn: (file: File) => uploadPhoto(owner, file), onSettled: refresh });

  const replace = useMutation({
    mutationFn: async ({ file, photo, position }: { file: File; photo: AdminPhoto; position: number }) => {
      const id = await uploadPhoto(owner, file);
      await movePhoto(owner, id, position);
      await removePhoto(owner, photo.id);
    },
    onSettled: refresh,
  });

  const move = useMutation({
    mutationFn: ({ id, position }: { id: number; position: number }) => movePhoto(owner, id, position),
    onSettled: refresh,
  });

  const remove = useMutation({ mutationFn: (id: number) => removePhoto(owner, id), onSettled: refresh });

  return { upload, replace, move, remove };
}
