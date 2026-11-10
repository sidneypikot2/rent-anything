import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";
import { PlanFoot } from "./plan-frame";

// Each plan step's loading state, laid out as the step itself — heading, fields, stepper, cards,
// days — so nothing jumps when the step arrives. Shared by the routes' loading.tsx (while the
// server fetches) and the steps (while the session and trips load). Grey blocks on white
// (`bg-mist`), pulsing only with motion allowed.
const BLOCK = "bg-mist motion-safe:animate-pulse";

function Line({ className }: { className?: string }) {
  return <span aria-hidden className={cn("block rounded-full", BLOCK, className)} />;
}

function Heading({ eyebrow = false, sub = false }: { eyebrow?: boolean; sub?: boolean }) {
  return (
    <div className="flex flex-col gap-2 pt-4">
      {eyebrow && <Line className="h-4 w-32" />}
      <Line className="h-9 w-72 max-w-full rounded-control" />
      {sub && <Line className="h-4 w-96 max-w-full" />}
    </div>
  );
}

function Status({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div role="status" aria-busy className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

// Step 1: Where, When, Who's coming, then Next.
export function PlanStartSkeleton() {
  return (
    <Status label="Loading…" className="flex flex-1 flex-col">
      <div className="flex flex-col gap-5 pb-8">
        <Heading />
        {[0, 1].map((field) => (
          <div key={field} className="flex flex-col gap-2">
            <Line className="h-4 w-16" />
            <span className={cn("h-12 rounded-xl", BLOCK)} />
          </div>
        ))}
        <div className="flex flex-col gap-4 rounded-control border border-line px-4 py-4">
          {[0, 1].map((row) => (
            <div key={row} className="flex items-center justify-between gap-3">
              <Line className="h-4 w-20" />
              <span className="flex items-center gap-4">
                <span className={cn("size-11 rounded-full", BLOCK)} />
                <Line className="h-4 w-4" />
                <span className={cn("size-11 rounded-full", BLOCK)} />
              </span>
            </div>
          ))}
        </div>
      </div>
      <PlanFoot>
        <span className={cn("h-12 w-44 rounded-full", BLOCK)} />
      </PlanFoot>
    </Status>
  );
}

// One option card (PlanCard): the photo, then category, title, who, dates, price.
function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-2.5", className)}>
      <span className={cn("aspect-[4/3] sm:aspect-[20/19] rounded-card", BLOCK)} />
      <div className="flex flex-col gap-1.5">
        <Line className="h-4 w-3/4" />
        <Line className="h-3.5 w-2/3" />
        <Line className="h-3.5 w-1/2" />
        <Line className="mt-1 h-4 w-1/3" />
      </div>
    </div>
  );
}

// A step's options: one under another on a phone, two across on a tablet, and from lg the cards beside the map (`map`: on by default), or four across without it.
export function PlanOptionsSkeleton({ map = true }: { map?: boolean }) {
  return (
    <Status label="Loading options…" className={cn("flex flex-col gap-5", map && "lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(20rem,42%)] lg:items-start")}>
      <div className={cn("grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2", !map && "lg:grid-cols-4")}>
        {[0, 1, 2, 3].map((index) => (
          <CardSkeleton key={index} className={cn(index > 1 && "max-sm:hidden")} />
        ))}
      </div>
      {map && <span className={cn("hidden h-[calc(100dvh-var(--chrome)-9rem)] min-h-80 rounded-card lg:block", BLOCK)} />}
    </Status>
  );
}

// Step 2: the checklist's stepper (a track, labels under it), then the open step's panel (its
// heading, the chips or choices, then the cards beside the map) and the foot.
export function PlanChecklistSkeleton() {
  return (
    <Status label="Loading your trip…" className="flex flex-1 flex-col">
      <div className="flex flex-col gap-3 pb-8">
        <div aria-hidden className="mx-auto flex w-full max-w-narrow flex-col gap-1.5 pt-3 pb-2">
          <span className={cn("h-10 w-full rounded-full", BLOCK)} />
          <div className="grid grid-cols-6">
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <span key={index} className={cn("mx-auto h-4.5 w-3/5 rounded-full", BLOCK)} />
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-3 rounded-card border border-line p-3 sm:p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Line className="h-6 w-48 rounded-control" />
              <Line className="h-4 w-72 max-w-full" />
            </div>
            <Line className="h-4 w-24" />
          </div>
          <div className="grid gap-2 min-[26rem]:grid-cols-2">
            {[0, 1].map((choice) => (
              <span key={choice} className={cn("h-16 rounded-card", BLOCK)} />
            ))}
          </div>
          <PlanOptionsSkeleton />
        </div>
      </div>
      <PlanFoot summary={<Line className="h-4 w-56" />} />
    </Status>
  );
}

// Step 3: the trip's heading, its days down a line (a date disc, then event rows), the foot.
export function PlanReviewSkeleton() {
  return (
    <Status label="Loading your plan…" className="flex flex-1 flex-col">
      <div className="pb-2">
        <Heading eyebrow sub />
      </div>
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start lg:gap-gutter">
      <ol aria-hidden className="flex flex-col pt-3 pb-8">
        {[2, 1, 2].map((events, index) => (
          <li key={index} className="flex gap-3">
            <div className="flex w-12 shrink-0 flex-col items-center">
              <span className={cn("size-12 rounded-full", BLOCK)} />
              {index < 2 && <span className="mt-1 w-0.5 flex-1 bg-line" />}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-2 pb-6 pt-3">
              <Line className="h-4 w-28" />
              {Array.from({ length: events }, (_, event) => (
                <div key={event} className="flex items-start gap-3 rounded-card border border-line p-3">
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <Line className="h-5 w-20" />
                    <Line className="h-4 w-2/3" />
                    <Line className="h-3.5 w-1/2" />
                  </div>
                  <Line className="h-4 w-14 shrink-0" />
                </div>
              ))}
            </div>
          </li>
        ))}
      </ol>
      <div aria-hidden className="mt-3 hidden flex-col gap-3 rounded-card border border-line p-4 lg:flex">
        <Line className="h-5 w-40" />
        <div className={cn("aspect-[16/11] rounded-control", BLOCK)} />
        <Line className="h-4 w-2/3" />
        <Line className="h-4 w-1/2" />
      </div>
      </div>
      <PlanFoot
        summary={
          <>
            <Line className="h-5 w-40" />
            <Line className="h-3.5 w-full max-w-md" />
          </>
        }
      >
        <span className={cn("h-12 w-44 rounded-full", BLOCK)} />
      </PlanFoot>
    </Status>
  );
}
