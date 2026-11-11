import { PlanFrame } from "@/components/plan/plan-frame";
import { PlanStartSkeleton } from "@/components/plan/plan-skeletons";

// Step 1 while the server fetches the destinations: the step's frame and its form's shape.
export default function PlanStartLoading() {
  return (
    <PlanFrame back="/" backLabel="Back to home">
      <PlanStartSkeleton />
    </PlanFrame>
  );
}
