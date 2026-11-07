"use client";

import Link from "next/link";
import { cn } from "@/components/ui/cn";
import { MapGlyph } from "@/components/discovery/tag-glyphs";
import { usePlanTripStart } from "./plan-trip-start";

// The home's main way in, the first of its three (2026-11-06): a white pill in lagoon ink, with a
// map from sm. It opens the guided planner (/plan), asking a guest with trips which
// one first (usePlanTripStart).
export function HomePlanButton({ className, testId = "plan-whole-trip" }: { className?: string; testId?: string }) {
  const plan = usePlanTripStart();
  return (
    <>
      <Link
        href={plan.href}
        onClick={plan.onClick}
        data-testid={testId}
        className={cn(
          "inline-flex h-13 justify-center items-center gap-2 rounded-full bg-white px-8 text-lg font-semibold text-action-ink shadow-soft transition-[box-shadow,background-color] duration-300 ease-calm hover:bg-sky-mist hover:shadow-lift sm:h-12 sm:px-7 sm:text-base",
          className,
        )}
      >
        <MapGlyph className="size-5 max-sm:hidden" />
        Plan a trip
      </Link>
      {plan.sheet}
    </>
  );
}
