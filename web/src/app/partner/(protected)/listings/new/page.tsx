"use client";

import { ListingForm } from "@/components/partner/listing-form";
import { useListingOptions } from "@/components/partner/use-partner-listings";
import { Button } from "@/components/ui/button";
import { DisplayTitle } from "@/components/ui/typography";

// Adding a listing (RAA-41); it is saved as a draft.
export default function NewPartnerListing() {
  const { data, error, refetch } = useListingOptions();

  return (
    <main data-testid="partner-listing-new" className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-12">
      <DisplayTitle>Add a listing</DisplayTitle>
      {data ? (
        <ListingForm options={data} />
      ) : error ? (
        <div className="flex flex-col items-start gap-3">
          <p role="alert" className="text-sm text-danger">
            Couldn&apos;t load the form.
          </p>
          <Button size="sm" variant="soft" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted">Loading…</p>
      )}
    </main>
  );
}
