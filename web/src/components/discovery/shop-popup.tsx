"use client";

import { Dialog } from "@/components/ui/dialog";
import type { TripDates } from "@/components/trips/trip-dates";
import { useShopModels } from "./shop-models";

type Props = {
  business: { id: number; name: string };
  category: { slug: string; name: string };
  area: string;
  dates: TripDates;
  // The trip's people, to compare the seats picked with.
  people: number;
  onClose: () => void;
};

// A shop's models in a pop-up (RAA-191, the plan's mock 2), opened from a vehicle's "More from this
// shop": the shop's name and initials over its models (useShopModels).
export function ShopPopup({ business, category, area, dates, people, onClose }: Props) {
  const { body, summary, action } = useShopModels({ business, category, dates, people, onAdding: onClose });
  const initials = business.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");

  return (
    <Dialog
      open
      onClose={onClose}
      placement="sheet"
      title={business.name}
      meta={`${category.name} rental · ${area}`}
      thumb={
        <span aria-hidden className="absolute inset-0 flex items-center justify-center bg-action-tint text-lg font-bold text-action-ink">
          {initials}
        </span>
      }
      summary={summary}
      actions={action}
      data-testid="shop-popup"
    >
      {body}
    </Dialog>
  );
}
