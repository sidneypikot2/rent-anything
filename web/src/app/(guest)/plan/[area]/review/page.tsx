import type { Metadata } from "next";
import { notFound } from "next/navigation";
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
  const tripId = tripParam((await props.searchParams).trip);
  const place = await loadPlanPlace(slug);
  if (!place) notFound();
  return (
    <PlanFrame back={`/plan/${slug}${tripId ? `?trip=${tripId}` : ""}`} backLabel="Back to your checklist" label={<PlanTripLabel place={place} />} action={<PlanTripChange place={place} />} wide>
      {tripId && <AdoptTrip id={tripId} />}
      <PlanReview place={place} />
    </PlanFrame>
  );
}
