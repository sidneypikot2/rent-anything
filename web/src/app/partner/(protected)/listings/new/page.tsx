"use client";

import { ListingForm } from "@/components/partner/listing-form";
import { useListingOptions } from "@/components/partner/use-partner-listings";
import { isVerified, usePartnerVerification } from "@/components/partner/use-partner-verification";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { DisplayTitle } from "@/components/ui/typography";

// Adding a listing (RAA-41); it is saved as a draft. Only a partner whose ID is verified
// may add one (RAA-44): until then this is a pointer to /partner/verify. The API's 403 is
// the real check.
export default function NewPartnerListing() {
  const verification = usePartnerVerification();
  const options = useListingOptions();
  const failed = verification.error ?? options.error;

  return (
    <main data-testid="partner-listing-new" className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-12">
      <DisplayTitle>Add a listing</DisplayTitle>
      {verification.data && !isVerified(verification.data) ? (
        <ListingGate />
      ) : verification.data && options.data ? (
        <ListingForm options={options.data} />
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

function ListingGate() {
  return (
    <Card data-testid="listing-gate">
      <CardBody pad="lg" className="flex flex-col items-start gap-4">
        <div>
          <h2 className="font-semibold">Verify your ID first</h2>
          <p className="mt-1 text-sm text-muted">
            Every partner verifies their ID before adding a listing. It takes a few minutes: a government ID and a
            selfie.
          </p>
        </div>
        <ButtonLink href="/partner/verify" data-testid="listing-gate-verify">
          Verify your ID
        </ButtonLink>
      </CardBody>
    </Card>
  );
}
