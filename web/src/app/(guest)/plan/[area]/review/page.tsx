import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadPlanPlace } from "@/components/plan/load-plan-place";
import { PlanFrame } from "@/components/plan/plan-frame";
import { PlanReview } from "@/components/plan/plan-review";
import { tripParam } from "@/components/trips/trip-dates";
import { AdoptTrip } from "@/components/trips/trip-link";

export const metadata: Metadata = { title: "Review your trip" };

// Plan a whole trip, step 3: the trip day by day, then Send to partners.
export default async function PlanReviewPage(props: PageProps<"/plan/[area]/review">) {
  const slug = (await props.params).area;
  const tripId = tripParam((await props.searchParams).trip);
  const place = await loadPlanPlace(slug);
  if (!place) notFound();
  return (
    <PlanFrame step={3} back={`/plan/${slug}${tripId ? `?trip=${tripId}` : ""}`} backLabel="Back to your checklist" label="Review" wide>
      {tripId && <AdoptTrip id={tripId} />}
      <PlanReview place={place} />
    </PlanFrame>
  );
}
