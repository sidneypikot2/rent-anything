"use client";

import Link from "next/link";
import { useState } from "react";
import { GROUP_ICON, TRIP_ORDER_GROUPS, type BookingGroup } from "@/components/discovery/categories";
import { CategoryGlyph, PlusGlyph, TickGlyph } from "@/components/discovery/tag-glyphs";
import { cn } from "@/components/ui/cn";
import { formatDateRange } from "@/lib/dates";
import { planGaps, stillMissing, type PlanGap } from "./trip-missing";
import type { Trip } from "./use-trips";

// The kinds a trip is checked for, in the order it needs them (getting there first): transfer,
// stay, getting around, tours, gear — all five count (2026-10-28, until the team decides
// otherwise). One checklist wherever a trip is summed up on a photo: the home hero's trip card,
// a place's trip card and the add toast.
export const TRIP_KINDS = TRIP_ORDER_GROUPS;

// `note`: what is still open on a kind the trip already has some of — a stay that doesn't cover
// every night says which ("Oct 31 – Dec 10"), so the chip never reads as wrong beside two stays.
type Need = { kind: BookingGroup; done: boolean; note?: string };

// One kind on the trip band's dark glass: ticked once the trip has it (it pops once as it turns
// done), or a dashed link with the kind's icon and a plus while it lacks it, to where it can be
// added. The same chip on the home card and a place's.
export function KindChip({
  kind,
  done,
  href,
  note,
  popped = false,
}: {
  kind: BookingGroup;
  done: boolean;
  href: string;
  note?: string;
  popped?: boolean;
}) {
  if (done)
    return (
      <span
        data-testid={`trip-need-${kind.group}`}
        data-done
        className={cn(
          "inline-flex min-h-8 items-center gap-1.5 rounded-full bg-white/15 px-3 text-small font-semibold text-white",
          popped && "animate-tick",
        )}
      >
        <TickGlyph aria-hidden className="size-3.5 text-mint" />
        {kind.short}
        <span className="sr-only">: in your trip</span>
      </span>
    );
  const label = (
    <>
      <CategoryGlyph name={kind.icon} className={cn("size-3.5", GROUP_ICON[kind.group])} />
      {kind.short}
      {note && <span className="font-medium text-sky-mist">{note}</span>}
      <PlusGlyph aria-hidden className="size-3 opacity-70" />
    </>
  );
  const className =
    "tap-target inline-flex min-h-8 items-center gap-1.5 rounded-full border border-dashed border-sky-pale/60 px-3 text-small font-semibold text-sky-pale transition-colors duration-300 ease-calm hover:border-white hover:bg-white/10 hover:text-white";
  const aria = `Add ${(kind.need ?? kind.short).toLowerCase()}${note ? ` for ${note}` : ""} to your trip`;
  // An anchor on this page scrolls; anything else is a page to open.
  return href.startsWith("#") ? (
    <a href={href} aria-label={aria} data-testid={`trip-need-${kind.group}`} className={className}>
      {label}
    </a>
  ) : (
    <Link href={href} aria-label={aria} data-testid={`trip-need-${kind.group}`} className={className}>
      {label}
    </Link>
  );
}

// "Still to add: 2 of 4" over the chips, or that everything is in.
export function kindsLine(needs: { done: boolean }[]) {
  const left = needs.filter((need) => !need.done).length;
  return left === 0 ? "Everything a trip needs is in." : `Still to add: ${left} of ${needs.length}`;
}

// The checklist on a place's page (its trip card), for the kinds the place offers, from the
// plan's own gaps (planGaps), so its "N of 5" and the plan's count are one number: a stay for
// every night ahead, and a transfer, getting around, tours and gear anywhere on the island
// (`island`). Each lacking one links to its section of What to book.
export function TripNeeds({
  trip,
  places,
  offered,
  island,
  since,
  className,
}: {
  trip: Trip;
  places: string[];
  offered: string[];
  island?: string | null;
  // The trip before an add (null for a trip the add started), so a fresh toast pops what it covered.
  since?: Trip | null;
  className?: string;
}) {
  const needs = needsOf(trip, places, offered, island);
  // The ones that just turned done, for their pop: compared with the last render's, or `since`.
  const doneNow = doneOf(needs);
  const [seen, setSeen] = useState(() =>
    since === undefined ? doneNow : since === null ? "" : doneOf(needsOf(since, places, offered, island)),
  );
  const [popped, setPopped] = useState<string[]>([]);
  if (doneNow !== seen) {
    const before = seen.split(" ");
    setPopped(doneNow.split(" ").filter((kind) => kind && !before.includes(kind)));
    setSeen(doneNow);
  }
  if (needs.length === 0) return null;
  return (
    <div className={cn("flex flex-col gap-2", className)} data-testid="trip-needs">
      <p className="text-sm text-sky-mist">{kindsLine(needs)}</p>
      <ul aria-label="What your trip needs here" className="flex flex-wrap items-center gap-1.5">
        {needs.map((need) => (
          <li key={need.kind.group}>
            <KindChip
              kind={need.kind}
              done={need.done}
              href={needAnchor(need.kind)}
              note={need.note}
              popped={popped.includes(need.kind.group)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function doneOf(needs: Need[]) {
  return needs.filter((need) => need.done).map((need) => need.kind.group).join(" ");
}

// Where a kind's chip goes: What to book's section for it (the stay and transfer sections'
// own anchors, as the plan's rows use).
function needAnchor(kind: BookingGroup) {
  if (kind.group === "stay") return "#need-stay";
  if (kind.group === "transfer") return "#need-transfer";
  return `#${kind.id}`;
}

function needsOf(trip: Trip, places: string[], offered: string[], island?: string | null): Need[] {
  const gaps = stillMissing(planGaps(trip, places, offered, [], island));
  const stays = gaps.filter((gap): gap is Extract<PlanGap, { kind: "stay" }> => gap.kind === "stay");
  const hasStay = trip.items.some((item) => item.booking_type === "stay" && !item.unavailable);
  return TRIP_KINDS.filter((kind) => offered.includes(kind.group)).map((kind) => {
    if (kind.group === "stay") return { kind, done: stays.length === 0, note: hasStay ? stayNote(stays) : undefined };
    return { kind, done: !gaps.some((gap) => gap.kind === "need" && gap.group === kind.group) };
  });
}

// The nights a trip with stays still has open: one run by its dates ("Oct 31 – Dec 10", or "2
// more beds" when a stay sleeps too few), several by their nights ("12 nights").
function stayNote(stays: Extract<PlanGap, { kind: "stay" }>[]) {
  if (stays.length === 0) return undefined;
  if (stays.length === 1) {
    const [gap] = stays;
    if (gap.short) return `${gap.short} more ${gap.short === 1 ? "bed" : "beds"}`;
    return formatDateRange(gap.from, gap.to) ?? undefined;
  }
  const nights = stays.reduce((sum, gap) => sum + gap.nights, 0);
  return `${nights} nights`;
}
