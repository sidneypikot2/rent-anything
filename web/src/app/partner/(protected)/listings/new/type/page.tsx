"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ListingTypePicker } from "@/components/partner/listing-category-picker";
import { NewListingStep } from "@/components/partner/new-listing-step";

// Adding a listing's second step (RAA-268): the kinds in the group picked on /partner/listings/new.
export default function NewPartnerListingType() {
  return (
    <Suspense>
      <TypeStep />
    </Suspense>
  );
}

function TypeStep() {
  const params = useSearchParams();
  return (
    <NewListingStep>
      {(options) => (
        <ListingTypePicker
          options={options}
          businessId={Number(params.get("business")) || undefined}
          groupName={params.get("group") ?? undefined}
          initialId={Number(params.get("category")) || undefined}
        />
      )}
    </NewListingStep>
  );
}
