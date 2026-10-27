"use client";

import { useState } from "react";
import { TickGlyph } from "@/components/discovery/tag-glyphs";
import { cn } from "@/components/ui/cn";
import { missingAnchor, missingHere, type Missing } from "./trip-missing";
import type { Trip } from "./use-trips";

type Need = { kind: Missing["kind"]; label: string; gap?: Missing };

// What a trip here can't do without, as a checklist that ticks as the guest adds: a place to
// stay for its nights and a way here (missingHere), each only when the place offers it. A tick
// pops once when it turns done, so an add shows as the trip coming together, not only a receipt.
// On the trip band's dark glass (the banner's trip card, the toast).
export function TripNeeds({
  trip,
  places,
  offered,
  since,
  className,
}: {
  trip: Trip;
  places: string[];
  offered: string[];
  // The trip before an add (null for a trip the add started), so a fresh toast pops what it covered.
  since?: Trip | null;
  className?: string;
}) {
  const needs = needsOf(trip, places, offered);
  // The ones that just turned done, for their pop: compared with the last render's, or `since`.
  const doneNow = doneOf(needs);
  const [seen, setSeen] = useState(() =>
    since === undefined ? doneNow : since === null ? "" : doneOf(needsOf(since, places, offered)),
  );
  const [popped, setPopped] = useState<string[]>([]);
  if (doneNow !== seen) {
    const before = seen.split(" ");
    setPopped(doneNow.split(" ").filter((kind) => kind && !before.includes(kind)));
    setSeen(doneNow);
  }
  if (needs.length === 0) return null;
  return renderNeeds(needs, popped, className);
}

function doneOf(needs: Need[]) {
  return needs.filter((need) => !need.gap).map((need) => need.kind).join(" ");
}

function needsOf(trip: Trip, places: string[], offered: string[]): Need[] {
  const missing = missingHere(trip, places, offered);
  return [
    ...(offered.includes("stay") ? [{ kind: "stay" as const, label: "Stay", gap: missing.find((gap) => gap.kind === "stay") }] : []),
    ...(offered.includes("transfer")
      ? [{ kind: "transfer" as const, label: "Transfer", gap: missing.find((gap) => gap.kind === "transfer") }]
      : []),
  ];
}

function renderNeeds(needs: Need[], popped: string[], className?: string) {
  return (
    <ul aria-label="What your trip needs here" data-testid="trip-needs" className={cn("flex flex-wrap items-center gap-2", className)}>
      {needs.map((need) =>
        need.gap ? (
          <li key={need.kind}>
            <a
              href={missingAnchor(need.gap)}
              data-testid={`trip-need-${need.kind}`}
              className="tap-target inline-flex min-h-7 items-center gap-1.5 rounded-full border border-dashed border-sky-pale/70 px-3 text-small font-semibold text-sky-pale transition-colors duration-300 ease-calm hover:border-white hover:text-white"
            >
              {need.label}
              <span className="font-normal text-sky-mist">· still needed</span>
            </a>
          </li>
        ) : (
          <li
            key={need.kind}
            data-testid={`trip-need-${need.kind}`}
            data-done
            className={cn(
              "inline-flex min-h-7 items-center gap-1.5 rounded-full bg-white/15 px-3 text-small font-semibold text-white",
              popped.includes(need.kind) && "animate-tick",
            )}
          >
            <TickGlyph aria-hidden className="size-3.5 text-mint" />
            {need.label}
            <span className="sr-only">: in your trip</span>
          </li>
        ),
      )}
    </ul>
  );
}
