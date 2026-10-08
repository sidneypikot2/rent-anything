"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ListingCategoryPicker } from "@/components/partner/listing-category-picker";
import { NewListingStep } from "@/components/partner/new-listing-step";

// Adding a listing starts with what it is (RAA-50); Next opens the rest of the steps.
// ?category= preselects one, when the partner comes back to change it.
export default function NewPartnerListing() {
  return (
    <Suspense>
      <CategoryStep />
    </Suspense>
  );
}

function CategoryStep() {
  const initialId = Number(useSearchParams().get("category")) || undefined;
  return <NewListingStep>{(options) => <ListingCategoryPicker options={options} initialId={initialId} />}</NewListingStep>;
}
