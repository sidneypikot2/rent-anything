"use client";

import { CategoryGlyph, PlaceGlyph, TickGlyph } from "@/components/discovery/tag-glyphs";
import { cn } from "@/components/ui/cn";
import type { RowKey, StepKey } from "./plan-data";

export type PlanStep = { key: StepKey; title: string; state: "open" | "done" | "skipped" };

// Each step's icon in the filled segment, and the short label a phone shows under the track.
const STEP: Record<RowKey, { icon: string; short: string }> = {
  stay: { icon: "Hotel or cottage", short: "Stay" },
  transfer: { icon: "Van transfer", short: "Arrive" },
  rental: { icon: "Motorcycle", short: "Ride" },
  activity: { icon: "Tour", short: "Do" },
  gear: { icon: "Snorkel gear", short: "Gear" },
};
const SHORT = (key: StepKey) => (key === "places" ? "See" : STEP[key].short);

// The checklist's steps as a segmented stepper (team, 2026-11-03, after the row of pills): one
// tinted track split into equal segments with the labels underneath. The open step's segment is
// filled in the action colour with its icon and slides between steps; the others show a dot —
// a forest disc with a tick once done (the open one's icon becomes a tick too), a hollow ring when
// skipped. Any step opens in any
// order. It sticks under the header while the options scroll; its height is in `--plan-chrome`
// (globals.css), which whatever sticks under it uses.
export function PlanSteps({ rows, active, onPick }: { rows: PlanStep[]; active: StepKey; onPick: (key: StepKey) => void }) {
  const activeIndex = Math.max(0, rows.findIndex((row) => row.key === active));

  return (
    <div className="sticky top-[calc(var(--chrome)-0.75rem)] z-10 -mx-3 bg-surface px-3 pt-3 pb-2 sm:-mx-6 sm:px-6" data-plan-steps>
      <div className="relative sm:mx-auto sm:w-full sm:max-w-narrow">
        <div aria-hidden className="absolute inset-x-0 top-0 h-10 rounded-full bg-primary/10" />
        <span
          aria-hidden
          className="absolute top-0 left-0 h-10 rounded-full bg-primary shadow-sm transition-transform duration-300 ease-calm motion-reduce:transition-none"
          style={{ width: `${100 / rows.length}%`, transform: `translateX(${activeIndex * 100}%)` }}
        />
        <ol className="relative grid" style={{ gridTemplateColumns: `repeat(${rows.length}, minmax(0, 1fr))` }} data-testid="plan-checklist">
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
                  className="group flex w-full flex-col items-center gap-1.5 rounded-full focus-visible:outline-offset-2"
                  data-testid={`plan-step-${row.key}`}
                >
                  <span aria-hidden className="flex h-10 w-full items-center justify-center">
                    {isActive ? (
                      // A finished step trades its icon for a tick, even while open; not Places
                      // to see, whose first heart would otherwise swap it mid-pick.
                      row.key === "places" ? (
                        <PlaceGlyph className="size-5 text-white" />
                      ) : isDone ? (
                        <TickGlyph className="size-5 text-white motion-safe:animate-tick" />
                      ) : (
                        <CategoryGlyph name={STEP[row.key].icon} className="size-5 text-white" />
                      )
                    ) : isDone ? (
                      <span className="flex size-6 items-center justify-center rounded-full bg-forest text-white shadow-sm transition-transform duration-200 group-hover:scale-110 motion-safe:animate-tick">
                        <TickGlyph className="size-3.5" />
                      </span>
                    ) : (
                      <span
                        className={cn(
                          "size-2 rounded-full transition-transform duration-200 group-hover:scale-125",
                          isSkipped ? "border-[1.5px] border-primary/50" : "bg-primary/45",
                        )}
                      />
                    )}
                  </span>
                  <span
                    className={cn(
                      "block max-w-full truncate text-small whitespace-nowrap transition-colors",
                      isActive ? "font-bold text-navy" : isDone ? "font-semibold text-forest" : "font-medium text-muted group-hover:text-navy",
                    )}
                  >
                    <span className="md:hidden">{SHORT(row.key)}</span>
                    <span className="max-md:hidden">{row.title}</span>
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
