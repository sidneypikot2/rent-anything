"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { attributeLabel, displayValue } from "@/components/partner/listing-changes";
import { ListingMissing } from "@/components/partner/listing-missing";
import { STATUS } from "@/components/partner/listings-table";
import {
  useDeleteListing,
  usePartnerListing,
  type PartnerListing,
} from "@/components/partner/use-partner-listings";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { DisplayTitle } from "@/components/ui/typography";

// One of the partner's listings, read-only (RAA-47), with the way to edit or delete it.
export default function PartnerListingPage() {
  const id = Number(useParams<{ id: string }>().id);
  const { data, error, refetch } = usePartnerListing(id);

  return (
    <main data-testid="partner-listing" className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-12">
      {data ? (
        <ListingDetail listing={data} />
      ) : data === null ? (
        <ListingMissing />
      ) : error ? (
        <div className="flex flex-col items-start gap-3">
          <p role="alert" className="text-sm text-danger">
            Couldn&apos;t load the listing.
          </p>
          <Button size="sm" variant="soft" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted">Loading the listing…</p>
      )}
    </main>
  );
}

function ListingDetail({ listing }: { listing: PartnerListing }) {
  const router = useRouter();
  const remove = useDeleteListing(listing.id);
  const [confirming, setConfirming] = useState(false);
  const status = STATUS[listing.status];
  const { street, city, province, region, postal_code } = listing.address;
  const address = [street, city, province, region].filter(Boolean).join(", ") + (postal_code ? ` ${postal_code}` : "");
  const attrs = Object.entries(listing.attrs);

  return (
    <>
      <div className="flex flex-col gap-4">
        <ButtonLink href="/partner/listings" size="sm" variant="soft" className="self-start">
          ← Listings
        </ButtonLink>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <DisplayTitle>{listing.title}</DisplayTitle>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
              <Badge tone={status.tone}>{status.label}</Badge>
              <span>
                {listing.category.name} · {listing.area.name}
              </span>
            </div>
          </div>
          <div className="flex gap-3">
            <ButtonLink href={`/partner/listings/${listing.id}/edit`} size="sm" data-testid="listing-edit">
              Edit
            </ButtonLink>
            <Button size="sm" variant="danger" onClick={() => setConfirming(true)} data-testid="listing-delete">
              Delete
            </Button>
          </div>
        </div>
      </div>

      {remove.error && (
        <p role="alert" className="text-sm text-danger">
          {remove.error.message}
        </p>
      )}

      <Card>
        <CardBody pad="lg">
          <dl className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-[10rem_1fr]">
            <Detail term="Description">
              <span className="whitespace-pre-line">{listing.description || "—"}</span>
            </Detail>
            <Detail term="Address">{address || "—"}</Detail>
            <Detail term="Map pin">
              {listing.location.lat.toFixed(5)}, {listing.location.lng.toFixed(5)}
            </Detail>
            {listing.category.booking_type === "activity" && (
              <Detail term="Landmarks">
                {listing.landmarks.length > 0 ? (
                  <span data-testid="listing-landmarks">
                    {listing.landmarks.map((landmark) => `${landmark.name} — ${landmark.area.name}`).join(", ")}
                    <span className="block text-muted">Covers: {listing.covers.map((place) => place.name).join(", ")}</span>
                  </span>
                ) : (
                  "—"
                )}
              </Detail>
            )}
            {attrs.map(([key, value]) => (
              <Detail key={key} term={attributeLabel(key)}>
                {displayValue(value, key)}
              </Detail>
            ))}
          </dl>
        </CardBody>
      </Card>

      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title={`Delete “${listing.title}”?`}
        data-testid="listing-delete-confirm"
        actions={
          <>
            <Button variant="soft" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={remove.isPending}
              data-testid="listing-delete-confirm-button"
              onClick={() =>
                remove.mutate(undefined, {
                  onSuccess: () => router.push("/partner/listings"),
                  onError: () => setConfirming(false),
                })
              }
            >
              {remove.isPending ? "Deleting…" : "Delete"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">The listing is removed for good. This can&apos;t be undone.</p>
      </Dialog>
    </>
  );
}

function Detail({ term, children }: { term: string; children: ReactNode }) {
  return (
    <>
      <dt className="font-semibold text-muted">{term}</dt>
      <dd className="-mt-3 sm:mt-0">{children}</dd>
    </>
  );
}
