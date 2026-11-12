import Link from "next/link";
import { getBusiness } from "@/api/discovery";
import { BusinessBody, businessCount, businessId, businessView, destinationsOrNone } from "@/components/discovery/business-view";
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
      title: view.listing.title,
      meta: (
        <>
          by{" "}
          <Link href={view.businessHref} className="font-semibold text-link underline underline-offset-4" data-testid="listing-business">
            {view.listing.business.name}
          </Link>
          {" · "}
          {view.listing.category.name}
        </>
      ),
      body: <ListingBody view={view} inPlan />,
    };
  }
  const business = typeof searchParams.business === "string" ? businessId(searchParams.business) : null;
  if (!business) return null;
  const [detail, destinations] = await Promise.all([getBusiness(business), destinationsOrNone()]);
  if (!detail) return null;
  const view = businessView(detail, destinations, params);
  return {
    title: view.business.name,
    meta: [view.town || view.area.name, businessCount(view)].join(" · "),
    body: <BusinessBody view={view} inPlan />,
  };
}
