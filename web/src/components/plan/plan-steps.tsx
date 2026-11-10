"use client";

import { CategoryGlyph, PlaceGlyph, TickGlyph } from "@/components/discovery/tag-glyphs";
import { cn } from "@/components/ui/cn";
import type { RowKey, StepKey } from "./plan-data";

export type PlanStep = { key: StepKey; title: string; state: "open" | "done" | "skipped" };

// Each step's icon in the filled segment, and the short label a phone shows under the track.
const STEP: Record<RowKey, { icon: string; short: string }> = {
  stay: { icon: "Hotel or cottage", short: "Stay" },
  transfer: { icon: "Van transfer", short: "Transfer" },
  rental: { icon: "Motorcycle", short: "Vehicle" },
  activity: { icon: "Tour", short: "Do" },
  gear: { icon: "Snorkel gear", short: "Gear" },
};
const SHORT = (key: StepKey) => (key === "places" ? "See" : STEP[key].short);

// The open step's share of the track against each closed step's: the track keeps its width and
// only its split changes, so the open step has room for its full name.
const OPEN_SHARE = 3;

// The checklist's steps as a segmented stepper (team, 2026-11-03, after the row of pills): one
// tinted track with the labels underneath. The open step's segment widens, filled in the action
// colour with its icon and full name, and the others shrink to a short label and a dot —
// a forest disc with a tick once done (the open one's icon becomes a tick too), a hollow ring when
// skipped. Any step opens in any order. It sticks under the header while the options scroll; its height is in `--plan-chrome`
// (globals.css), which whatever sticks under it uses.
export function PlanSteps({ rows, active, onPick }: { rows: PlanStep[]; active: StepKey; onPick: (key: StepKey) => void }) {
  const activeIndex = Math.max(0, rows.findIndex((row) => row.key === active));
  const shares = rows.length - 1 + OPEN_SHARE;

  return (
    <div className="sticky top-[calc(var(--chrome)-0.75rem)] z-10 -mx-3 bg-surface px-3 pt-3 pb-2 sm:-mx-6 sm:px-6" data-plan-steps>
      <div className="relative sm:mx-auto sm:w-full sm:max-w-narrow">
        <div aria-hidden className="absolute inset-x-0 top-0 h-10 rounded-full bg-primary/10" />
        <span
          aria-hidden
          className="absolute top-0 h-10 rounded-full bg-primary shadow-sm transition-[left,width] duration-300 ease-calm motion-reduce:transition-none"
          style={{ left: `${(activeIndex / shares) * 100}%`, width: `${(OPEN_SHARE / shares) * 100}%` }}
        />
        <ol
          className="relative grid transition-[grid-template-columns] duration-300 ease-calm motion-reduce:transition-none"
          style={{ gridTemplateColumns: rows.map((row) => `minmax(0, ${row.key === active ? OPEN_SHARE : 1}fr)`).join(" ") }}
          data-testid="plan-checklist"
        >
          {rows.map((row) => {
            const isActive = row.key === active;
            const isDone = row.state === "done";
            const isSkipped = row.state === "skipped";
            return (
              <li key={row.key} className="min-w-0" data-testid={`plan-row-${row.key}`} data-done={isDone || undefined}>
                <button
                  type="button"
                  onClick={() => onPick(row.key)}
                  aria-current={isActive ? "step" : undefined}
                  className="group flex w-full flex-col items-center gap-1.5 focus-visible:outline-none"
                  data-testid={`plan-step-${row.key}`}
                >
                  {/* Keyboard focus rings the step's segment of the track, not the segment and label. */}
                  <span aria-hidden className="flex h-10 w-full min-w-0 items-center justify-center gap-1.5 rounded-full px-3 group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-(--focus)">
                    {isActive ? (
                      <>
                        {/* A finished step trades its icon for a tick, even while open; not Places
                            to see, whose first heart would otherwise swap it mid-pick. */}
                        {row.key === "places" ? (
                          <PlaceGlyph className="size-5 shrink-0 text-white" />
                        ) : isDone ? (
                          <TickGlyph className="size-5 shrink-0 text-white motion-safe:animate-tick" />
                        ) : (
                          <CategoryGlyph name={STEP[row.key].icon} className="size-5 shrink-0 text-white" />
                        )}
                        <span className="min-w-0 truncate text-small font-semibold text-white motion-safe:animate-swap-in">{row.title}</span>
                      </>
                    ) : isDone ? (
                      <span className="flex size-6 items-center justify-center rounded-full bg-forest text-white shadow-sm transition-transform duration-200 group-hover:scale-110 motion-safe:animate-tick">
                        <TickGlyph className="size-3.5" />
                      </span>
                    ) : (
                      // At 70% on the track both read at 3:1 or more (WCAG 1.4.11); a skipped step
                      // is a larger hollow ring, so it differs from an open dot by size, not only fill.
                      <span
                        className={cn(
                          "rounded-full transition-transform duration-200 group-hover:scale-125",
                          isSkipped ? "size-3 border-2 border-primary/70" : "size-2 bg-primary/70",
                        )}
                      />
                    )}
                  </span>
                  {/* The open step names itself in its segment; the space under it stays, so the
                      track keeps its height. */}
                  <span
                    aria-hidden
                    className={cn(
                      "block max-w-full truncate text-small whitespace-nowrap transition-colors",
                      isActive ? "invisible" : isDone ? "font-semibold text-forest" : "font-medium text-muted group-hover:text-navy",
                    )}
                  >
                    {SHORT(row.key)}
                  </span>
                  <span className="sr-only">
                    {row.title}
                    {isDone ? ", done" : isSkipped ? ", skipped" : ""}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
