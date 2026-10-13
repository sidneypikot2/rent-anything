"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { DisplayTitle } from "@/components/ui/typography";
import { BusinessGate, ListingGate } from "./listing-gate";
import { useListingOptions, type ListingOptions } from "./use-partner-listings";
import { usePartnerBusinesses, type PartnerBusiness } from "./use-partner-businesses";
import { isVerified, usePartnerVerification } from "./use-partner-verification";

// A page of adding a listing (RAA-41, RAA-50) once the options have loaded. Only a partner
// whose ID is verified may add one (RAA-44), then only one with a business (RAA-101):
// until then this points to /partner/verify or adding a business, in the API's order. The
// API's 403s are the real check.
export function NewListingStep({
  children,
}: {
  children: (options: ListingOptions, businesses: PartnerBusiness[]) => ReactNode;
}) {
  const verification = usePartnerVerification();
  const businesses = usePartnerBusinesses();
  const options = useListingOptions();
  const failed = verification.error ?? businesses.error ?? options.error;

  return (
    <main data-testid="partner-listing-new" className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-4 py-12">
      <DisplayTitle>Add a listing</DisplayTitle>
      {verification.data && !isVerified(verification.data) ? (
        <ListingGate />
      ) : verification.data && businesses.data?.length === 0 ? (
        <BusinessGate />
      ) : verification.data && businesses.data && options.data ? (
        children(options.data, businesses.data)
      ) : failed ? (
        <div className="flex flex-col items-start gap-3">
          <p role="alert" className="text-sm text-danger">
            Couldn&apos;t load the form.
          </p>
          <Button
            size="sm"
            variant="soft"
            onClick={() => {
              if (verification.error) void verification.refetch();
              if (businesses.error) void businesses.refetch();
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
