"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { DisplayTitle } from "@/components/ui/typography";
import { ListingGate } from "./listing-gate";
import { useListingOptions, type ListingOptions } from "./use-partner-listings";
import { isVerified, usePartnerVerification } from "./use-partner-verification";

// A page of adding a listing (RAA-41, RAA-50) once the options have loaded. Only a partner
// whose ID is verified may add one (RAA-44): until then this is a pointer to /partner/verify.
// The API's 403 is the real check.
export function NewListingStep({ children }: { children: (options: ListingOptions) => ReactNode }) {
  const verification = usePartnerVerification();
  const options = useListingOptions();
  const failed = verification.error ?? options.error;

  return (
    <main data-testid="partner-listing-new" className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-4 py-12">
      <DisplayTitle>Add a listing</DisplayTitle>
      {verification.data && !isVerified(verification.data) ? (
        <ListingGate />
      ) : verification.data && options.data ? (
        children(options.data)
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
