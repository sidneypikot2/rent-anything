import { PlanFrame } from "@/components/plan/plan-frame";
import { PlanChecklistSkeleton } from "@/components/plan/plan-skeletons";

// Step 2 while the server fetches the place and its first options: the checklist's shape.
export default function PlanChecklistLoading() {
  return (
    <PlanFrame back="/plan" backLabel="Back to where, when and who" wide>
      <PlanChecklistSkeleton />
    </PlanFrame>
  );
}
