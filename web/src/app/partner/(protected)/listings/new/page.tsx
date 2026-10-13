"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ListingCategoryPicker } from "@/components/partner/listing-category-picker";
import { NewListingStep } from "@/components/partner/new-listing-step";

// Adding a listing starts with which business it is for (RAA-101) and what it is (RAA-50);
// Next opens the rest of the steps. ?business= and ?category= preselect them, when the
// partner comes back to change one or adds a listing to a business from the listings page.
export default function NewPartnerListing() {
  return (
    <Suspense>
      <CategoryStep />
    </Suspense>
  );
}

function CategoryStep() {
  const params = useSearchParams();
  const initialId = Number(params.get("category")) || undefined;
  const initialBusinessId = Number(params.get("business")) || undefined;
  return (
    <NewListingStep>
      {(options, businesses) => (
        <ListingCategoryPicker
          options={options}
          businesses={businesses}
          initialId={initialId}
          initialBusinessId={initialBusinessId}
        />
      )}
    </NewListingStep>
  );
}
