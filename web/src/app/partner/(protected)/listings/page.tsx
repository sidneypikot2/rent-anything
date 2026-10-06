"use client";

import { ListingsByCategory } from "@/components/partner/listings-table";
import { usePartnerListings } from "@/components/partner/use-partner-listings";
import { Button, ButtonLink } from "@/components/ui/button";
import { DisplayTitle } from "@/components/ui/typography";

// The partner's listings, in any status, sectioned by category (RAA-41).
export default function PartnerListings() {
  const { data, error, refetch } = usePartnerListings();

  return (
    <main data-testid="partner-listings" className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <DisplayTitle>Listings</DisplayTitle>
        <ButtonLink href="/partner/listings/new" size="sm" data-testid="add-listing">
          Add listing
        </ButtonLink>
      </div>
      {data ? (
        data.length > 0 ? (
          <ListingsByCategory listings={data} />
        ) : (
          <p data-testid="listings-empty" className="text-sm text-muted">
            No listings yet. Add the first thing you offer: a tour, a motorbike, a room.
          </p>
        )
      ) : error ? (
        <div className="flex flex-col items-start gap-3">
          <p role="alert" className="text-sm text-danger">
            Couldn&apos;t load your listings.
          </p>
          <Button size="sm" variant="soft" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted">Loading your listings…</p>
      )}
    </main>
  );
}
