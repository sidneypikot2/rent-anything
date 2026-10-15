"use client";

import { ListingsByBusiness } from "@/components/partner/listings-table";
import { usePartnerBusinesses } from "@/components/partner/use-partner-businesses";
import { usePartnerListings } from "@/components/partner/use-partner-listings";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { DisplayTitle } from "@/components/ui/typography";

// The partner's listings, in any status (RAA-41), grouped by business (RAA-101), those that
// need the partner first.
export default function PartnerListings() {
  const listings = usePartnerListings();
  const businesses = usePartnerBusinesses();
  const failed = listings.error ?? businesses.error;

  return (
    <main data-testid="partner-listings" className="mx-auto flex w-full max-w-page flex-1 flex-col gap-block px-gutter py-page-pad">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <DisplayTitle>Listings</DisplayTitle>
        <ButtonLink href="/partner/listings/new" variant="glow" size="pill" data-testid="add-listing">
          Add listing
        </ButtonLink>
      </div>
      {listings.data && businesses.data ? (
        businesses.data.length > 0 ? (
          <ListingsByBusiness businesses={businesses.data} listings={listings.data} />
        ) : (
          <Card data-testid="listings-empty">
            <CardBody pad="lg" className="flex flex-col items-start gap-3">
              <h2 className="text-lg font-semibold">No listings yet</h2>
              <p className="max-w-prose text-sm text-muted">
                Add your business first, then the first thing you offer: a tour, a motorbike, a room.
              </p>
              <ButtonLink href="/partner/businesses/new?next=/partner/listings/new" variant="glow" size="pill">
                Add your business
              </ButtonLink>
            </CardBody>
          </Card>
        )
      ) : failed ? (
        <div className="flex flex-col items-start gap-3">
          <p role="alert" className="text-sm text-danger">
            Couldn&apos;t load your listings.
          </p>
          <Button
            size="pill"
            variant="quiet"
            onClick={() => {
              if (listings.error) void listings.refetch();
              if (businesses.error) void businesses.refetch();
            }}
          >
            Try again
          </Button>
        </div>
      ) : (
        <div role="status" className="flex flex-col gap-4">
          <span className="sr-only">Loading your listings…</span>
          <div aria-hidden="true" className="h-8 w-48 animate-pulse rounded-control bg-mist" />
          <div aria-hidden="true" className="h-40 animate-pulse rounded-card bg-mist" />
        </div>
      )}
    </main>
  );
}
