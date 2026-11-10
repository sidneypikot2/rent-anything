"use client";

import Link from "next/link";
import { useState } from "react";
import { useTripHref } from "@/components/trips/trip-link";
import type { TripDates } from "@/components/trips/trip-dates";
import { Section } from "@/components/ui/section";
import { BusinessOptions, type Offer } from "./business-row";
import { ArrowGlyph } from "./tag-glyphs";

export type MoreGroup = {
  id: string;
  title: string;
  short: string;
  offers: Offer[];
  shop?: { businessId: number; counted: boolean };
};

// The rest of a listing's business under its page (the listing sheet's "More from"), as the
// shop page lists its options: grouped rows, each with its price and Add to trip. From lg a chip
// row picks one kind at a time (the booking rail layout); a phone shows every group in turn.
// Each group shows its first few, then See all, to that group on the shop page.
const SHOWN = 4;
export function MoreFromBusiness({
  name,
  href,
  groups,
  dates,
}: {
  name: string;
  // The business's own page, with a query (`?place=`), so `&show=` can follow.
  href: string;
  groups: MoreGroup[];
  dates: TripDates;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const tripHref = useTripHref();
  const count = groups.reduce((sum, group) => sum + group.offers.length, 0);
  if (count === 0) return null;
  const kinds = groups.map((group) => group.short.toLowerCase());

  return (
    <Section
      id="more"
      testId="listing-more"
      title={`More from ${name}`}
      intro={`${count} more to book: ${kinds.join(", ")}`}
      action={
        <Link href={tripHref(href)} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-link underline-offset-4 hover:underline">
          See the whole shop <ArrowGlyph className="size-4" />
        </Link>
      }
      className="max-sm:px-3"
    >
      {groups.length > 1 && (
        <div role="group" aria-label="Kinds" className="flex gap-2 overflow-x-auto pb-0.5 max-lg:hidden">
          {[{ id: null, label: "All" }, ...groups.map((group) => ({ id: group.id, label: group.title }))].map((chip) => (
            <button
              key={chip.label}
              type="button"
              aria-pressed={picked === chip.id}
              onClick={() => setPicked(chip.id)}
              className="min-h-11 shrink-0 rounded-chip border border-line bg-surface px-4 text-sm font-semibold transition-colors duration-300 ease-calm hover:border-line-strong aria-pressed:border-navy aria-pressed:bg-navy aria-pressed:text-white"
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}
      {groups.map((group) => (
        <div key={group.id} className={picked && picked !== group.id ? "lg:hidden" : undefined}>
          <div className="flex flex-col gap-3">
            {groups.length > 1 && <h3 className="text-sm font-semibold text-muted">{group.title}</h3>}
            <BusinessOptions name={name} groupTitle={group.title} offers={group.offers.slice(0, SHOWN)} dates={dates} shop={group.shop} />
            {group.offers.length > SHOWN && (
              <Link
                href={tripHref(`${href}&show=${group.id}`)}
                className="inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-semibold text-link underline-offset-4 hover:underline"
              >
                See all {group.offers.length} <ArrowGlyph className="size-4" />
              </Link>
            )}
          </div>
        </div>
      ))}
    </Section>
  );
}
