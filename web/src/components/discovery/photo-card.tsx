"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { isApiPhoto } from "@/components/landing/sample-photos";
import { Card } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { GlassPanel } from "@/components/ui/glass";
import { PHOTO_CARD, PHOTO_CARD_IMAGE, PHOTO_SCRIM } from "./photo-card-styles";
import { InfoGlyph } from "./tag-glyphs";

// Opened by keyboard focus inside the card or the info button, never by hover (RAA-126), so
// a pointer passing over a grid doesn't set cards opening and closing.
const OPENS = "group-has-focus-visible:grid-rows-[1fr] group-data-open:grid-rows-[1fr]";

export type Photo = { src: string; alt: string };

// Said on a stand-in photo, where a guest sees it rather than only in its alt text, so a
// sample shot never passes for the place itself.
export function SamplePhotoTag({ className }: { className?: string }) {
  return <span className={cn("rounded-full bg-scrim/60 px-2 py-0.5 text-xs text-white", className)}>Sample photo</span>;
}

// How long a photo may take before its card lays out without it: storage can hang rather than fail.
const PHOTO_TIMEOUT = 8000;

// The one photo card (RAA-126): a fixed height, so cards in a grid line up whatever they hold.
// At rest the glass shows `head` (a title and one line) and `foot` (a count, a price, an
// action); `details` stay folded under the head until the card's info button opens
// them, or keyboard focus moves inside it; hovering doesn't. Folded details stay in the page, so a screen reader
// and a search still find them. `badge` sits in the top-left corner and `corner`, a control
// above the title's stretched button, in the top-right one (a card without details, whose info
// button sits there); `glassClassName` places
// the glass (the lead destination's is a panel at its foot, on the left).
// The title's link should stretch over the card (`STRETCHED_LINK`), so the whole card opens it.
// `placeholder` sits on the navy under the photo while it loads, and stays if the photo fails
// or storage never answers, so a card never shows a bare slab — nor another thing's photo.
// No `photo` at all (a listing without one of its own) is missing from the start.
// A photo still loading after PHOTO_TIMEOUT counts as missing: the card says so with
// `data-photo-missing`, so a caller can lay it out without the photo (a listing's card becomes
// a row), and takes the photo back if it arrives after all.
export function PhotoCardFrame({
  photo,
  placeholder,
  photoClassName,
  sizes = "(min-width: 640px) 50vw, 100vw",
  badge,
  corner,
  head,
  details,
  foot,
  label,
  height = "h-80",
  scrimClassName,
  glassClassName,
  className,
  ...props
}: {
  photo?: Photo;
  placeholder?: ReactNode;
  // Places the photo and the placeholder (a listing's row on a phone keeps them to a column).
  photoClassName?: string;
  sizes?: string;
  badge?: ReactNode;
  corner?: ReactNode;
  head: ReactNode;
  details?: ReactNode;
  foot?: ReactNode;
  // What the card is, for the info button's name ("Details of Kota Beach").
  label: string;
  // The card's height: fixed, so a grid's cards match. The lead destination's is a minimum, as
  // the home grid stretches it over two rows.
  height?: string;
  scrimClassName?: string;
  glassClassName?: string;
  className?: string;
} & Omit<ComponentProps<"div">, "children">) {
  const [open, setOpen] = useState(false);
  const [photoState, setPhotoState] = useState<"loading" | "loaded" | "missing">(photo ? "loading" : "missing");
  const failed = photoState === "missing";
  const id = useId();
  const src = photo?.src;
  const cardRef = useRef<HTMLDivElement>(null);
  // The wait starts once the card nears the screen: the photo loads lazily, so a card further
  // down hasn't asked for it yet, and hiding it then would stop it ever loading.
  useEffect(() => {
    const card = cardRef.current;
    if (!src || !card) return;
    let timer: number | undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        timer = window.setTimeout(() => setPhotoState((state) => (state === "loading" ? "missing" : state)), PHOTO_TIMEOUT);
      },
      { rootMargin: "200px" },
    );
    observer.observe(card);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, [src]);
  return (
    <Card
      ref={cardRef}
      bordered={false}
      photo
      data-open={open || undefined}
      data-photo-missing={failed || undefined}
      className={cn(PHOTO_CARD, "flex flex-col justify-end p-3", height, className)}
      {...props}
    >
      {placeholder && (
        <div
          aria-hidden
          className={cn("absolute inset-x-0 top-0 -z-30 flex h-1/2 items-center justify-center text-sky-mist/50", photoClassName)}
        >
          {placeholder}
        </div>
      )}
      {/* Kept mounted while missing on a timeout, so a slow photo can still arrive; an error drops it. */}
      {photo && (
        <Image
          src={photo.src}
          alt={photo.alt}
          fill
          unoptimized={isApiPhoto(photo.src)}
          sizes={sizes}
          onLoad={() => setPhotoState("loaded")}
          onError={() => setPhotoState("missing")}
          className={cn(PHOTO_CARD_IMAGE, photoClassName, failed && "hidden")}
        />
      )}
      <div aria-hidden className={cn(PHOTO_SCRIM, scrimClassName)} />
      {/* With a corner control the badge shares its row, level with it; on a card too narrow for
          both it drops below (wrap-reverse), rather than running under the control. */}
      {corner && !details ? (
        <div className="pointer-events-none absolute inset-x-3 top-3 z-20 flex flex-wrap-reverse items-center justify-between gap-2">
          {badge}
          <div className="pointer-events-auto ml-auto shrink-0">{corner}</div>
        </div>
      ) : (
        badge && <div className="absolute left-3 top-3">{badge}</div>
      )}
      <GlassPanel tone="card" className={cn("flex max-h-full flex-col gap-3 overflow-hidden rounded-control p-5", glassClassName)}>
        <div className="min-w-0">{head}</div>
        {details && (
          <div id={id} className={cn("-mt-3 grid grid-rows-[0fr] transition-[grid-template-rows] duration-300 ease-calm", OPENS)}>
            <div className="min-h-0 overflow-hidden">
              <div className="flex flex-col gap-3 pt-3">{details}</div>
            </div>
          </div>
        )}
        {foot}
      </GlassPanel>
      {/* After the glass in the page, so the keyboard reaches the title before its details
          button; it is placed in the corner, so where it sits in the page doesn't show. */}
      {details && (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          aria-label={`Details of ${label}`}
          onClick={() => setOpen((was) => !was)}
          // Above the title's stretched link, so a tap here opens the details rather than the page.
          className="focus-light absolute right-3 top-3 z-20 flex size-11 items-center justify-center rounded-full border border-glass-edge bg-navy/45 text-white transition-colors duration-300 ease-calm hover:bg-navy/70 aria-expanded:bg-primary"
        >
          <InfoGlyph className="size-5" />
        </button>
      )}
    </Card>
  );
}
