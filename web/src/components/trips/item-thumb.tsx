"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";
import { CategoryGlyph } from "@/components/discovery/tag-glyphs";
import { isApiPhoto } from "@/components/landing/sample-photos";
import { cn } from "@/components/ui/cn";
import type { TripItem } from "./use-trips";

const SIZES = {
  // The cart's cards and a place's "things here" sheet.
  md: { box: "size-16", icon: "size-7", px: 128 },
  // A line in the trip's plan, the size of a row's icon well.
  sm: { box: "size-11", icon: "size-5", px: 88 },
};

// The icon for a kind of thing, for an item whose listing's category isn't sent (a shared trip).
const KIND_GLYPH: Record<TripItem["booking_type"], string> = {
  stay: "Hotel or cottage",
  activity: "Tour",
  rental: "Motorcycle",
  transfer: "Van transfer",
};

type ThumbItem = Pick<TripItem, "booking_type"> & {
  listing: Pick<TripItem["listing"], "cover_photo_url"> & { category?: string };
};

// A trip item's listing at a glance, wherever a trip lists its items: its cover photo, or its
// category icon in a mist well when it has none or the photo fails, never a stand-in that would
// show it as something it isn't. Decorative: the title beside it names the listing. `badge` sits
// on its corner (the plan's tick for a confirmed booking, a warning for one that can't be had).
export function ItemThumb({ item, size = "md", badge }: { item: ThumbItem; size?: keyof typeof SIZES; badge?: ReactNode }) {
  const photo = item.listing.cover_photo_url;
  const [failed, setFailed] = useState(false);
  const { box, icon, px } = SIZES[size];
  return (
    <div className={cn("relative shrink-0", box)}>
      <div className="size-full overflow-hidden rounded-control bg-mist">
        {photo && !failed ? (
          <Image
            src={photo}
            alt=""
            width={px}
            height={px}
            unoptimized={isApiPhoto(photo)}
            onError={() => setFailed(true)}
            className="size-full object-cover"
          />
        ) : (
          <span className="flex size-full items-center justify-center text-primary">
            <CategoryGlyph name={item.listing.category ?? KIND_GLYPH[item.booking_type]} className={icon} />
          </span>
        )}
      </div>
      {badge && (
        <span aria-hidden className="absolute -right-1.5 -bottom-1.5 grid size-5 place-items-center rounded-full bg-surface shadow-soft">
          {badge}
        </span>
      )}
    </div>
  );
}
