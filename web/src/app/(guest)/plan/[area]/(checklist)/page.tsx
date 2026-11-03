import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getBusiness, getPlanBusinesses } from "@/api/discovery";
import { BusinessBody, businessCount, businessId, businessView, destinationsOrNone } from "@/components/discovery/business-view";
import { BusinessModal } from "@/components/plan/business-modal";
import { PlanFrame } from "@/components/plan/plan-frame";
import { PlanChecklist } from "@/components/plan/plan-checklist";
import { loadPlanPlace } from "@/components/plan/load-plan-place";
import { PLAN_ROWS } from "@/components/plan/plan-data";
import { PlanTripChange, PlanTripLabel } from "@/components/plan/plan-trip-bar";
import { TripAddProvider } from "@/components/trips/trip-add-provider";
import { AdoptTrip } from "@/components/trips/trip-link";
import { tripParam } from "@/components/trips/trip-dates";

export async function generateMetadata(props: PageProps<"/plan/[area]">): Promise<Metadata> {
  const place = await loadPlanPlace((await props.params).area);
  return { title: place ? `Plan your ${place.area.name} trip` : "Not found" };
}

// Plan a whole trip, step 2: the checklist and the places to see for one place. Adds go to the
// trip `?trip=` names (it becomes the tab's chosen trip), through the usual add flow.
export default async function PlanChecklistPage(props: PageProps<"/plan/[area]">) {
  const slug = (await props.params).area;
  const searchParams = await props.searchParams;
  const tripId = tripParam(searchParams.trip);
  // A gap's Add on the review opens its row (`?choose=transfer`).
  const choose = PLAN_ROWS.find((row) => row.key === searchParams.choose)?.key;
  const place = await loadPlanPlace(slug);
  if (!place) notFound();
  // Page 1 of the step it most likely opens on (the stays, or `?choose=`'s), handed over so the
  // browser needn't ask again; any other step loads there.
  const initialKey = choose ?? "stay";
  // A step's card tapped on a phone opens its business over the plan (`?business=`, over-plan.ts),
  // in the plan's URL so a reload keeps both.
  const openId = typeof searchParams.business === "string" ? businessId(searchParams.business) : null;
  const [initialPage, open] = await Promise.all([
    getPlanBusinesses(slug, initialKey),
    openId ? Promise.all([getBusiness(openId), destinationsOrNone()]) : null,
  ]);
  const view = open?.[0] ? businessView(open[0], open[1], { ...searchParams, place: slug, plan: "1" }) : null;
  return (
    <>
    <PlanFrame step={2} back={`/plan?where=${slug}${tripId ? `&trip=${tripId}` : ""}`} backLabel="Back to where, when and who" label={<PlanTripLabel place={place} />} action={<PlanTripChange place={place} />} wide>
      {tripId && <AdoptTrip id={tripId} />}
      <TripAddProvider places={place.places}>
        <PlanChecklist place={place} choose={choose} initial={initialPage ? { key: initialKey, data: initialPage } : undefined} />
      </TripAddProvider>
    </PlanFrame>
    {view && (
      <BusinessModal title={view.business.name} meta={[view.town || view.area.name, businessCount(view)].join(" · ")}>
        <BusinessBody view={view} inModal />
      </BusinessModal>
    )}
    </>
  );
}
