"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ListingWizard } from "@/components/partner/listing-wizard";
import { NewListingStep } from "@/components/partner/new-listing-step";
import { isStay } from "@/components/partner/stay-fields";
import { StayWizard } from "@/components/partner/stay-wizard";
import { ButtonLink } from "@/components/ui/button";

// The steps after the category (RAA-50): ?category= is the one chosen on /partner/listings/new.
// Accommodation has its own steps (RAA-83).
export default function NewPartnerListingDetails() {
  return (
    <Suspense>
      <DetailSteps />
    </Suspense>
  );
}

function DetailSteps() {
  const categoryId = Number(useSearchParams().get("category"));
  return (
    <NewListingStep>
      {(options) => {
        const category = options.categories.find((option) => option.id === categoryId);
        const policies = options.cancellation_policies;
        if (category && isStay(category)) return <StayWizard key={category.id} category={category} policies={policies} />;
        return category ? (
          <ListingWizard key={category.id} category={category} policies={policies} />
        ) : (
          <div data-testid="listing-no-category" className="flex flex-col items-start gap-3">
            <p className="text-sm text-muted">Choose what you&apos;re listing first.</p>
            <ButtonLink href="/partner/listings/new" size="sm">
              Choose a category
            </ButtonLink>
          </div>
        );
      }}
    </NewListingStep>
  );
}
