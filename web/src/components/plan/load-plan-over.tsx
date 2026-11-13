import { getBusiness } from "@/api/discovery";
import { BusinessBody, businessId, businessView, destinationsOrNone } from "@/components/discovery/business-view";
import { ListingBody, listingId, loadListingView } from "@/components/discovery/listing-view";
import type { PlanOverView } from "./plan-over";

type SearchParams = Record<string, string | string[] | undefined>;

// The business (`?business=`) or listing (`?listing=`) open in a plan page's frame (RAA-309), as
// its own page shows it from a plan step (`plan=1`: a business shows only the step's group, and
// adds go to the plan's trip). Null when none is open or it doesn't exist.
export async function loadPlanOver(slug: string, searchParams: SearchParams): Promise<PlanOverView | null> {
  const params = { ...searchParams, place: slug, plan: "1" };
  const listing = typeof searchParams.listing === "string" ? listingId(searchParams.listing) : null;
  if (listing) {
    const view = await loadListingView(listing, params);
    if (!view) return null;
    return {
      body: <ListingBody view={view} inPlan />,
    };
  }
  const business = typeof searchParams.business === "string" ? businessId(searchParams.business) : null;
  if (!business) return null;
  const [detail, destinations] = await Promise.all([getBusiness(business), destinationsOrNone()]);
  if (!detail) return null;
  const view = businessView(detail, destinations, params);
  return {
    body: <BusinessBody view={view} inPlan />,
  };
}
