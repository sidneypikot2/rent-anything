"use client";

import type { useRouter } from "next/navigation";

type Router = ReturnType<typeof useRouter>;

// A business's page over the plan on a phone lives in the plan's own URL (`?business=<id>` plus
// the business page's `show` and dates), so a reload keeps the plan with the business open over
// it. The plan's page renders it (BusinessModal); these open and close it.
// The keys only the business adds; the dates and guests are the plan's too, so they stay.
const OVER_PLAN_KEYS = ["business", "show", "place", "item"];
const PUSHED = "plan-business-pushed";

// The plan's URL with the business `href` (/businesses/<id>?show=…) over it.
export function overPlanHref(href: string) {
  const target = new URL(href, window.location.origin);
  const query = new URLSearchParams(window.location.search);
  for (const key of OVER_PLAN_KEYS) query.delete(key);
  target.searchParams.forEach((value, key) => {
    if (key !== "plan" && key !== "trip") query.set(key, value);
  });
  query.set("business", target.pathname.split("/").pop() ?? "");
  return `${window.location.pathname}?${query}`;
}

export function openOverPlan(router: Router, href: string) {
  const next = overPlanHref(href);
  // Remembered for this tab, so closing after a reload still goes Back instead of adding an entry.
  try {
    sessionStorage.setItem(PUSHED, next);
  } catch {}
  router.push(next, { scroll: false });
}

// Back when this tab opened it (the plan is the entry before); a shared link or a new tab has
// nothing to go back to, so the plan's URL replaces it.
export function closeOverPlan(router: Router) {
  const here = `${window.location.pathname}${window.location.search}`;
  let pushed: string | null = null;
  try {
    pushed = sessionStorage.getItem(PUSHED);
    sessionStorage.removeItem(PUSHED);
  } catch {}
  if (pushed === here && window.history.length > 1) {
    router.back();
    return;
  }
  const query = new URLSearchParams(window.location.search);
  for (const key of OVER_PLAN_KEYS) query.delete(key);
  router.replace(`${window.location.pathname}${query.size ? `?${query}` : ""}`, { scroll: false });
}
