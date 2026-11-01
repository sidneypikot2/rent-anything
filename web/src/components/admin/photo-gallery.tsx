"use client";

import { useRef } from "react";
import { PhotoManager, SavedPhotos, type ManagedPhoto } from "@/components/photos/photo-manager";
import { MAX_GALLERY_PHOTOS, uploadedAdminPhotos, useAdminPhotos, type AdminPhoto, type PhotoOwner } from "./use-admin-photos";

const photoTestId = (owner: PhotoOwner) => `admin-${owner.kind === "area" ? "destination" : "landmark"}-photos`;
const managed = (photos: AdminPhoto[]): ManagedPhoto[] =>
  uploadedAdminPhotos(photos).map((photo) => ({ id: photo.id, src: photo.card_url, ready: photo.ready }));

// A destination's or a place to see's photos in the editor (RAA-211, over RAA-210's API): shown
// as guests get them, and changed in PhotoManager while `managing` (the form's Photos section
// opens it from its header, ManagePhotosButton), saved apart from the form. `photos` is the
// owner's, in order with any still uploading, which aren't shown (`uploadedAdminPhotos`) but
// hold a place among the API's positions.
export function PhotoGallery({
  owner,
  name,
  photos,
  firstLabel,
  managing,
  onManagingChange,
}: {
  owner: PhotoOwner;
  name: string;
  photos: AdminPhoto[];
  firstLabel: string;
  managing: boolean;
  onManagingChange: (managing: boolean) => void;
}) {
  return (
    <>
      <SavedPhotos
        photos={managed(photos)}
        firstLabel={firstLabel}
        empty="No photos yet. Guests see a stand-in until there is one."
        testId={photoTestId(owner)}
      />
      {managing && (
        <AdminPhotoManager owner={owner} name={name} photos={photos} firstLabel={firstLabel} onClose={() => onManagingChange(false)} />
      )}
    </>
  );
}

export const managePhotosTestId = (owner: PhotoOwner) => `${photoTestId(owner)}-manage`;

// The manager over the admin API, mounted while it is open.
function AdminPhotoManager({
  owner,
  name,
  photos,
  firstLabel,
  onClose,
}: {
  owner: PhotoOwner;
  name: string;
  photos: AdminPhoto[];
  firstLabel: string;
  onClose: () => void;
}) {
  const { upload, move, remove } = useAdminPhotos(owner);
  // The owner's photos in the API's order while the manager saves: each delete and upload
  // changes it as the API does, so the moves after them can be worked out without asking again.
  const serverOrder = useRef(photos.map((photo) => photo.id));
  const shown = managed(photos);

  return (
    <PhotoManager
      name={name}
      photos={shown}
      // An upload still running elsewhere holds one of the places.
      limit={MAX_GALLERY_PHOTOS - (photos.length - shown.length)}
      firstLabel={firstLabel}
      upload={async (file, onProgress) => {
        const id = await upload.mutateAsync({ file, onProgress });
        serverOrder.current.push(id);
        return id;
      }}
      remove={async (id) => {
        await remove.mutateAsync(id);
        serverOrder.current = serverOrder.current.filter((each) => each !== id);
      }}
      // Each photo out of place moves to its position, the others shifting as the API shifts
      // them; any row not in `ids` (an upload running elsewhere) ends up after them.
      saveOrder={async (ids) => {
        const order = serverOrder.current;
        for (const [index, id] of ids.entries()) {
          if (order[index] === id) continue;
          await move.mutateAsync({ id, position: index + 1 });
          order.splice(order.indexOf(id), 1);
          order.splice(index, 0, id);
        }
      }}
      onClose={onClose}
      testId={`${photoTestId(owner)}-manager`}
    />
  );
}
