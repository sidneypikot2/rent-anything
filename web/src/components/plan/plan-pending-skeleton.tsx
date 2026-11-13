"use client";

import { usePlanNav } from "./plan-nav";
import { PlanChecklistSkeleton, PlanReviewSkeleton, PlanStartSkeleton } from "./plan-skeletons";

// Under the track, while another planner page is on its way (`PlanPending` hides the step): that
// page's content as a skeleton, without a track of its own, as the live one stays.
export function PlanPendingSkeleton() {
  const { pending } = usePlanNav();
  if (pending === "trip") return <PlanStartSkeleton track={false} />;
  if (pending === "review") return <PlanReviewSkeleton track={false} />;
  if (pending === "checklist") return <PlanChecklistSkeleton track={false} />;
  return null;
}
