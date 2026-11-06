import { PlanFrame } from "@/components/plan/plan-frame";
import { PlanReviewSkeleton } from "@/components/plan/plan-skeletons";

// Step 3 while the server fetches the place: the review's days.
export default function PlanReviewLoading() {
  return (
    <PlanFrame step={3} back="/plan" backLabel="Back to your checklist" label="Review" wide>
      <PlanReviewSkeleton />
    </PlanFrame>
  );
}
