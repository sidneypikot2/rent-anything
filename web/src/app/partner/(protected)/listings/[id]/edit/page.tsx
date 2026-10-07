"use client";

import { useParams } from "next/navigation";
import { ListingForm } from "@/components/partner/listing-form";
import { ListingMissing } from "@/components/partner/listing-missing";
import { useListingOptions, usePartnerListing } from "@/components/partner/use-partner-listings";
import { Button } from "@/components/ui/button";
import { DisplayTitle } from "@/components/ui/typography";

// Changing one of the partner's listings (RAA-47): the add-listing form, filled in. Saving
// asks to confirm what changed. The status stays as it is.
export default function EditPartnerListing() {
  const id = Number(useParams<{ id: string }>().id);
  const listing = usePartnerListing(id);
  const options = useListingOptions();
  const failed = listing.error ?? options.error;

  return (
    <main data-testid="partner-listing-edit" className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-12">
      <DisplayTitle>Edit listing</DisplayTitle>
      {listing.data === null ? (
        <ListingMissing />
      ) : listing.data && options.data ? (
        <ListingForm options={options.data} listing={listing.data} />
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
            }}
          >
            Try again
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted">Loading…</p>
      )}
    </main>
  );
}
