import type { ReactNode } from "react";
import { PageSheet } from "@/components/landing/page-sheet";
import { cn } from "@/components/ui/cn";
import { PlanBackButton } from "./leave-plan-guard";
import { PlanNavProvider } from "./plan-nav";

// Plan a whole trip (2026-11-02, the team's guided planner with our checklist): each step on the
// white sheet (on a phone the whole screen: no site header or footer, data-plan-page in
// globals.css), under one slim bar as wide as a form on every step (2026-11-03, the compact
// checklist): the way back, what the step is about (`label`: the trip's where, when and who; "Plan
// a trip" before there is one) and the step's `action`. No step count or progress bar: the
// planner's one track (PlanSteps, Trip to Review) shows where the guest is.
// The step's own content and its pinned foot come as children.
export function PlanFrame({
  back,
  backLabel,
  leaves = false,
  label,
  action,
  wide = false,
  children,
}: {
  back: string;
  backLabel: string;
  // The way back leaves the planner (step 1's, to home): it asks first (PlanBackButton).
  leaves?: boolean;
  // What the bar says beside the step: "optional", the trip's name.
  label?: ReactNode;
  // At the bar's right end: the checklist's Change (back to step 1).
  action?: ReactNode;
  // The sheet's full width (the header's) for the step's content instead of a form's: the
  // checklist, whose options sit beside a map. The bar stays a form's width on every step.
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <main className="flex flex-1 flex-col pt-3 max-sm:pt-0" data-testid="plan" data-plan-page>
      <PageSheet tone="paper" flushOnPhone>
        <div className={cn("mx-auto flex w-full flex-1 flex-col pt-3 sm:pt-6", !wide && "max-w-narrow")}>
          <div className="mx-auto flex w-full max-w-narrow items-center gap-3 pb-2">
            <PlanBackButton href={back} label={backLabel} leaves={leaves} />
            <p className="min-w-0 flex-1 truncate text-sm font-semibold text-muted">{label ?? "Plan a trip"}</p>
            {action}
          </div>
          <PlanNavProvider>{children}</PlanNavProvider>
        </div>
      </PageSheet>
    </main>
  );
}

// The step's foot, pinned to the window's bottom: what the trip comes to and its one button.
// Under the step's own popovers (z-10, below a date field's calendar at z-20), so an open
// calendar is never covered by it.
// `float` sits centred just above it, over the page (the checklist's Map pill on a phone).
// `row`: the summary and the button side by side, for a short summary (the picks tray).
export function PlanFoot({ summary, float, row = false, children }: { summary?: ReactNode; float?: ReactNode; row?: boolean; children?: ReactNode }) {
  return (
    <div
      className={cn(
        "sticky bottom-0 z-10 -mx-3 mt-auto flex gap-2 border-t border-line bg-surface px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:-mx-6 sm:px-6",
        row ? "items-center justify-between gap-3 *:min-w-0" : "flex-col",
      )}
    >
      {float && <div className="pointer-events-none absolute bottom-full left-1/2 mb-3 -translate-x-1/2 *:pointer-events-auto">{float}</div>}
      {summary}
      {/* The step's one action, as wide as its label (all three the same size), at the right. */}
      {children && <div className={cn("flex justify-end *:min-w-40", row && "shrink-0")}>{children}</div>}
    </div>
  );
}

// Each step's heading, the same on every page: an optional line above, the title, an optional line
// under it.
export function PlanHeading({ id, eyebrow, title, sub }: { id?: string; eyebrow?: ReactNode; title: ReactNode; sub?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 pt-4">
      {eyebrow && <p className="text-sm font-bold text-primary">{eyebrow}</p>}
      <h1 id={id} className="font-display text-3xl font-extrabold tracking-tight text-navy">
        {title}
      </h1>
      {sub && <p className="text-sm text-muted">{sub}</p>}
    </div>
  );
}
