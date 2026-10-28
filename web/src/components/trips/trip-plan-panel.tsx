"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BOOKING_GROUPS } from "@/components/discovery/categories";
import { AlertGlyph, CalendarGlyph, CategoryGlyph, TickGlyph } from "@/components/discovery/tag-glyphs";
import { cn } from "@/components/ui/cn";
import { GETTING_HERE, tripHref } from "@/components/landing/launch-area";
import { Dialog } from "@/components/ui/dialog";
import { formatDateRange, localTodayIso } from "@/lib/dates";
import { guestCount, guestsLabel } from "./format";
import { ItemEditSheet } from "./item-edit-sheet";
import { ItemThumb } from "./item-thumb";
import { closePlan, setPlanSummary, usePlanOpen } from "./plan-open";
import { isIdea, missingCount, PLAN_NEEDS, planGaps, stillMissing, type PlanGap, type Sight } from "./trip-missing";
import { GettingHereCard, Ideas, jumpTo, LINK, PlanDays } from "./trip-plan-days";
import { tripPlan } from "./trip-plan";
import type { Trip, TripItem } from "./use-trips";

// The trip's guide on a place's page, one panel with three ways in (plan-open.ts): the phone's
// trip row, the first chip of What to book (the rail's first entry from lg) and the wide trip
// card, each with the count of what is missing (missingCount: the same as the banner's), never
// the ideas (a ride, things to do). From the bottom on a phone, beside the page from sm (Dialog
// "drawer"), each row with its way to sort it — a section of What to book, an item's dates
// (ItemEditSheet), a place to see. A dated trip shows it day by day (tripPlan, PlanDays):
// Getting here first, what runs through the whole trip, each day with what's on it and what it
// lacks, and Going home last. An undated one lists the gaps, then the kinds it already has here,
// ticked, and the ideas last. A guide, never a step to finish: nothing on the page waits on it.
// The warning colour only when an item can't be booked as it is.
export function TripPlan({
  trip,
  places,
  island,
  offered,
  sights,
  placeName,
}: {
  trip: Trip;
  places: string[];
  island?: string | null;
  offered: string[];
  sights: Sight[];
  placeName: string;
}) {
  const open = usePlanOpen();
  const [dating, setDating] = useState<TripItem | null>(null);
  const gaps = planGaps(trip, places, offered, sights, island);
  const missing = stillMissing(gaps);
  const count = missingCount(gaps);
  const problem = gaps.some((gap) => gap.kind === "unavailable");
  // The ways in show the count while this trip is on the page, and go once it isn't.
  useEffect(() => {
    setPlanSummary({ missing: count, problem });
  }, [count, problem]);
  useEffect(() => () => {
    setPlanSummary(null);
    closePlan();
  }, []);
  // A row's action closes the panel first, so what it opens or scrolls to is in view.
  const then = (action: () => void) => () => {
    closePlan();
    action();
  };
  const has = new Set(
    trip.items.filter((item) => places.includes(item.area.slug) && !item.unavailable).map((item) => item.listing.group),
  );
  const covered = BOOKING_GROUPS.filter(
    (group) => group.need && offered.includes(group.group) && has.has(group.group) && !(group.group === "stay" && gaps.some((gap) => gap.kind === "stay")),
  );
  const range = formatDateRange(trip.starts_on, trip.ends_on);
  // The traveller's own day, not UTC's: in Manila yesterday is done from midnight.
  const plan = tripPlan(trip, gaps, localTodayIso());
  const gettingHere = places.map((slug) => GETTING_HERE[slug]).find(Boolean);
  const row = (gap: PlanGap) => <GapRow key={gapKey(gap)} gap={gap} guests={trip.guests} then={then} onDate={setDating} />;
  return (
    <>
      {/* A modal <dialog> sits in the top layer, so the banner's glass doesn't hold it. */}
      <Dialog open={open} onClose={closePlan} placement="drawer" title="Your plan" data-testid="trip-plan">
        <p className="text-sm text-pretty text-muted">
          {/* An auto-named trip ("Bantayan Island · Nov 10–14") says its dates once. */}
          {[
            trip.name,
            range && trip.name.includes(range) ? null : (range ?? "No dates yet"),
            plan && `${plan.days.length} ${plan.days.length === 1 ? "day" : "days"}`,
            guestsLabel(trip.guests),
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {missing.length > 0 ? (
          <p className="text-sm text-pretty" data-testid="trip-plan-left">
            <span className="font-semibold">Still missing in {placeName}:</span> {listShort(missing.map(gapShort))}
          </p>
        ) : (
          <p className="text-sm">Nothing missing here. The rest is up to you.</p>
        )}
        {plan ? (
          <PlanDays
            plan={plan}
            tripHref={tripHref(trip.id)}
            places={places}
            gettingHere={gettingHere}
            hasSights={sights.length > 0}
            row={row}
            then={then}
          />
        ) : (
          <>
            {gettingHere && <GettingHereCard {...gettingHere} onFind={has.has("transfer") ? undefined : then(() => jumpTo("#need-transfer"))} done={has.has("transfer")} />}
            <Link href={tripHref(trip.id)} className={cn(LINK, "self-start text-sm")}>
              Set your trip&apos;s dates to see it day by day
            </Link>
            {missing.length > 0 && <ul className="flex flex-col gap-2">{missing.map(row)}</ul>}
            {covered.length > 0 && (
              <ul aria-label="In your trip" className="flex flex-col gap-1 border-t border-line pt-3">
                {covered.map((group) => (
                  <li key={group.group} className="flex min-h-11 items-center gap-3 px-3 text-sm text-muted">
                    <span aria-hidden className="grid size-6 shrink-0 place-items-center rounded-full bg-mint/25 text-forest">
                      <TickGlyph className="size-3.5" />
                    </span>
                    <span>
                      <span className="font-semibold text-foreground">{group.need}</span> · in your trip
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Ideas ideas={gaps.filter(isIdea)} row={row} />
          </>
        )}
      </Dialog>
      {dating && <ItemEditSheet trip={trip} item={dating} onClose={() => setDating(null)} onSaved={() => setDating(null)} />}
    </>
  );
}

const sectionOf = (group: string) => `#${BOOKING_GROUPS.find((each) => each.group === group)?.id ?? "listings"}`;

// A missing kind's way into its section of What to book, and what it is.
const NEED_ACTION: Record<(typeof PLAN_NEEDS)[number], string> = {
  transfer: "Find a transfer",
  rental: "Find a ride",
  activity: "Find things to do",
  gear: "Find gear",
};
const NEED_LINE: Record<(typeof PLAN_NEEDS)[number], string> = {
  transfer: "From the port or airport to where you stay.",
  rental: "A scooter or trike to get around.",
  activity: "Tours and things to do while you're here.",
  gear: "A camera, snorkel set or other gear for your days here.",
};
const needName = (group: string) => {
  const kind = BOOKING_GROUPS.find((each) => each.group === group);
  return kind?.need ?? kind?.title ?? group;
};

// One thing the trip still lacks, with its way to sort it.
function GapRow({
  gap,
  guests,
  then,
  onDate,
}: {
  gap: PlanGap;
  guests: number;
  then: (action: () => void) => () => void;
  onDate: (item: TripItem) => void;
}) {
  // A gap about one item shows that item, its kind of trouble on the corner; the rest an icon.
  const thumb =
    gap.kind === "unavailable" ? (
      <ItemThumb item={gap.item} size="sm" badge={<AlertGlyph className="size-3.5 text-warning" />} />
    ) : gap.kind === "undated" ? (
      <ItemThumb item={gap.item} size="sm" badge={<CalendarGlyph className="size-3 text-primary" />} />
    ) : gap.kind === "tour-guests" ? (
      <ItemThumb item={gap.item} size="sm" />
    ) : null;
  const icon = (
      <CategoryGlyph
        name={
          gap.kind === "need"
            ? BOOKING_GROUPS.find((each) => each.group === gap.group)!.icon
            : gap.kind === "stay"
              ? "Hotel or cottage"
              : "Tour"
        }
        className="size-5"
      />
    );
  return (
    <li className="flex gap-3 rounded-control border border-line p-3" data-testid="trip-plan-gap">
      {thumb ?? (
        <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-xl bg-mist text-primary">
          {icon}
        </span>
      )}
      <div className="flex min-w-0 flex-col items-start gap-0.5 text-sm">
        <GapText gap={gap} guests={guests} />
        {/* gap-y-3 keeps wrapped links' 44px hit areas apart. */}
        <span className="mt-1 flex flex-wrap gap-x-4 gap-y-3">
          {gap.kind === "need" && (
            <button type="button" onClick={then(() => jumpTo(sectionOf(gap.group)))} className={LINK}>
              {NEED_ACTION[gap.group]}
            </button>
          )}
          {gap.kind === "stay" && (
            <button type="button" onClick={then(() => jumpTo("#need-stay"))} className={LINK}>
              {gap.short ? `Find a stay for ${guestCount(gap.short)}` : "Find a stay"}
            </button>
          )}
          {gap.kind === "unavailable" && (
            <>
              <button type="button" onClick={then(() => jumpTo(sectionOf(gap.item.listing.group)))} className={LINK}>
                Find another
              </button>
              <button type="button" onClick={then(() => onDate(gap.item))} className={LINK}>
                Change its dates
              </button>
            </>
          )}
          {gap.kind === "undated" && (
            <button type="button" onClick={then(() => onDate(gap.item))} className={LINK}>
              Set a date
            </button>
          )}
          {gap.kind === "tour-guests" && (
            <button type="button" onClick={then(() => jumpTo("#need-activity"))} className={LINK}>
              Find a tour for {guestCount(gap.short)}
            </button>
          )}
          {gap.kind === "unseen" && <SightLinks sights={gap.sights} then={then} />}
        </span>
      </div>
    </li>
  );
}

function GapText({ gap, guests }: { gap: PlanGap; guests: number }) {
  const lines = (title: string, line: string) => (
    <>
      <span className="line-clamp-2 font-semibold">{title}</span>
      <span className="text-muted">{line}</span>
    </>
  );
  switch (gap.kind) {
    case "need":
      return lines(needName(gap.group), NEED_LINE[gap.group]);
    case "stay": {
      const range = formatDateRange(gap.from, gap.to);
      const nights = `${gap.nights} ${gap.nights === 1 ? "night" : "nights"}`;
      if (!range) return lines("A place to stay", "Somewhere to sleep each night. Set your trip's dates to see which nights.");
      return gap.short
        ? lines(
            `Room for ${guests - gap.short} of ${guests} guests, ${range}`,
            `${gap.short} more ${gap.short === 1 ? "guest needs" : "guests need"} a place to stay for ${nights}.`,
          )
        : lines(`No place to stay ${range}`, `${nights} of your trip without a stay.`);
    }
    case "unavailable":
      return lines(`${gap.item.listing.title} isn't available`, `${gap.reason}. It stays in your trip until you pick another.`);
    case "undated":
      return lines(gap.item.listing.title, "No date yet, so it can't be booked.");
    case "tour-guests":
      return lines(
        `${gap.item.listing.title}: ${gap.guests} of ${guests} guests`,
        `${gap.short} more ${gap.short === 1 ? "guest needs" : "guests need"} another tour${
          gap.item.starts_on ? ` on ${formatDateRange(gap.item.starts_on, gap.item.starts_on)}` : ""
        }.`,
      );
    case "unseen":
      return lines(
        "Not on any of your tours yet",
        `${gap.sights.length === 1 ? "A place tours go to" : `${gap.sights.length} places tours go to`} here:`,
      );
  }
}

// The places no tour of the trip goes to, each opening its card in Places to see (#<slug>),
// which says the tours that go there.
const FIRST_SIGHTS = 5;

function SightLinks({ sights, then }: { sights: Sight[]; then: (action: () => void) => () => void }) {
  const [all, setAll] = useState(false);
  const shown = all ? sights : sights.slice(0, FIRST_SIGHTS);
  return (
    <>
      {shown.map((sight) => (
        <button key={sight.slug} type="button" onClick={then(() => jumpTo(`#${sight.slug}`))} className={LINK}>
          {sight.name}
        </button>
      ))}
      {!all && sights.length > FIRST_SIGHTS && (
        <button
          type="button"
          onClick={() => setAll(true)}
          className="relative text-muted underline-offset-4 after:absolute after:-inset-x-2 after:-inset-y-3 after:content-[''] hover:underline"
        >
          +{sights.length - FIRST_SIGHTS} more
        </button>
      )}
    </>
  );
}

// A gap in a few words, for the "Left to plan" line.
function gapShort(gap: PlanGap) {
  switch (gap.kind) {
    case "need":
      return needName(gap.group).toLowerCase();
    case "stay":
      return gap.from ? (gap.short ? `beds for ${gap.short} more` : `a stay for ${gap.nights} ${gap.nights === 1 ? "night" : "nights"}`) : "a place to stay";
    case "unavailable":
      return `another ${gap.item.listing.title}`;
    case "undated":
      return `a date for ${gap.item.listing.title}`;
    case "tour-guests":
      return `a tour for ${gap.short} more`;
    case "unseen":
      return "places tours go to";
  }
}

// "a, b and c".
function listShort(parts: string[]) {
  return parts.length < 2 ? (parts[0] ?? "") : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

function gapKey(gap: PlanGap) {
  return "item" in gap ? `${gap.kind}-${gap.item.id}` : gap.kind === "stay" ? `stay-${gap.from}` : gap.kind === "need" ? gap.group : gap.kind;
}
