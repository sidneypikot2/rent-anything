"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { activityCatalogues, isWaterActivity } from "@/components/partner/activity-fields";
import { ActivityWizard } from "@/components/partner/activity-wizard";
import { ListingWizard } from "@/components/partner/listing-wizard";
import { NewListingStep } from "@/components/partner/new-listing-step";
import { isStay } from "@/components/partner/stay-fields";
import { StayWizard } from "@/components/partner/stay-wizard";
import { isTour } from "@/components/partner/tour-fields";
import { TourWizard } from "@/components/partner/tour-wizard";
import { ButtonLink } from "@/components/ui/button";

// The steps after the business and category (RAA-50, RAA-101): ?business= and ?category=
// are the ones chosen on /partner/listings/new; a partner with one business may leave the
// business out. Accommodation (RAA-83), tours (RAA-111) and water activities (RAA-272) have
// their own steps.
export default function NewPartnerListingDetails() {
  return (
    <Suspense>
      <DetailSteps />
    </Suspense>
  );
}

function DetailSteps() {
  const params = useSearchParams();
  const categoryId = Number(params.get("category"));
  const businessId = Number(params.get("business"));
  return (
    <NewListingStep>
      {(options, businesses) => {
        const category = options.categories.find((option) => option.id === categoryId);
        const business =
          businesses.find((option) => option.id === businessId) ??
          (businesses.length === 1 ? businesses[0] : undefined);
        const policies = options.cancellation_policies;
        if (!category || !business) {
          return (
            <div data-testid="listing-no-category" className="flex flex-col items-start gap-3">
              <p className="text-sm text-muted">Choose the business and what you&apos;re listing first.</p>
              <ButtonLink
                href={category ? `/partner/listings/new?category=${category.id}` : "/partner/listings/new"}
                variant="glow"
                size="pill"
              >
                Choose
              </ButtonLink>
            </div>
          );
        }
        const key = `${business.id}-${category.id}`;
        if (isTour(category)) {
          return (
            <TourWizard
              key={key}
              business={business}
              category={category}
              policies={policies}
              inclusions={options.tour_inclusions}
            />
          );
        }
        if (isWaterActivity(category)) {
          return (
            <ActivityWizard
              key={key}
              business={business}
              category={category}
              policies={policies}
              catalogues={activityCatalogues(options)}
            />
          );
        }
        return isStay(category) ? (
          <StayWizard key={key} business={business} category={category} policies={policies} />
        ) : (
          <ListingWizard key={key} business={business} category={category} policies={policies} />
        );
      }}
    </NewListingStep>
  );
}
