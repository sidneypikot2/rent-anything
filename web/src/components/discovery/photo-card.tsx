"use client";

import Image from "next/image";
import { useId, useState, type ComponentProps, type ReactNode } from "react";
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

// The one photo card (RAA-126): a fixed height, so cards in a grid line up whatever they hold.
// At rest the glass shows `head` (a title and one line) and `foot` (a count, a price, an
// action); `details` stay folded under the head until the card's info button opens
// them, or keyboard focus moves inside it; hovering doesn't. Folded details stay in the page, so a screen reader
// and a search still find them. `badge` sits in the top-left corner; `glassClassName` places
// the glass (the lead destination's stands at the right).
// The title's link should stretch over the card (`STRETCHED_LINK`), so the whole card opens it.
export function PhotoCardFrame({
  photo,
  sizes = "(min-width: 640px) 50vw, 100vw",
  badge,
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
  photo: Photo;
  sizes?: string;
  badge?: ReactNode;
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
  const id = useId();
  return (
    <Card
      bordered={false}
      data-open={open || undefined}
      className={cn(PHOTO_CARD, "flex flex-col justify-end p-3", height, className)}
      {...props}
    >
      <Image src={photo.src} alt={photo.alt} fill unoptimized={isApiPhoto(photo.src)} sizes={sizes} className={PHOTO_CARD_IMAGE} />
      <div aria-hidden className={cn(PHOTO_SCRIM, scrimClassName)} />
      {badge && <div className="absolute left-3 top-3">{badge}</div>}
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
    </Card>
  );
}
