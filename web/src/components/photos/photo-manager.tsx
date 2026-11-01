"use client";

import { DragDropProvider } from "@dnd-kit/react";
import { isSortable, useSortable } from "@dnd-kit/react/sortable";
import Image from "next/image";
import { useEffect, useId, useRef, useState, type DragEvent, type ReactNode } from "react";
import { CategoryGlyph } from "@/components/discovery/tag-glyphs";
import { PHOTO_TYPES, photoProblem, type OnUploadProgress, type UploadProgress } from "@/components/partner/use-listing-photos";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Dialog, DialogSummary } from "@/components/ui/dialog";

// A photo already saved, as the owner's page has it.
export type ManagedPhoto = { id: number; src: string; ready: boolean };

// A tile in the manager: a saved photo, or a file picked here, which gets its id once uploaded.
type Tile =
  | { key: string; photo: ManagedPhoto }
  | { key: string; file: File; preview: string; id?: number; progress?: UploadProgress; error?: string };

const savedTile = (photo: ManagedPhoto): Tile => ({ key: `photo-${photo.id}`, photo });
const tileId = (tile: Tile) => ("photo" in tile ? tile.photo.id : tile.id);

const plural = (count: number, one: string) => `${count} ${one}${count === 1 ? "" : "s"}`;

// Where an owner's photos are changed (RAA-211), for a destination's or a place to see's (the
// admin console) and a partner's listing: opened from the read-only photos on its page. The
// photos as they will be, in order: drag one (a finger after a short hold, or the keyboard) to
// move it, Make <first> moves one to the front, Delete takes one out after a confirm, and files
// picked or dropped here join the end as previews. Nothing is saved until Save, which deletes,
// then uploads the new files one at a time in their order (each showing its progress), then saves
// the order; the dialog can't be closed until that's over. It closes once all of it worked;
// otherwise it stays open on what failed, and Save tries what's left again. Rendered only while
// open, so each opening starts from the page's photos.
export function PhotoManager({
  name,
  photos,
  limit,
  firstLabel,
  upload,
  remove,
  saveOrder,
  onClose,
  onBusyChange,
  testId,
}: {
  name: string;
  photos: ManagedPhoto[];
  limit: number;
  // What the first photo is: "Banner", "Cover".
  firstLabel: string;
  upload: (file: File, onProgress: OnUploadProgress) => Promise<number>;
  remove: (id: number) => Promise<void>;
  // The saved photos' ids in their new order, once the deletes and uploads are done.
  saveOrder: (ids: number[]) => Promise<void>;
  onClose: () => void;
  onBusyChange?: (busy: boolean) => void;
  testId: string;
}) {
  const inputId = useId();
  const [tiles, setTiles] = useState<Tile[]>(() => photos.map(savedTile));
  const [deleted, setDeleted] = useState<number[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [dropping, setDropping] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Tile>();
  const [first] = useState(() => photos.map((photo) => photo.id).join());
  // The tiles for the preview cleanup on close, which runs after the last render.
  const latest = useRef(tiles);
  useEffect(() => {
    latest.current = tiles;
  });

  const fresh = tiles.filter((tile) => "file" in tile && tile.id === undefined);
  const order = tiles.map((tile) => tileId(tile) ?? tile.key).join();
  const dirty = deleted.length > 0 || fresh.length > 0 || order !== first;
  const room = limit - tiles.length;
  const label = firstLabel.toLowerCase();

  useEffect(() => onBusyChange?.(saving), [saving, onBusyChange]);
  // A picked file's preview is an object URL, let go of when its tile goes.
  useEffect(
    () => () => {
      for (const tile of latest.current) if ("file" in tile) URL.revokeObjectURL(tile.preview);
    },
    [],
  );

  const patch = (key: string, change: Partial<Extract<Tile, { file: File }>>) =>
    setTiles((current) => current.map((tile) => (tile.key === key && "file" in tile ? { ...tile, ...change } : tile)));

  function addFiles(files: File[]) {
    const problems: string[] = [];
    const added: Tile[] = [];
    for (const file of files) {
      const problem = photoProblem(file);
      if (problem) problems.push(problem);
      else if (added.length < room) added.push({ key: `file-${crypto.randomUUID()}`, file, preview: URL.createObjectURL(file) });
      else problems.push(`${file.name}: ${name} can have at most ${limit} photos`);
    }
    setErrors(problems);
    setTiles((current) => [...current, ...added]);
  }

  function drop(tile: Tile) {
    if ("file" in tile) URL.revokeObjectURL(tile.preview);
    const id = tileId(tile);
    if (id !== undefined) setDeleted((current) => [...current, id]);
    setTiles((current) => current.filter((each) => each.key !== tile.key));
  }

  function moveTo(from: number, to: number) {
    setTiles((current) => {
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setErrors([]);
    const problems: string[] = [];
    let left = [...deleted];
    for (const id of deleted) {
      await remove(id)
        .then(() => (left = left.filter((each) => each !== id)))
        .catch((error: Error) => problems.push(error.message));
    }
    setDeleted(left);
    // The order as Save found it (nothing can move while it runs), with each upload's new id.
    const ids = tiles.map(tileId);
    for (const [index, tile] of tiles.entries()) {
      if (!("file" in tile) || tile.id !== undefined) continue;
      patch(tile.key, { error: undefined });
      await upload(tile.file, (progress) => patch(tile.key, { progress }))
        .then((id) => {
          ids[index] = id;
          patch(tile.key, { id, progress: undefined });
        })
        .catch((error: Error) => {
          patch(tile.key, { error: error.message, progress: undefined });
          problems.push(error.message);
        });
    }
    if (problems.length === 0) {
      await saveOrder(ids.filter((id) => id !== undefined)).catch((error: Error) => problems.push(error.message));
    }
    setSaving(false);
    if (problems.length > 0) setErrors(problems);
    else onClose();
  }

  const uploadsLeft = fresh.length;
  const uploading = tiles.filter((tile) => "file" in tile && tile.progress).map((tile) => tile.key)[0];
  const uploadedNow = tiles.filter((tile) => "file" in tile && tile.id !== undefined).length;
  const change = [
    uploadsLeft > 0 && `${uploadsLeft} new`,
    deleted.length > 0 && `${deleted.length} to delete`,
    order !== first && uploadsLeft === 0 && deleted.length === 0 && "New order",
  ].filter(Boolean);

  return (
    <Dialog
      open
      onClose={onClose}
      placement="sheet"
      pinned
      dirty={dirty}
      locked={saving}
      title={name}
      meta={`${plural(tiles.length, "photo")} of ${limit} · the first is the ${label}. Drag a photo to move it.`}
      data-testid={testId}
      summary={
        saving ? (
          <DialogSummary
            value={uploading ? `Uploading ${uploadedNow + 1} of ${uploadedNow + uploadsLeft}` : "Saving…"}
            detail="Keep this open until it's done"
          />
        ) : change.length > 0 ? (
          <DialogSummary value={change.join(" · ")} detail="Not saved yet" />
        ) : undefined
      }
      actions={
        <Button type="button" loading={saving} disabled={!dirty && !saving} onClick={() => void save()} data-testid={`${testId}-save`}>
          {saving ? "Saving…" : uploadsLeft > 0 ? `Upload ${plural(uploadsLeft, "photo")}` : "Save changes"}
        </Button>
      }
    >
      {errors.length > 0 && (
        <ul role="alert" className="flex flex-col gap-1 text-sm text-danger">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}

      <DragDropProvider
        onDragEnd={(event) => {
          if (event.canceled) return;
          const { source } = event.operation;
          if (isSortable(source) && source.initialIndex !== source.index) moveTo(source.initialIndex, source.index);
        }}
      >
        <ul aria-label="Photos" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {tiles.map((tile, index) => (
            <PhotoTile
              key={tile.key}
              tile={tile}
              index={index}
              locked={saving}
              badges={
                <>
                  {index === 0 && <Badge>{firstLabel}</Badge>}
                  {"photo" in tile && !(photos.find((photo) => photo.id === tile.photo.id)?.ready ?? tile.photo.ready) && (
                    <Badge tone="mist">Preparing…</Badge>
                  )}
                  {"file" in tile && (
                    <Badge tone={tile.id === undefined ? "kind" : "emerald"}>{tile.id === undefined ? "New" : "Uploaded"}</Badge>
                  )}
                </>
              }
              actions={
                <TileActions
                  first={index === 0}
                  label={label}
                  disabled={saving}
                  onFirst={() => moveTo(index, 0)}
                  onDelete={() => ("file" in tile && tile.id === undefined ? drop(tile) : setDeleting(tile))}
                  testId={testId}
                />
              }
            />
          ))}
          {room > 0 && (
            <li>
              <label
                htmlFor={inputId}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDropping(true);
                }}
                onDragLeave={() => setDropping(false)}
                onDrop={(event: DragEvent<HTMLLabelElement>) => {
                  event.preventDefault();
                  setDropping(false);
                  if (!saving) addFiles([...event.dataTransfer.files]);
                }}
                aria-disabled={saving}
                className={cn(
                  "flex aspect-[4/3] flex-col items-center justify-center gap-1.5 rounded-control border border-dashed border-line-strong bg-surface-2 px-3 text-center transition-colors duration-300 ease-calm",
                  saving ? "opacity-60" : "cursor-pointer hover:border-primary",
                  dropping && "border-primary bg-mist",
                )}
              >
                <span className="flex size-10 items-center justify-center rounded-control bg-mist text-primary">
                  <CategoryGlyph name="Camera" className="size-5" />
                </span>
                <span className="text-sm font-semibold">Add photos</span>
                <span className="text-xs text-muted">Drop or choose · JPG, PNG, WebP up to 10 MB</span>
                <input
                  id={inputId}
                  type="file"
                  multiple
                  accept={PHOTO_TYPES.join(",")}
                  disabled={saving}
                  data-testid={`${testId}-input`}
                  className="sr-only"
                  onChange={(event) => {
                    addFiles([...(event.target.files ?? [])]);
                    event.target.value = "";
                  }}
                />
              </label>
            </li>
          )}
        </ul>
      </DragDropProvider>
      {room <= 0 && <p className="text-sm text-muted">That&apos;s the most photos it can have ({limit}).</p>}

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
              data-testid={`${testId}-delete-confirm`}
              onClick={() => {
                if (deleting) drop(deleting);
                setDeleting(undefined);
              }}
            >
              Delete photo
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          {deleting && tiles[0]?.key === deleting.key && tiles.length > 1
            ? `It goes when you save, and the next photo becomes the ${label}.`
            : "It goes when you save. Guests then stop seeing it, and it can't be undone."}
        </p>
      </Dialog>
    </Dialog>
  );
}

// One photo, dragged as a whole (its buttons still click: a drag never starts on one). A saved
// photo shows its card size, a picked file its preview; while it uploads, a bar shows how far.
function PhotoTile({
  tile,
  index,
  locked,
  badges,
  actions,
}: {
  tile: Tile;
  index: number;
  locked: boolean;
  badges: ReactNode;
  actions: ReactNode;
}) {
  const { ref, isDragging } = useSortable({ id: tile.key, index, disabled: locked });
  const progress = "file" in tile ? tile.progress : undefined;
  const error = "file" in tile ? tile.error : undefined;
  return (
    <li ref={ref} data-testid="photo-tile" className={cn("flex flex-col gap-2", !locked && "cursor-grab", isDragging && "opacity-70")}>
      <div className={cn("relative aspect-[4/3] overflow-hidden rounded-control bg-surface-2", isDragging && "shadow-lift")}>
        <Image
          src={"photo" in tile ? tile.photo.src : tile.preview}
          alt={`Photo ${index + 1}`}
          fill
          unoptimized
          sizes="12rem"
          draggable={false}
          className="object-cover"
        />
        <div className="absolute left-2 top-2 flex flex-wrap gap-1">{badges}</div>
        {(progress || error) && (
          <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1 bg-scrim/70 px-2.5 py-2 text-xs font-semibold text-white">
            {error ? (
              <span className="text-pretty">{error}</span>
            ) : (
              progress && (
                <>
                  <span>
                    {progress.stage === "preparing"
                      ? "Preparing…"
                      : progress.stage === "finishing"
                        ? "Finishing…"
                        : `Uploading ${Math.round(progress.sent * 100)}%`}
                  </span>
                  <span className="h-1.5 overflow-hidden rounded-full bg-white/30" role="progressbar" aria-valuenow={Math.round(progress.sent * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={`Photo ${index + 1} upload`}>
                    <span className="block h-full rounded-full bg-white transition-[width] duration-300 ease-calm" style={{ width: `${progress.sent * 100}%` }} />
                  </span>
                </>
              )
            )}
          </div>
        )}
      </div>
      {actions}
    </li>
  );
}

function TileActions({
  first,
  label,
  disabled,
  onFirst,
  onDelete,
  testId,
}: {
  first: boolean;
  label: string;
  disabled: boolean;
  onFirst: () => void;
  onDelete: () => void;
  testId: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {!first && (
        <Button type="button" size="sm" variant="soft" disabled={disabled} onClick={onFirst} data-testid={`${testId}-first`}>
          Make {label}
        </Button>
      )}
      <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={onDelete} data-testid={`${testId}-delete`}>
        Delete
      </Button>
    </div>
  );
}

// An owner's saved photos on its page, as guests get them, in order: the first marked, and
// "Preparing…" until its sizes are made. Changed only in PhotoManager, which ManagePhotosButton
// opens from the section's header.
export function SavedPhotos({ photos, firstLabel, empty, testId }: { photos: ManagedPhoto[]; firstLabel: string; empty: string; testId: string }) {
  return (
    <div data-testid={testId}>
      {photos.length === 0 ? (
        <p className="text-sm text-muted">{empty}</p>
      ) : (
        <ul aria-label="Photos" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((photo, index) => (
            <li key={photo.id} data-testid={`${testId}-item`} className="relative aspect-[4/3] overflow-hidden rounded-control bg-surface-2">
              <Image src={photo.src} alt={`Photo ${index + 1}`} fill unoptimized sizes="12rem" className="object-cover" />
              <div className="absolute left-2 top-2 flex gap-1">
                {index === 0 && <Badge>{firstLabel}</Badge>}
                {!photo.ready && <Badge tone="mist">Preparing…</Badge>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// What opens PhotoManager, beside the photos section's title: "Add photos" while there are none,
// "Manage photos" after.
export function ManagePhotosButton({ count, onClick, disabled = false, testId }: { count: number; onClick: () => void; disabled?: boolean; testId: string }) {
  return (
    <Button type="button" size="sm" variant="soft" disabled={disabled} onClick={onClick} glyph={count === 0 ? "plus" : undefined} data-testid={testId}>
      {count === 0 ? "Add photos" : "Manage photos"}
    </Button>
  );
}
