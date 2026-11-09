"use client";

import Image from "next/image";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { isApiPhoto } from "@/components/landing/sample-photos";
import { useRowLink } from "@/components/trips/trip-link";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/components/ui/cn";
import { Dialog } from "@/components/ui/dialog";
import { SamplePhotoTag } from "./photo-card";
import { ChevronGlyph, PlaceGlyph, TagGlyph } from "./tag-glyphs";

type Photo = { src: string; alt: string };

// A card's title as a button that opens its details in a side panel (RAA-126). Its ::after
// covers the card, so a click anywhere on it opens the panel; controls of the card's own that
// should still work (photo arrows, Add to trip) sit above it with `relative z-10`. The panel is
// put on the body, clear of the card's clipping, glass colours and hover styles, and only while
// open; React context (TripAddProvider) still reaches it.
export function DetailPanelButton({
  title,
  media,
  panel,
  actions,
  children,
  className,
  "data-testid": testId,
}: {
  title: string;
  media?: ReactNode;
  panel: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  "data-testid"?: string;
}) {
  const [open, setOpen] = useState(false);
  // A link inside it to a row on the page (#listing-<id>: a place's "Go there with") closes it, so
  // the row it scrolls to is in view.
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("hashchange", close);
    return () => window.removeEventListener("hashchange", close);
  }, [open]);
  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        data-testid={testId}
        onClick={() => setOpen(true)}
        className={cn(
          "cursor-pointer text-left outline-none after:absolute after:inset-0 after:rounded-card after:content-[''] focus-visible:after:outline-2 focus-visible:after:-outline-offset-4 focus-visible:after:outline-(--focus)",
          className,
        )}
      >
        {children}
      </button>
      {open &&
        createPortal(
          <Dialog open placement="side" title={title} media={media} onClose={() => setOpen(false)} actions={actions} data-testid="detail-panel">
            {panel}
          </Dialog>,
          document.body,
        )}
    </>
  );
}

function PanelSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

// A side panel's single photo, above its title, saying so when it is a stand-in. A place with
// no photo that fits it gets its icon on navy, as its card does; a listing with none of its own,
// its category's (`icon`).
export function PanelPhoto({ photo, icon }: { photo: Photo | null; icon?: ReactNode }) {
  return (
    <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-card bg-navy text-sky-mist/50">
      {photo ? (
        <>
          <Image src={photo.src} alt={photo.alt} fill unoptimized={isApiPhoto(photo.src)} sizes="28rem" className="object-cover" />
          {!isApiPhoto(photo.src) && <SamplePhotoTag className="absolute left-3 top-3" />}
        </>
      ) : (
        (icon ?? <PlaceGlyph className="size-12" />)
      )}
    </div>
  );
}

// A place to see, whole, under its photo and name: every tag, the full description and the
// listings on the page that go there, each a link down to its row in What to book, which closes
// the panel (DetailPanelButton) and shows the row whatever section is picked.
export function LandmarkPanel({
  landmark,
  areaName,
}: {
  landmark: { description: string; tags: { slug: string; name: string }[]; visits?: { id: number; title: string; href: string }[] };
  areaName: string;
}) {
  const rowLink = useRowLink();
  return (
    <>
      <p className="text-sm text-muted">Place to see · {areaName}</p>
      {landmark.tags.length > 0 && (
        <ul aria-label="Tags" className="flex flex-wrap gap-1.5">
          {landmark.tags.map((tag) => (
            <li key={tag.slug}>
              <Badge tone="mist" className="min-h-7 px-2.5 text-xs">
                <TagGlyph slug={tag.slug} className="size-3.5" />
                {tag.name}
              </Badge>
            </li>
          ))}
        </ul>
      )}
      {landmark.description.trim() && (
        <PanelSection title="About">
          <p className="text-sm break-words whitespace-pre-line">{landmark.description}</p>
        </PanelSection>
      )}
      {landmark.visits && landmark.visits.length > 0 && (
        <PanelSection title="Go there with">
          <ul className="flex flex-col gap-2">
            {landmark.visits.map((visit) => (
              <li key={visit.id}>
                <a
                  {...rowLink(visit.id)}
                  className="flex min-h-11 items-center text-sm font-semibold text-link underline-offset-4 hover:underline"
                >
                  {visit.title}
                  <ChevronGlyph aria-hidden className="ml-1 size-4" />
                </a>
              </li>
            ))}
          </ul>
        </PanelSection>
      )}
    </>
  );
}
