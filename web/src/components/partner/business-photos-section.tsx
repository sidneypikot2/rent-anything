"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ManagePhotosButton, PhotoManager, SavedPhotos, type ManagedPhoto } from "@/components/photos/photo-manager";
import { FormSection } from "@/components/admin/destination-form";
import { Button } from "@/components/ui/button";
import { MAX_COVER_PHOTOS, useBusinessPhotos, type BusinessPhoto } from "./use-business-photos";
import { photoProblem, PHOTO_TYPES } from "./use-listing-photos";
import type { PartnerBusiness } from "./use-partner-businesses";

const managed = (photos: BusinessPhoto[]): ManagedPhoto[] =>
  photos.filter((photo) => photo.uploaded).map((photo) => ({ id: photo.id, src: photo.card_url, ready: photo.ready }));

// A business's logo and cover photos (RAA-281), saved apart from the form as each change is made:
// the logo is one file, picked to add or replace it; the covers are changed in PhotoManager, the
// first leading the shop page. Only on a saved business, since its photos belong to it.
export function BusinessPhotosSection({ business }: { business: PartnerBusiness }) {
  const photos = useBusinessPhotos(business.id);
  const [managing, setManaging] = useState(false);
  const [logoError, setLogoError] = useState<string>();
  const input = useRef<HTMLInputElement>(null);
  const shown = managed(business.cover_photos);
  const serverOrder = useRef<number[]>([]);
  const logo = business.logo?.uploaded ? business.logo : null;

  function pickLogo(file: File | undefined) {
    if (!file) return;
    const problem = photoProblem(file);
    if (problem) return setLogoError(problem);
    setLogoError(undefined);
    photos.uploadLogo.mutate({ file }, { onError: (error) => setLogoError(error.message) });
  }

  return (
    <>
      <FormSection title="Logo">
        <div className="flex items-center gap-4" data-testid="business-logo">
          <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-control border border-line bg-mist text-sm text-muted">
            {logo ? <Image src={logo.card_url} alt="Logo" width={80} height={80} unoptimized className="size-full object-cover" /> : "None"}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="soft" loading={photos.uploadLogo.isPending} onClick={() => input.current?.click()}>
              {logo ? "Replace logo" : "Add a logo"}
            </Button>
            {logo && (
              <Button type="button" size="sm" variant="ghost" onClick={() => photos.removeLogo.mutate()} disabled={photos.removeLogo.isPending}>
                Remove
              </Button>
            )}
          </div>
          <input
            ref={input}
            type="file"
            accept={PHOTO_TYPES.join(",")}
            className="sr-only"
            data-testid="business-logo-input"
            onChange={(event) => {
              pickLogo(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </div>
        <p className="text-sm text-muted">Square works best. Guests see it beside your name on your shop page.</p>
        {logoError && <p role="alert" className="text-sm text-danger">{logoError}</p>}
      </FormSection>
      <FormSection
        title="Cover photos"
        action={<ManagePhotosButton count={shown.length} onClick={() => setManaging(true)} testId="business-photos-manage" />}
      >
        <SavedPhotos
          photos={shown}
          firstLabel="Cover"
          empty="No cover photos yet. Your shop page shows your listings' photos until you add some."
          testId="business-cover-photos"
        />
      </FormSection>
      {managing && (
        <PhotoManager
          name={business.name}
          photos={shown}
          limit={MAX_COVER_PHOTOS - (business.cover_photos.length - shown.length)}
          firstLabel="Cover"
          upload={async (file, onProgress) => {
            if (serverOrder.current.length === 0) serverOrder.current = business.cover_photos.map((photo) => photo.id);
            const id = await photos.upload.mutateAsync({ file, onProgress });
            serverOrder.current.push(id);
            return id;
          }}
          remove={async (id) => {
            if (serverOrder.current.length === 0) serverOrder.current = business.cover_photos.map((photo) => photo.id);
            await photos.remove.mutateAsync(id);
            serverOrder.current = serverOrder.current.filter((each) => each !== id);
          }}
          // Each photo out of place moves to its position, the others shifting as the API shifts them.
          saveOrder={async (ids) => {
            if (serverOrder.current.length === 0) serverOrder.current = business.cover_photos.map((photo) => photo.id);
            const order = serverOrder.current;
            for (const [index, id] of ids.entries()) {
              if (order[index] === id) continue;
              await photos.move.mutateAsync({ id, position: index + 1 });
              order.splice(order.indexOf(id), 1);
              order.splice(index, 0, id);
            }
          }}
          onClose={() => {
            serverOrder.current = [];
            setManaging(false);
          }}
          testId="business-photos-manager"
        />
      )}
    </>
  );
}
