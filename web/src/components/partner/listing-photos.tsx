"use client";

import Image from "next/image";
import { useState } from "react";
import { PhotoManager, SavedPhotos } from "@/components/photos/photo-manager";
import { Badge } from "@/components/ui/badge";
import { uploadedPhotos, useListingPhotos, type PartnerPhoto } from "./use-listing-photos";

// The photos in the partner's order: `order` (ids) first, then any not in it yet, such as
// one just uploaded; an id no longer among the photos (deleted) drops out.
export function orderedPhotos(photos: PartnerPhoto[], order?: number[]) {
  if (!order) return photos;
  const byId = new Map(photos.map((photo) => [photo.id, photo]));
  const placed = order.flatMap((id) => byId.get(id) ?? []);
  return [...placed, ...photos.filter((photo) => !order.includes(photo.id))];
}

// A saved listing's photos (RAA-109; the listing exists first, RAA-106), shown in the partner's
// order and changed in PhotoManager (Add photos / Manage photos): its uploads and deletes are
// saved there, while the order is the parent's to save with the listing (`photos` in its body),
// so the manager only reports it. `onBusyChange` says while the manager saves, so the parent
// holds a save back: a body's `photos` must list exactly the listing's photos. Unconfirmed rows
// aren't shown (`uploadedPhotos`) but hold a place. `limit` is the listing's photo_limit (5 for a
// tour, 12 otherwise, RAA-110).
export function ListingPhotos({
  listingId,
  name,
  photos,
  limit,
  order,
  onOrderChange,
  onBusyChange,
}: {
  listingId: number;
  name: string;
  photos: PartnerPhoto[];
  limit: number;
  order?: number[];
  onOrderChange: (ids: number[]) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const { upload, remove } = useListingPhotos(listingId);
  const [managing, setManaging] = useState(false);
  const uploaded = uploadedPhotos(photos);
  const shown = orderedPhotos(uploaded, order).map((photo) => ({ id: photo.id, src: photo.card_url, ready: photo.ready }));

  return (
    <>
      <SavedPhotos
        photos={shown}
        firstLabel="Cover"
        empty="No photos yet. Guests see the listing's icon until there is one."
        onManage={() => setManaging(true)}
        testId="listing-photos"
      />
      {managing && (
        <PhotoManager
          name={name}
          photos={shown}
          limit={limit - (photos.length - uploaded.length)}
          firstLabel="Cover"
          upload={(file, onProgress) => upload.mutateAsync({ file, onProgress })}
          remove={(id) => remove.mutateAsync(id)}
          saveOrder={async (ids) => onOrderChange(ids)}
          onClose={() => setManaging(false)}
          onBusyChange={onBusyChange}
          testId="listing-photos-manager"
        />
      )}
    </>
  );
}

// A listing's photos at a glance, on its page (RAA-109): the cover first, marked, and
// "Processing" until a photo's sizes are made.
export function PhotoStrip({ photos }: { photos: PartnerPhoto[] }) {
  return (
    <ul aria-label="Photos" data-testid="listing-photo-strip" className="flex gap-2 overflow-x-auto">
      {uploadedPhotos(photos).map((photo, index) => (
        <li key={photo.id} className="relative aspect-[4/3] w-32 shrink-0 overflow-hidden rounded-control bg-surface-2">
          <Image src={photo.card_url} alt={`Photo ${index + 1}`} fill unoptimized sizes="8rem" className="object-cover" />
          {(index === 0 || !photo.ready) && (
            <Badge tone={photo.ready ? "aqua" : "mist"} className="absolute left-1 top-1">
              {photo.ready ? "Cover" : "Processing…"}
            </Badge>
          )}
        </li>
      ))}
    </ul>
  );
}
