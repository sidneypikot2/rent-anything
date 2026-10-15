"use client";

import { useParams } from "next/navigation";
import { ListingForm } from "@/components/partner/listing-form";
import { ListingMissing } from "@/components/partner/listing-missing";
import { usePartnerBusinesses } from "@/components/partner/use-partner-businesses";
import { useListingOptions, usePartnerListing } from "@/components/partner/use-partner-listings";
import { Button } from "@/components/ui/button";
import { DisplayTitle } from "@/components/ui/typography";

// Changing one of the partner's listings (RAA-47): the add-listing form, filled in. Saving
// asks to confirm what changed. The status stays as it is.
export default function EditPartnerListing() {
  const id = Number(useParams<{ id: string }>().id);
  const listing = usePartnerListing(id);
  const options = useListingOptions();
  const businesses = usePartnerBusinesses();
  const failed = listing.error ?? options.error ?? businesses.error;

  return (
    <main data-testid="partner-listing-edit" className="mx-auto flex w-full max-w-page flex-1 flex-col gap-block px-gutter py-page-pad">
      <DisplayTitle>Edit listing</DisplayTitle>
      {listing.data === null ? (
        <ListingMissing />
      ) : listing.data && options.data && businesses.data ? (
        <ListingForm options={options.data} businesses={businesses.data} listing={listing.data} />
      ) : failed ? (
        <div className="flex flex-col items-start gap-3">
          <p role="alert" className="text-sm text-danger">
            Couldn&apos;t load the listing.
          </p>
          <Button
            size="sm"
            variant="soft"
            onClick={() => {
              if (listing.error) void listing.refetch();
              if (options.error) void options.refetch();
              if (businesses.error) void businesses.refetch();
            }}
          >
            Try again
          </Button>
        </div>
      ) : (
        <div role="status" className="flex flex-col gap-6 md:grid md:grid-cols-[13rem_minmax(0,42rem)] md:gap-10">
          <span className="sr-only">Loading the listing…</span>
          <div aria-hidden="true" className="hidden h-72 animate-pulse rounded-card bg-glass-fill md:block" />
          <div aria-hidden="true" className="h-96 animate-pulse rounded-card bg-glass-fill" />
        </div>
      )}
    </main>
  );
}
