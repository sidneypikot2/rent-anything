"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { DisplayTitle } from "@/components/ui/typography";
import { DisplayNameGate, ListingGate } from "./listing-gate";
import { useListingOptions, type ListingOptions } from "./use-partner-listings";
import { usePartnerProfile } from "./use-partner-profile";
import { isVerified, usePartnerVerification } from "./use-partner-verification";

// A page of adding a listing (RAA-41, RAA-50) once the options have loaded. Only a partner
// whose ID is verified may add one (RAA-44), then only one with a display name (RAA-86):
// until then this points to /partner/verify or the profile, in the API's order. The API's
// 403s are the real check.
export function NewListingStep({ children }: { children: (options: ListingOptions) => ReactNode }) {
  const verification = usePartnerVerification();
  const profile = usePartnerProfile();
  const options = useListingOptions();
  const failed = verification.error ?? profile.error ?? options.error;

  return (
    <main data-testid="partner-listing-new" className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-4 py-12">
      <DisplayTitle>Add a listing</DisplayTitle>
      {verification.data && !isVerified(verification.data) ? (
        <ListingGate />
      ) : verification.data && profile.data && !profile.data.display_name ? (
        <DisplayNameGate />
      ) : verification.data && profile.data && options.data ? (
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
              if (profile.error) void profile.refetch();
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
