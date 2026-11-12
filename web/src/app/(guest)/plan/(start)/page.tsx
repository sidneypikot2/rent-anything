import type { Metadata } from "next";
import { getDestinations } from "@/api/discovery";
import { groupDestinations } from "@/components/discovery/cards";
import { LAUNCH_AREA } from "@/components/landing/launch-area";
import { PlanFrame } from "@/components/plan/plan-frame";
import { PlanStart, type PlanPlace } from "@/components/plan/plan-start";
import { readTripDates, tripParam } from "@/components/trips/trip-dates";
import { BRAND } from "@/lib/brand";
import { canonical } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Plan a whole trip",
  description: `Plan a whole trip on ${BRAND}: pick a place, your dates and who is coming, then a stay, transfers, tours and rentals, step by step, in one cart.`,
  alternates: canonical("/plan"),
};

// Plan a whole trip, step 1 (the team's A2): where, when, who, and where the guest is staying.
// Its Next starts the trip (or, back from the checklist with `?trip=`, changes it) and goes on to
// the checklist for the place. The places are the top-level destinations with things to book, the
// launch area first, each with its centre (from the destinations list) for the stay's map.
export default async function PlanStartPage(props: PageProps<"/plan">) {
  const searchParams = await props.searchParams;
  const destinations = await getDestinations().catch(() => []);
  const groups = groupDestinations(destinations).filter(({ area }) => area.to_book_count > 0);
  const ordered = [
    ...groups.filter(({ area }) => area.slug === LAUNCH_AREA.slug),
    ...groups.filter(({ area }) => area.slug !== LAUNCH_AREA.slug),
  ];
  const places: PlanPlace[] = ordered.map(({ area }) => ({ slug: area.slug, name: area.name, center: area.center }));
  const where = typeof searchParams.where === "string" ? searchParams.where : undefined;
  return (
    <PlanFrame back="/" backLabel="Back to home" leaves>
      <PlanStart
        places={places}
        initialWhere={places.find((place) => place.slug === where)?.slug ?? places[0]?.slug ?? LAUNCH_AREA.slug}
        dates={readTripDates(searchParams)}
        tripId={tripParam(searchParams.trip)}
      />
    </PlanFrame>
  );
}
