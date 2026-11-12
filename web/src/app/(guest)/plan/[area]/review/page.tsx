import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadPlanOver } from "@/components/plan/load-plan-over";
import { loadPlanPlace } from "@/components/plan/load-plan-place";
import { PlanFrame } from "@/components/plan/plan-frame";
import { PlanReview } from "@/components/plan/plan-review";
import { PlanTripChange, PlanTripLabel } from "@/components/plan/plan-trip-bar";
import { tripParam } from "@/components/trips/trip-dates";
import { AdoptTrip } from "@/components/trips/trip-link";

export const metadata: Metadata = { title: "Review your trip" };

// Plan a whole trip, the track's last stop: the trip day by day, then Send to partners.
export default async function PlanReviewPage(props: PageProps<"/plan/[area]/review">) {
  const slug = (await props.params).area;
  const searchParams = await props.searchParams;
  const tripId = tripParam(searchParams.trip);
  // A row's listing opens in the planner's frame (`?listing=`, over-plan.ts), as on the checklist.
  const [place, over] = await Promise.all([loadPlanPlace(slug), loadPlanOver(slug, searchParams)]);
  if (!place) notFound();
  return (
    <PlanFrame back={`/plan/${slug}${tripId ? `?trip=${tripId}` : ""}`} backLabel="Back to your checklist" label={<PlanTripLabel place={place} />} action={<PlanTripChange place={place} />} wide>
      {tripId && <AdoptTrip id={tripId} />}
      <PlanReview place={place} over={over} />
    </PlanFrame>
  );
}
