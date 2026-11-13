"use client";

import { useRouter } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";
import { ChevronGlyph } from "@/components/discovery/tag-glyphs";
import { useOpensInNewTab } from "@/components/discovery/business-row";
import { closeOverPlan, openOverPlan, openOverPlanInNewTab, overPlanTarget } from "./over-plan";

// What the plan's page puts in its frame for a business or a listing opened from it (`?business=`
// or `?listing=`, over-plan.ts): its name and a line under it, and its body, the business's or
// listing's own page without the banner. Built on the server, shown by the step's page in place
// of the step (RAA-309).
export type PlanOverView = { title: string; meta: ReactNode; body: ReactNode };

// A business or a listing in the planner's frame, under the bar and stepper, at every width: a
// way back to the step, its name, then its body. Any link in it to another business or listing
// (by <business>, More from, an option's title) opens that one in the frame too — in a new tab
// on a laptop (RAA-313), in this one on a phone or tablet; a modified click still goes the link's
// own way.
export function PlanOver({ over, backLabel }: { over: PlanOverView; backLabel: string }) {
  const router = useRouter();
  const newTab = useOpensInNewTab();
  const stayInPlan = (event: MouseEvent) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = (event.target as HTMLElement).closest("a[href]");
    const href = link?.getAttribute("href");
    if (!href || !overPlanTarget(href)) return;
    event.preventDefault();
    if (newTab) openOverPlanInNewTab(href);
    else openOverPlan(router, href);
  };
  return (
    <div onClickCapture={stayInPlan} className="flex flex-col" data-testid="plan-over">
      <div className="flex flex-col gap-1 pt-2">
        <button
          type="button"
          onClick={() => closeOverPlan(router)}
          className="-ml-1 flex min-h-11 items-center gap-1 self-start px-1 text-sm font-semibold text-primary underline-offset-4 hover:underline"
          data-testid="plan-over-back"
        >
          <ChevronGlyph direction="left" className="size-4" />
          {backLabel}
        </button>
        <h2 className="font-display text-2xl font-extrabold tracking-tight text-balance break-words text-navy">{over.title}</h2>
        <div className="text-sm text-muted">{over.meta}</div>
      </div>
      {/* On a phone the bodies' sections pad themselves (`max-sm:px-3`), as on their own pages. */}
      <div className="max-sm:-mx-3">
        {over.body}
      </div>
    </div>
  );
}
