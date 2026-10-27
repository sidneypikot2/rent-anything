"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/components/ui/cn";
import type { Feature } from "./listing-features";
import { FeatureGlyph } from "./tag-glyphs";
import { useFitRows } from "./use-fit-rows";

const ROWS = 2;

// A ListingRow's summary and chips, trimmed so every row is one height (RAA-126): the summary
// keeps to one line and the chips for what the listing includes to two rows, the last place
// there taken by "+N more" when they don't all fit; the listing's page has the rest.
// Cancellation leads, so a trust point is never the chip left out. Clipped chips stay in the
// page for a screen reader (out of the flow, so none shows after it); "+N more" is only a hint
// for the eye.
export function ListingRowDetails({ summary, features }: { summary?: string | null; features: Feature[] }) {
  const chips = [...features].sort((a, b) => Number(!!b.trust) - Number(!!a.trust));
  const { list, more, shown, hidden } = useFitRows<HTMLUListElement, HTMLLIElement>(ROWS, chips.length);

  if (!summary && chips.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {/* A phone-wide row leaves the summary to the details, to keep to name, place, chips and price. */}
      {summary && <p className="line-clamp-1 text-sm text-foreground @max-sm:hidden">{summary}</p>}
      {chips.length > 0 && (
        <ul
          ref={list}
          aria-label="Includes"
          // Two 28px rows and the gap between them.
          className="relative flex max-h-[3.875rem] flex-wrap gap-1.5 overflow-hidden"
        >
          {chips.flatMap((feature, index) => [
            ...(index === shown && hidden > 0 ? [
              <li key="more" ref={more} aria-hidden>
                <Badge tone="mist" className="min-h-7 px-2.5 text-xs">
                  +{hidden} more
                </Badge>
              </li>,
            ] : []),
            // Past "+N more" a chip leaves the flow, so a short one can't show after it on its row.
            <li key={feature.label} className={cn(shown !== null && hidden > 0 && index >= shown && "sr-only")}>
              <Badge tone={feature.trust ? "emerald" : "fact"} className="min-h-7 px-2.5 text-xs">
                <FeatureGlyph name={feature.icon} className={cn("size-3.5", !feature.trust && "text-primary")} />
                {feature.label}
              </Badge>
            </li>,
          ])}
        </ul>
      )}
    </div>
  );
}
