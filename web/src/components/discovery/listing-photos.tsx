"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { isApiPhoto } from "@/components/landing/sample-photos";
import { cn } from "@/components/ui/cn";
import { ArrowGlyph, CategoryGlyph } from "./tag-glyphs";

type Photo = { src: string; alt: string };

// A listing's photos on its row (RAA-125): swiped on a phone, stepped with the arrows with a
// mouse (they show on hover or focus), with dots and an "n / N" count. One photo is just the
// photo. Scroll snapping does the moving, so it stays smooth and keyboard scrolling works too.
// A listing with no photos of its own shows its category's icon, never a stand-in photo, which
// would show it as something it isn't (web-ui.md).
export function ListingPhotos({ photos, label, category, count = "top", className }: {
  photos: Photo[];
  label: string;
  category: string;
  // Where "n / N" sits: "bottom" keeps the top right clear for a side panel's close button.
  count?: "top" | "bottom";
  className?: string;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const many = photos.length > 1;

  const step = (by: number) => {
    const el = track.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: by * el.clientWidth, behavior: reduce ? "auto" : "smooth" });
  };

  if (photos.length === 0)
    return (
      <div className={cn("flex flex-col items-center justify-center gap-2 rounded-card bg-mist text-primary", className)}>
        <CategoryGlyph name={category} className="size-10 opacity-70" />
        <span className="text-small font-semibold text-muted">No photos yet</span>
      </div>
    );

  return (
    <div
      role={many ? "group" : undefined}
      aria-roledescription={many ? "carousel" : undefined}
      aria-label={many ? `Photos of ${label}` : undefined}
      className={cn("group/photos relative isolate overflow-hidden rounded-card bg-mist", className)}
    >
      <div
        ref={track}
        onScroll={(event) => {
          const el = event.currentTarget;
          setIndex(Math.min(photos.length - 1, Math.round(el.scrollLeft / Math.max(1, el.clientWidth))));
        }}
        className="flex h-full snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {photos.map((photo, i) => (
          <div key={photo.src + i} className="relative h-full w-full shrink-0 snap-start">
            <Image
              src={photo.src}
              alt={many ? `${photo.alt} (${i + 1} of ${photos.length})` : photo.alt}
              fill
              unoptimized={isApiPhoto(photo.src)}
              sizes="(min-width: 768px) 19rem, 100vw"
              className="object-cover"
            />
          </div>
        ))}
      </div>
      {many && (
        <>
          <span className={cn("absolute right-2.5 rounded-full bg-scrim/60 px-2 py-0.5 text-xs font-bold tabular-nums text-white", count === "top" ? "top-2.5" : "bottom-2.5")}>
            {index + 1} / {photos.length}
          </span>
          <PhotoStep direction="left" hidden={index === 0} onClick={() => step(-1)} />
          <PhotoStep direction="right" hidden={index === photos.length - 1} onClick={() => step(1)} />
          <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-2.5 flex justify-center gap-1.5">
            {photos.map((photo, i) => (
              <i
                key={photo.src + i}
                className={cn(
                  "h-1.5 rounded-full transition-[width,background-color] duration-300 ease-calm",
                  i === index ? "w-4 bg-white" : "w-1.5 bg-white/55",
                )}
              />
            ))}
          </span>
        </>
      )}
    </div>
  );
}

// A 44px target round a smaller white disc, so the arrow doesn't cover the photo.
function PhotoStep({ direction, hidden, onClick }: { direction: "left" | "right"; hidden: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={hidden}
      aria-label={direction === "left" ? "Previous photo" : "Next photo"}
      className={cn(
        "absolute top-1/2 flex size-11 -translate-y-1/2 items-center justify-center disabled:pointer-events-none",
        direction === "left" ? "left-1" : "right-1",
      )}
    >
      <span
        className={cn(
          "flex size-8 items-center justify-center rounded-full bg-white/90 text-navy shadow-soft transition-opacity duration-300 ease-calm",
          hidden ? "opacity-0" : "pointer-fine:opacity-0 pointer-fine:group-hover/photos:opacity-100 pointer-fine:group-focus-within/photos:opacity-100",
        )}
      >
        <ArrowGlyph direction={direction} className="size-4" />
      </span>
    </button>
  );
}
