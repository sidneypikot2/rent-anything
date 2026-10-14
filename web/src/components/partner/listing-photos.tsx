"use client";

import Image from "next/image";
import { useEffect, useId, useState, type DragEvent } from "react";
import { CategoryGlyph } from "@/components/discovery/tag-glyphs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Dialog } from "@/components/ui/dialog";
import {
  MAX_PHOTOS,
  PHOTO_TYPES,
  photoProblem,
  uploadedPhotos,
  useListingPhotos,
  type PartnerPhoto,
} from "./use-listing-photos";

// The photos in the partner's order: `order` (ids) first, then any not in it yet, such as
// one just uploaded; an id no longer among the photos (deleted) drops out.
export function orderedPhotos(photos: PartnerPhoto[], order?: number[]) {
  if (!order) return photos;
  const byId = new Map(photos.map((photo) => [photo.id, photo]));
  const placed = order.flatMap((id) => byId.get(id) ?? []);
  return [...placed, ...photos.filter((photo) => !order.includes(photo.id))];
}

type Upload = { key: number; name: string };

// A saved listing's photos (RAA-109; the listing exists first, RAA-106): choose or drop
// files and each is uploaded and confirmed at once, deleted at once after a confirm. The
// order is the parent's to save with the listing (`photos` in its body), so moving one only
// reports the new order. `onBusyChange` says while files upload or a photo is deleted, so
// the parent holds a save back: a body's `photos` must list exactly the listing's photos.
// Unconfirmed rows aren't shown (`uploadedPhotos`).
export function ListingPhotos({
  listingId,
  photos,
  order,
  onOrderChange,
  onBusyChange,
}: {
  listingId: number;
  photos: PartnerPhoto[];
  order?: number[];
  onOrderChange: (ids: number[]) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const inputId = useId();
  const { upload, remove } = useListingPhotos(listingId);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [deleting, setDeleting] = useState<PartnerPhoto>();
  const shown = orderedPhotos(uploadedPhotos(photos), order);
  const room = MAX_PHOTOS - photos.length - uploads.length;

  const busy = uploads.length > 0 || remove.isPending;
  useEffect(() => onBusyChange?.(busy), [busy, onBusyChange]);

  function addFiles(files: File[]) {
    const problems: string[] = [];
    const accepted: File[] = [];
    for (const file of files) {
      const problem = photoProblem(file);
      if (problem) problems.push(problem);
      else if (accepted.length < room) accepted.push(file);
      else problems.push(`${file.name}: a listing has at most ${MAX_PHOTOS} photos`);
    }
    setErrors(problems);
    for (const file of accepted) {
      const key = Math.random();
      setUploads((current) => [...current, { key, name: file.name }]);
      upload
        .mutateAsync(file)
        .catch((error: Error) => setErrors((current) => [...current, error.message]))
        .finally(() => setUploads((current) => current.filter((item) => item.key !== key)));
    }
  }

  function move(index: number, by: -1 | 1) {
    const ids = shown.map((photo) => photo.id);
    [ids[index], ids[index + by]] = [ids[index + by], ids[index]];
    onOrderChange(ids);
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    if (room > 0) addFiles([...event.dataTransfer.files]);
  }

  return (
    <div data-testid="listing-photos" className="flex flex-col gap-4">
      <label
        htmlFor={inputId}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        aria-disabled={room <= 0}
        className={cn(
          "flex flex-col items-center gap-2 rounded-control border border-dashed border-line-strong bg-surface-2 px-4 py-10 text-center transition-colors duration-300 ease-calm",
          room > 0 ? "cursor-pointer hover:border-primary" : "opacity-60",
          dragging && "border-primary bg-mist",
        )}
      >
        <span className="flex size-12 items-center justify-center rounded-control bg-mist text-primary">
          <CategoryGlyph name="Camera" className="size-6" />
        </span>
        <span className="text-sm font-semibold">
          {room > 0 ? "Drag photos here or choose them" : `That's the most photos a listing can have (${MAX_PHOTOS})`}
        </span>
        <span className="text-xs text-muted">JPG, PNG or WebP, up to 10 MB each. The first photo is the cover.</span>
        <input
          id={inputId}
          type="file"
          multiple
          accept={PHOTO_TYPES.join(",")}
          disabled={room <= 0}
          data-testid="listing-photo-input"
          className="sr-only"
          onChange={(event) => {
            addFiles([...(event.target.files ?? [])]);
            event.target.value = "";
          }}
        />
      </label>

      {errors.length > 0 && (
        <ul role="alert" className="flex flex-col gap-1 text-sm text-danger">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}

      {(shown.length > 0 || uploads.length > 0) && (
        <ul aria-label="Photos" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {shown.map((photo, index) => (
            <li key={photo.id} data-testid="listing-photo" className="flex flex-col gap-2">
              <div className="relative aspect-[4/3] overflow-hidden rounded-control bg-surface-2">
                <Image src={photo.card_url} alt={`Photo ${index + 1}`} fill unoptimized sizes="12rem" className="object-cover" />
                <div className="absolute left-2 top-2 flex gap-1">
                  {index === 0 && <Badge>Cover</Badge>}
                  {!photo.ready && <Badge tone="mist">Processing…</Badge>}
                </div>
              </div>
              <div className="flex items-center justify-between gap-1">
                <div className="flex gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="soft"
                    aria-label={`Move photo ${index + 1} earlier`}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  >
                    ←
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="soft"
                    aria-label={`Move photo ${index + 1} later`}
                    disabled={index === shown.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    →
                  </Button>
                </div>
                <Button type="button" size="sm" variant="ghost" onClick={() => setDeleting(photo)} data-testid="listing-photo-delete">
                  Delete
                </Button>
              </div>
            </li>
          ))}
          {uploads.map((item) => (
            <li key={item.key} className="flex flex-col gap-2" data-testid="listing-photo-uploading">
              <div className="flex aspect-[4/3] animate-pulse items-center justify-center rounded-control bg-surface-2 px-2 text-center text-xs text-muted">
                Uploading {item.name}…
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={deleting !== undefined}
        onClose={() => setDeleting(undefined)}
        title="Delete this photo?"
        actions={
          <>
            <Button type="button" variant="soft" onClick={() => setDeleting(undefined)}>
              Keep it
            </Button>
            <Button
              type="button"
              variant="danger"
              disabled={remove.isPending}
              data-testid="listing-photo-delete-confirm"
              onClick={() => {
                if (!deleting) return;
                remove.mutate(deleting.id, {
                  onError: (error) => setErrors([error.message]),
                  onSettled: () => setDeleting(undefined),
                });
              }}
            >
              Delete photo
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">Guests stop seeing it straight away. This can&apos;t be undone.</p>
      </Dialog>
    </div>
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
