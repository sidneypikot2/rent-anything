"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { ArrowGlyph } from "@/components/discovery/tag-glyphs";
import { cancellationPolicyName } from "@/components/partner/cancellation-policy";
import { attributeLabel, displayValue, RETIRED_ATTRS } from "@/components/partner/listing-changes";
import { visitsLandmarks } from "@/components/partner/listing-fields";
import { ListingMissing } from "@/components/partner/listing-missing";
import { PhotoStrip } from "@/components/partner/listing-photos";
import { UNITS_LABEL } from "@/components/partner/units-field";
import { uploadedPhotos } from "@/components/partner/use-listing-photos";
import { STATUS } from "@/components/partner/listing-status";
import {
  useDeleteListing,
  useListingOptions,
  usePartnerListing,
  type PartnerListing,
} from "@/components/partner/use-partner-listings";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { GlassPanel } from "@/components/ui/glass";
import { DisplayTitle } from "@/components/ui/typography";
import { formatPeso } from "@/lib/money";
import { feeText, nightUnit, stayRateTerms } from "@/lib/pricing";
import { basePriceUnit, durationText, groupText, inclusionText, tourTypeLabel } from "@/lib/tours";

// One of the partner's listings, read-only (RAA-47), with the way to edit or delete it. A stay
// still on the back-filled nightly price of 0 asks for a real one (RAA-105), and so does a tour
// made before tours had a price (RAA-111).
export default function PartnerListingPage() {
  const id = Number(useParams<{ id: string }>().id);
  const { data, error, refetch } = usePartnerListing(id);

  return (
    <main data-testid="partner-listing" className="mx-auto flex w-full max-w-page flex-1 flex-col gap-block px-gutter py-page-pad">
      {data ? (
        <ListingDetail listing={data} />
      ) : data === null ? (
        <ListingMissing />
      ) : error ? (
        <div className="flex flex-col items-start gap-3">
          <p role="alert" className="text-sm text-danger">
            Couldn&apos;t load the listing.
          </p>
          <Button size="pill" variant="glass" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      ) : (
        <div role="status" className="flex flex-col gap-4">
          <span className="sr-only">Loading the listing…</span>
          <div aria-hidden="true" className="h-10 w-72 max-w-full animate-pulse rounded-control bg-glass-fill" />
          <div aria-hidden="true" className="h-96 animate-pulse rounded-card bg-glass-fill" />
        </div>
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
  const attrs = Object.entries(listing.attrs).filter(([key]) => !RETIRED_ATTRS.has(key));
  const policies = useListingOptions().data?.cancellation_policies;
  const rate = listing.stay_rate;
  const perGuest = listing.attrs.place_type === "shared_room";
  const tour = listing.tour;

  return (
    <>
      <div className="flex flex-col gap-4">
        <ButtonLink href="/partner/listings" size="pill" variant="glass" className="-ml-3 self-start">
          <ArrowGlyph direction="left" className="size-4" />
          Listings
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
          <ButtonLink href={`/partner/listings/${listing.id}/edit`} variant="glow" size="pill" data-testid="listing-edit">
            Edit listing
          </ButtonLink>
        </div>
      </div>

      {listing.status !== "active" && (
        <GlassPanel role="status" data-testid="listing-status-note" className="rounded-card px-5 py-4 text-sm">
          <span className="font-semibold">
            {status.label}: {status.note.toLowerCase()}.
          </span>{" "}
          It stays this way while you finish the details and photos.
        </GlassPanel>
      )}

      {rate && !rate.nightly_price_cents && (
        <div
          role="status"
          data-testid="listing-needs-price"
          className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-warning/40 bg-surface-2 px-5 py-4 text-sm"
        >
          <span>
            <span className="font-semibold text-warning">No nightly price yet.</span> Guests don&apos;t see a price for
            this place, and it can&apos;t be booked, until you set one.
          </span>
          <ButtonLink href={`/partner/listings/${listing.id}/edit`} variant="glow" size="pill">
            Set a price
          </ButtonLink>
        </div>
      )}

      {tour && !tour.base_price_cents && (
        <div
          role="status"
          data-testid="listing-needs-price"
          className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-warning/40 bg-surface-2 px-5 py-4 text-sm"
        >
          <span>
            <span className="font-semibold text-warning">No price yet.</span> Guests don&apos;t see a price for this
            tour, and it can&apos;t be booked, until you set its details and price.
          </span>
          <ButtonLink href={`/partner/listings/${listing.id}/edit`} variant="glow" size="pill">
            Set a price
          </ButtonLink>
        </div>
      )}

      {remove.error && (
        <p role="alert" className="text-sm text-danger">
          {remove.error.message}
        </p>
      )}

      <Card>
        <CardBody pad="lg">
          <dl className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-[10rem_1fr]">
            <Detail term="Photos">
              {uploadedPhotos(listing.photos).length > 0 ? (
                <PhotoStrip photos={listing.photos} />
              ) : (
                <span className="text-muted">None yet. Add them from Edit listing.</span>
              )}
            </Detail>
            <Detail term="Description">
              <span className="whitespace-pre-line">{listing.description || "—"}</span>
            </Detail>
            <Detail term="Address">{address || "—"}</Detail>
            {visitsLandmarks(listing.category) && (
              <Detail term="Landmarks">
                {listing.landmarks.length > 0 ? (
                  <span data-testid="listing-landmarks" className="flex flex-col gap-1">
                    {landmarksByArea(listing.landmarks).map(([area, names]) => (
                      <span key={area}>
                        <span className="font-medium">{area}:</span> {names.join(", ")}
                      </span>
                    ))}
                    <span className="text-muted">Covers {listing.covers.map((place) => place.name).join(", ")}</span>
                  </span>
                ) : (
                  "—"
                )}
              </Detail>
            )}
            {tour && (
              <>
                <Detail term="Tour">
                  <span data-testid="listing-detail-tour">{tourTypeLabel(tour.tour_type)}</span>
                </Detail>
                <Detail term="Group">
                  {groupText(tour.min_guests, tour.max_guests)}, at most {tour.max_groups_per_day}{" "}
                  {tour.max_groups_per_day === 1 ? "group" : "groups"} a day
                </Detail>
                <Detail term="Duration">{durationText(tour.duration_value, tour.duration_unit)}</Detail>
                <Detail term={tour.tour_type === "private" ? "Add-ons" : "Included"}>
                  {tour.inclusions.length > 0
                    ? tour.inclusions.map((inclusion) => (
                        <span key={inclusion.kind} className="block">
                          {inclusionText(inclusion, tour.tour_type)}
                        </span>
                      ))
                    : "—"}
                </Detail>
                <Detail term="Price">
                  {tour.base_price_cents ? `${formatPeso(tour.base_price_cents)} ${basePriceUnit(tour.tour_type)}` : "No price yet"}
                </Detail>
              </>
            )}
            {attrs.map(([key, value]) => (
              <Detail key={key} term={attributeLabel(key)}>
                {displayValue(value, key)}
              </Detail>
            ))}
            {rate && (
              <Detail term="Pricing">
                <span data-testid="listing-detail-pricing">
                  {rate.nightly_price_cents ? `${formatPeso(rate.nightly_price_cents)} ${nightUnit(perGuest)}` : "No price yet"}
                  {rate.nightly_price_cents > 0 &&
                    stayRateTerms(rate, perGuest).map((term) => (
                      <span key={term} className="block text-muted">
                        {term}
                      </span>
                    ))}
                </span>
              </Detail>
            )}
            {(rate || tour || listing.fees.length > 0) && (
              <Detail term="Fees">
                {listing.fees.length > 0
                  ? listing.fees.map((fee) => (
                      <span key={fee.id} className="block">
                        {feeText(fee)}
                        {!fee.required && <span className="text-muted"> · optional add-on</span>}
                      </span>
                    ))
                  : "—"}
              </Detail>
            )}
            {!tour && (
              <Detail term={UNITS_LABEL}>
                <span data-testid="listing-detail-units">{listing.units_count}</span>
              </Detail>
            )}
            <Detail term="Cancellation policy">
              <span data-testid="listing-cancellation">
                {cancellationPolicyName(policies, listing.cancellation_policy)}
              </span>
            </Detail>
          </dl>
        </CardBody>
      </Card>

      <GlassPanel className="flex flex-wrap items-center justify-between gap-3 rounded-card px-5 py-4 text-sm">
        <span>Deleting removes the listing and its photos for good.</span>
        <Button size="pill" variant="danger" onClick={() => setConfirming(true)} data-testid="listing-delete">
          Delete listing
        </Button>
      </GlassPanel>

      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title={`Delete “${listing.title}”?`}
        data-testid="listing-delete-confirm"
        actions={
          <>
            <Button variant="soft" size="pill" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="pill"
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

// The landmarks a listing visits, grouped under their area, in the order they were picked.
function landmarksByArea(landmarks: PartnerListing["landmarks"]) {
  const areas = new Map<string, string[]>();
  for (const landmark of landmarks) areas.set(landmark.area.name, [...(areas.get(landmark.area.name) ?? []), landmark.name]);
  return [...areas.entries()];
}

function Detail({ term, children }: { term: string; children: ReactNode }) {
  return (
    <>
      <dt className="font-semibold text-muted">{term}</dt>
      <dd className="-mt-3 min-w-0 sm:mt-0">{children}</dd>
    </>
  );
}
