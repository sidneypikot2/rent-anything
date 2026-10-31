"use client";

import Image from "next/image";
import { useId, useRef, useState, type DragEvent } from "react";
import { CategoryGlyph } from "@/components/discovery/tag-glyphs";
import { PHOTO_TYPES, photoProblem } from "@/components/partner/use-listing-photos";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Dialog } from "@/components/ui/dialog";
import {
  MAX_GALLERY_PHOTOS,
  uploadedAdminPhotos,
  useAdminPhotos,
  type AdminPhoto,
  type PhotoOwner,
} from "./use-admin-photos";

type Upload = { key: number; name: string };

// A destination's or a place to see's photos in the editor (RAA-211, over RAA-210's API): choose
// or drop files and each is uploaded and confirmed at once, after the others; each photo can be
// made first (the banner, or the card's photo), replaced in its place, or deleted after a
// confirm. Saved apart from the form, as a listing's photos are. `photos` is the owner's, in
// order with any still uploading, which aren't shown (`uploadedAdminPhotos`) but hold a place.
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
  const inputId = useId();
  const replaceInput = useRef<HTMLInputElement>(null);
  const { upload, replace, move, remove } = useAdminPhotos(owner);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [replacing, setReplacing] = useState<AdminPhoto>();
  const [deleting, setDeleting] = useState<AdminPhoto>();
  const shown = uploadedAdminPhotos(photos);
  const room = MAX_GALLERY_PHOTOS - photos.length - uploads.length;
  const busy = uploads.length > 0 || replace.isPending || move.isPending || remove.isPending;
  const testId = `admin-${owner.kind === "area" ? "destination" : "landmark"}-photos`;

  // One at a time, in the order chosen, so they keep that order after the others.
  async function addFiles(files: File[]) {
    const problems: string[] = [];
    const accepted: File[] = [];
    for (const file of files) {
      const problem = photoProblem(file);
      if (problem) problems.push(problem);
      else if (accepted.length < room) accepted.push(file);
      else problems.push(`${file.name}: ${name} can have at most ${MAX_GALLERY_PHOTOS} photos`);
    }
    setErrors(problems);
    const queued = accepted.map((file) => ({ key: Math.random(), name: file.name, file }));
    setUploads((current) => [...current, ...queued]);
    for (const item of queued) {
      await upload
        .mutateAsync(item.file)
        .catch((error: Error) => setErrors((current) => [...current, error.message]))
        .finally(() => setUploads((current) => current.filter((upload) => upload.key !== item.key)));
    }
  }

  function replaceWith(file: File | undefined) {
    const photo = replacing;
    setReplacing(undefined);
    if (!file || !photo) return;
    const problem = photoProblem(file);
    if (problem) return setErrors([problem]);
    setErrors([]);
    // Its place among all the owner's photos, which the API numbers from 1.
    const position = photos.findIndex((each) => each.id === photo.id) + 1;
    replace.mutate({ file, photo, position }, { onError: (error) => setErrors([error.message]) });
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    if (room > 0) void addFiles([...event.dataTransfer.files]);
  }

  return (
    <div data-testid={testId} className="flex flex-col gap-4">
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
          "flex flex-col items-center gap-2 rounded-control border border-dashed border-line-strong bg-surface-2 px-4 py-8 text-center transition-colors duration-300 ease-calm",
          room > 0 ? "cursor-pointer hover:border-primary" : "opacity-60",
          dragging && "border-primary bg-mist",
        )}
      >
        <span className="flex size-12 items-center justify-center rounded-control bg-mist text-primary">
          <CategoryGlyph name="Camera" className="size-6" />
        </span>
        <span className="text-sm font-semibold">
          {room > 0 ? "Drag photos here or choose them" : `That's the most photos it can have (${MAX_GALLERY_PHOTOS})`}
        </span>
        <span className="text-xs text-muted">
          JPG, PNG or WebP, up to 10 MB each. The first photo is the {firstLabel.toLowerCase()}. {shown.length} /{" "}
          {MAX_GALLERY_PHOTOS}
        </span>
        <input
          id={inputId}
          type="file"
          multiple
          accept={PHOTO_TYPES.join(",")}
          disabled={room <= 0}
          data-testid={`${testId}-input`}
          className="sr-only"
          onChange={(event) => {
            void addFiles([...(event.target.files ?? [])]);
            event.target.value = "";
          }}
        />
      </label>
      <input
        ref={replaceInput}
        type="file"
        accept={PHOTO_TYPES.join(",")}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        data-testid={`${testId}-replace-input`}
        onChange={(event) => {
          replaceWith(event.target.files?.[0]);
          event.target.value = "";
        }}
      />

      {errors.length > 0 && (
        <ul role="alert" className="flex flex-col gap-1 text-sm text-danger">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}

      {shown.length === 0 && uploads.length === 0 ? (
        <p className="text-sm text-muted">No photos yet. Guests see a stand-in until there is one.</p>
      ) : (
        <ul aria-label="Photos" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {shown.map((photo, index) => (
            <li key={photo.id} data-testid={`${testId}-item`} className="flex flex-col gap-2">
              <div className="relative aspect-[4/3] overflow-hidden rounded-control bg-surface-2">
                <Image
                  src={photo.card_url}
                  alt={`${name} photo ${index + 1}`}
                  fill
                  unoptimized
                  sizes="12rem"
                  className="object-cover"
                />
                <div className="absolute left-2 top-2 flex gap-1">
                  {index === 0 && <Badge>{firstLabel}</Badge>}
                  {!photo.ready && <Badge tone="mist">Preparing…</Badge>}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1">
                {index > 0 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="soft"
                    disabled={busy}
                    onClick={() =>
                      move.mutate({ id: photo.id, position: 1 }, { onError: (error) => setErrors([error.message]) })
                    }
                    data-testid={`${testId}-first`}
                  >
                    Make {firstLabel.toLowerCase()}
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => {
                    setReplacing(photo);
                    replaceInput.current?.click();
                  }}
                  data-testid={`${testId}-replace`}
                >
                  {replace.isPending && replace.variables?.photo.id === photo.id ? "Replacing…" : "Replace"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => setDeleting(photo)}
                  data-testid={`${testId}-delete`}
                >
                  Delete
                </Button>
              </div>
            </li>
          ))}
          {uploads.map((item) => (
            <li key={item.key} className="flex flex-col gap-2" data-testid={`${testId}-uploading`}>
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
        tone="danger"
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
              data-testid={`${testId}-delete-confirm`}
              onClick={() => {
                if (!deleting) return;
                remove.mutate(deleting.id, {
                  onError: (error) => setErrors([error.message]),
                  onSettled: () => setDeleting(undefined),
                });
              }}
            >
              {remove.isPending ? "Deleting…" : "Delete photo"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          {deleting && shown[0]?.id === deleting.id && shown.length > 1
            ? `Guests stop seeing it straight away, and the next photo becomes the ${firstLabel.toLowerCase()}.`
            : "Guests stop seeing it straight away. This can't be undone."}
        </p>
      </Dialog>
    </div>
  );
}
