"use client";

import type { useRouter } from "next/navigation";

type Router = ReturnType<typeof useRouter>;

// A business's or a listing's page opened from the planner lives in the plan's own URL
// (`?business=<id>` or `?listing=<id>`, plus the page's `show`, `place` and dates), so a reload
// keeps the plan with it open, and the planner shows it in its frame, under the bar and stepper
// (PlanOver), at every width (RAA-309). These open and close it.
// The keys only the business or listing adds; the dates and guests are the plan's too, so they stay.
const OVER_PLAN_KEYS = ["business", "listing", "show", "place", "item"];
const PUSHED = "plan-over-pushed";

// `/businesses/12?…` → ["business", "12"]; `/listings/7-sunset-tour?…` (or `/listings/7`) → ["listing", "7"].
export function overPlanTarget(href: string): [key: "business" | "listing", id: string] | null {
  const match = /^\/(businesses|listings)\/([1-9]\d*)(?:-[^/]*)?$/.exec(new URL(href, window.location.origin).pathname);
  if (!match) return null;
  return [match[1] === "businesses" ? "business" : "listing", match[2]];
}

// The plan's URL with the business or listing `href` over it; the step (`?choose=`) stays.
export function overPlanHref(href: string) {
  const target = new URL(href, window.location.origin);
  const query = new URLSearchParams(window.location.search);
  for (const key of OVER_PLAN_KEYS) query.delete(key);
  target.searchParams.forEach((value, key) => {
    if (key !== "plan" && key !== "trip" && key !== "from") query.set(key, value);
  });
  // A listing's `from` is a date, unless it says where it was opened from (`from=place`).
  const from = target.searchParams.get("from");
  if (from && from !== "place") query.set("from", from);
  const over = overPlanTarget(href);
  if (over) query.set(over[0], over[1]);
  return `${window.location.pathname}?${query}`;
}

export function openOverPlan(router: Router, href: string) {
  const next = overPlanHref(href);
  // Remembered for this tab, so closing after a reload still goes Back instead of adding an entry.
  try {
    sessionStorage.setItem(PUSHED, next);
  } catch {}
  router.push(next);
}

// The plan's URL without what is open over it; `choose` opens that step.
function planHref(choose?: string) {
  const query = new URLSearchParams(window.location.search);
  for (const key of OVER_PLAN_KEYS) query.delete(key);
  if (choose) query.set("choose", choose);
  return `${window.location.pathname}${query.size ? `?${query}` : ""}`;
}

// Back when this tab opened it (the plan is the entry before); a shared link or a new tab has
// nothing to go back to, so the plan's URL replaces it. With `choose` (a stop on the stepper),
// the plan opens on that step instead, in place of what was open.
export function closeOverPlan(router: Router, choose?: string) {
  const here = `${window.location.pathname}${window.location.search}`;
  let pushed: string | null = null;
  try {
    pushed = sessionStorage.getItem(PUSHED);
    sessionStorage.removeItem(PUSHED);
  } catch {}
  if (!choose && pushed === here && window.history.length > 1) {
    router.back();
    return;
  }
  router.replace(planHref(choose), { scroll: false });
}
