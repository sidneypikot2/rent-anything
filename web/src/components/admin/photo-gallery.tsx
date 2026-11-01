"use client";

import { useRef, useState } from "react";
import { PhotoManager, SavedPhotos, type ManagedPhoto } from "@/components/photos/photo-manager";
import { MAX_GALLERY_PHOTOS, uploadedAdminPhotos, useAdminPhotos, type AdminPhoto, type PhotoOwner } from "./use-admin-photos";

// A destination's or a place to see's photos in the editor (RAA-211, over RAA-210's API): shown
// as guests get them, and changed in PhotoManager (Add photos / Manage photos), saved apart from
// the form. `photos` is the owner's, in order with any still uploading, which aren't shown
// (`uploadedAdminPhotos`) but hold a place among the API's positions.
export function PhotoGallery({
  owner,
  name,
  photos,
  firstLabel,
}: {
  owner: PhotoOwner;
  name: string;
  photos: AdminPhoto[];
  firstLabel: string;
}) {
  const { upload, move, remove } = useAdminPhotos(owner);
  const [managing, setManaging] = useState(false);
  // The owner's photos in the API's order while the manager saves: each delete and upload
  // changes it as the API does, so the moves after them can be worked out without asking again.
  const serverOrder = useRef<number[]>([]);
  const shown: ManagedPhoto[] = uploadedAdminPhotos(photos).map((photo) => ({ id: photo.id, src: photo.card_url, ready: photo.ready }));
  const testId = `admin-${owner.kind === "area" ? "destination" : "landmark"}-photos`;

  return (
    <>
      <SavedPhotos
        photos={shown}
        firstLabel={firstLabel}
        empty="No photos yet. Guests see a stand-in until there is one."
        onManage={() => {
          serverOrder.current = photos.map((photo) => photo.id);
          setManaging(true);
        }}
        testId={testId}
      />
      {managing && (
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
          onClose={() => setManaging(false)}
          testId={`${testId}-manager`}
        />
      )}
    </>
  );
}
