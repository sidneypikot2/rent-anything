"use client";

import type { CSSProperties, ReactNode } from "react";
import { CalendarGlyph, CategoryGlyph, ListGlyph, PlaceGlyph, TickGlyph } from "@/components/discovery/tag-glyphs";
import { Spinner } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { LinkPending } from "@/components/ui/link-pending";
import type { RowKey, StepKey } from "./plan-data";
import { PlanNavLink } from "./plan-nav";

// A stop on the planner's one track (UX-laws review, Gap 2, 2026-11-11): the trip itself (step 1:
// where, when, who), the checklist's steps, then Review.
export type TrackKey = "trip" | StepKey | "review";

// `href`: a stop on another page (Trip, Review, or a step from Review); `preview`: shown but not
// open yet (step 1, before the trip exists). Otherwise a step on this page, opened by `onPick`.
export type PlanStop = { key: TrackKey; title: string; state: "open" | "done" | "skipped"; href?: string; preview?: boolean };

// Each step's icon in the filled segment.
const ICON: Record<RowKey, string> = {
  stay: "Hotel or cottage",
  transfer: "Van transfer",
  rental: "Motorcycle",
  activity: "Tour",
  gear: "Snorkel gear",
};

// The short label under the track, and in the open segment below sm.
const SHORT: Record<TrackKey, string> = {
  trip: "Trip",
  places: "See",
  stay: "Stay",
  transfer: "Transfer",
  rental: "Vehicle",
  activity: "Do",
  gear: "Gear",
  review: "Review",
};

// From sm, the open stop's share of the track against each closed stop's: the track keeps its
// width and only its split changes, so the open stop has room for its full name. On a phone each
// stop's column is as wide as its label at least (eight equal columns crowded "Transfer" into
// "Vehicle" at 360px), and the open stop shows just its icon, filled within its own column.
const OPEN_SHARE = 3;

function StopIcon({ stop }: { stop: PlanStop }) {
  const className = "size-5 shrink-0 text-white";
  if (stop.key === "trip") return <CalendarGlyph className={className} />;
  if (stop.key === "review") return <ListGlyph className={className} />;
  // A finished step trades its icon for a tick, even while open; not Places to see, whose first
  // heart would otherwise swap it mid-pick.
  if (stop.key === "places") return <PlaceGlyph className={className} />;
  if (stop.state === "done") return <TickGlyph className={cn(className, "motion-safe:animate-tick")} />;
  return <CategoryGlyph name={ICON[stop.key]} className={className} />;
}

// The planner's stops as one segmented track (team, 2026-11-03; Trip and Review on it since
// 2026-11-11): a tinted track with the labels underneath. The open stop's segment is filled in the
// action colour with its icon (and from sm its full name, widening), and slides between stops;
// the others show a dot — a forest disc with a tick once done, a hollow ring when skipped. Any
// step opens in any order. It sticks under the header while the page scrolls; its height is in
// `--plan-chrome` (globals.css), which whatever sticks under it uses.
export function PlanSteps({ stops, active, onPick }: { stops: PlanStop[]; active: TrackKey; onPick?: (key: StepKey) => void }) {
  const activeIndex = Math.max(0, stops.findIndex((stop) => stop.key === active));
  const shares = stops.length - 1 + OPEN_SHARE;
  const track = {
    "--cols": `repeat(${stops.length}, auto)`,
    "--cols-sm": stops.map((stop) => `minmax(0, ${stop.key === active ? OPEN_SHARE : 1}fr)`).join(" "),
  } as CSSProperties;
  const fill = {
    "--left": `${(activeIndex / shares) * 100}%`,
    "--width": `${(OPEN_SHARE / shares) * 100}%`,
  } as CSSProperties;

  return (
    <div className="sticky top-[calc(var(--chrome)-0.75rem)] z-10 -mx-3 bg-surface px-3 pt-3 pb-2 sm:-mx-6 sm:px-6" data-plan-steps>
      <div className="relative sm:mx-auto sm:w-full sm:max-w-narrow">
        <div aria-hidden className="absolute inset-x-0 top-0 h-10 rounded-full bg-primary/10" />
        <span
          aria-hidden
          style={fill}
          className="absolute top-0 left-(--left) h-10 w-(--width) rounded-full bg-primary shadow-sm transition-[left,width] duration-300 ease-calm motion-reduce:transition-none max-sm:hidden"
        />
        <ol
          style={track}
          className="relative grid [grid-template-columns:var(--cols)] transition-[grid-template-columns] duration-300 ease-calm motion-reduce:transition-none sm:[grid-template-columns:var(--cols-sm)]"
          data-testid="plan-checklist"
        >
          {stops.map((stop) => {
            const isActive = stop.key === active;
            const isDone = stop.state === "done";
            const isSkipped = stop.state === "skipped";
            const body = (
              <>
                {/* On a phone the open stop's fill, in its own column (from sm it slides, above). */}
                {isActive && <span aria-hidden className="absolute top-0 left-1/2 h-10 w-12 -translate-x-1/2 rounded-full bg-primary shadow-sm sm:hidden" />}
                {/* Keyboard focus rings the stop's segment of the track, not the segment and label. */}
                <span aria-hidden className="relative flex h-10 w-full min-w-0 items-center justify-center gap-1.5 rounded-full sm:px-3 group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-(--focus)">
                  {isActive ? (
                    <>
                      <StopIcon stop={stop} />
                      <span className="min-w-0 truncate text-small font-semibold text-white motion-safe:animate-swap-in max-sm:hidden">{stop.title}</span>
                    </>
                  ) : isDone ? (
                    <span className="flex size-6 items-center justify-center rounded-full bg-forest text-white shadow-sm transition-transform duration-200 group-hover:scale-110 motion-safe:animate-tick">
                      <TickGlyph className="size-3.5" />
                    </span>
                  ) : (
                    // At 70% on the track both read at 3:1 or more (WCAG 1.4.11); a skipped stop
                    // is a larger hollow ring, so it differs from an open dot by size, not only fill.
                    <span
                      className={cn(
                        "rounded-full transition-transform duration-200 group-hover:scale-125",
                        isSkipped ? "size-3 border-2 border-primary/70" : "size-2 bg-primary/70",
                      )}
                    />
                  )}
                </span>
                {/* From sm the open stop names itself in its segment, and the space under it stays,
                    so the track keeps its height; on a phone it is named here, in bold. */}
                <span
                  aria-hidden
                  className={cn(
                    "block text-small leading-4.5 whitespace-nowrap transition-colors max-sm:text-xs max-sm:tracking-tight sm:max-w-full sm:truncate",
                    isActive ? "font-bold text-navy sm:invisible" : isDone ? "font-semibold text-forest" : "font-medium text-muted group-hover:text-navy",
                  )}
                >
                  {SHORT[stop.key]}
                </span>
                <span className="sr-only">
                  {stop.title}
                  {isDone ? ", done" : isSkipped ? ", skipped" : ""}
                </span>
              </>
            );
            return (
              <li key={stop.key} className="relative sm:min-w-0" data-testid={`plan-row-${stop.key}`} data-done={isDone || undefined}>
                <Stop stop={stop} isActive={isActive} onPick={onPick}>
                  {body}
                </Stop>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

// A stop as what it does: a link to its page, a button opening its step here, or (a preview, or
// the stop already open with nothing to pick) plain text.
function Stop({ stop, isActive, onPick, children }: { stop: PlanStop; isActive: boolean; onPick?: (key: StepKey) => void; children: ReactNode }) {
  const className = "group flex w-full flex-col items-center gap-1.5 focus-visible:outline-none";
  const current = isActive ? ("step" as const) : undefined;
  const testId = `plan-step-${stop.key}`;
  if (stop.href && !isActive)
    return (
      <PlanNavLink href={stop.href} aria-current={current} className={className} data-testid={testId}>
        {children}
        {/* Trip and Review are other pages, with no skeleton: the stop turns while its page loads. */}
        <LinkPending
          pending={
            <span aria-hidden className="absolute top-2 left-1/2 flex size-6 -translate-x-1/2 items-center justify-center rounded-full bg-surface text-primary shadow-sm">
              <Spinner />
            </span>
          }
        />
      </PlanNavLink>
    );
  if (!stop.preview && onPick && stop.key !== "trip" && stop.key !== "review") {
    const key = stop.key;
    return (
      <button type="button" onClick={() => onPick(key)} aria-current={current} className={className} data-testid={testId}>
        {children}
      </button>
    );
  }
  return (
    <div aria-current={current} className={cn(className, "cursor-default")} data-testid={testId}>
      {children}
    </div>
  );
}
