"use client";

import Link from "next/link";
import { useState } from "react";
import { InstantBookBadge } from "@/components/discovery/instant-book-badge";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { needsAttention, sortForPartner, statusDisplay } from "./listing-status";
import type { PartnerBusiness } from "./use-partner-businesses";
import type { PartnerListing } from "./use-partner-listings";

const UPDATED = new Intl.DateTimeFormat("en-PH", { day: "numeric", month: "short", year: "numeric" });

const hasStatus = (status: PartnerListing["status"]) => (listing: PartnerListing) => listing.status === status;

const FILTERS = {
  all: { label: "All", keep: () => true },
  attention: { label: "Needs attention", keep: needsAttention },
  live: { label: "Live", keep: hasStatus("active") },
  paused: { label: "Paused", keep: hasStatus("paused") },
  drafts: { label: "Drafts", keep: hasStatus("draft") },
  delisted: { label: "Delisted", keep: hasStatus("delisted") },
} as const;
type Filter = keyof typeof FILTERS;

function countLabel(count: number) {
  return `${count} ${count === 1 ? "listing" : "listings"}`;
}

// Every business the partner runs, in the API's order (by name), each with its listings
// (RAA-101): a heading with its name, how many listings it has and Edit, then one list of its
// listings, those that need the partner first and delisted ones last. Chips above narrow
// every business's list to what needs attention or to one status (RAA-115); each shows only
// when it would leave something out. A business with no listings yet offers to add the first.
export function ListingsByBusiness({
  businesses,
  listings,
}: {
  businesses: PartnerBusiness[];
  listings: PartnerListing[];
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const counts = Object.fromEntries(
    Object.entries(FILTERS).map(([key, { keep }]) => [key, listings.filter(keep).length]),
  ) as Record<Filter, number>;
  // A chip shows only when it would narrow the list, and the row only when one does.
  const offered = (key: Filter) => key === "all" || (counts[key] > 0 && counts[key] < counts.all);
  const filtering = (Object.keys(FILTERS) as Filter[]).some((key) => key !== "all" && offered(key));
  const active = filtering && offered(filter) ? filter : "all";
  const shown = sortForPartner(listings.filter(FILTERS[active].keep));

  return (
    <div className="flex flex-col gap-8">
      {filtering && (
        <div role="group" aria-label="Show" className="flex flex-wrap gap-2" data-testid="listing-filters">
          {(Object.keys(FILTERS) as Filter[])
            .filter(offered)
            .map((key) => (
              <Pill key={key} on={active === key} onClick={() => setFilter(key)} data-testid={`listing-filter-${key}`}>
                {FILTERS[key].label} <span className="tabular-nums opacity-80">{counts[key]}</span>
              </Pill>
            ))}
        </div>
      )}
      <div className="flex flex-col gap-12">
        {businesses.map((business) => {
          const all = listings.filter((listing) => listing.business.id === business.id);
          const own = shown.filter((listing) => listing.business.id === business.id);
          // Narrowed, a business with nothing to show steps aside.
          if (active !== "all" && own.length === 0) return null;
          return (
            <section
              key={business.id}
              data-testid="listing-business"
              aria-labelledby={`business-${business.id}`}
              className="flex flex-col gap-4"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line-strong pb-2">
                <h2
                  id={`business-${business.id}`}
                  className="flex items-baseline gap-2 font-display text-3xl font-extrabold tracking-tight"
                >
                  {business.name}
                  <span className="font-sans text-sm font-normal text-muted">{countLabel(all.length)}</span>
                </h2>
                <Link
                  href={`/partner/businesses/${business.id}/edit`}
                  data-testid="business-edit"
                  className="text-sm text-link underline"
                >
                  Edit<span className="sr-only"> {business.name}</span>
                </Link>
              </div>
              {own.length > 0 ? (
                <ListingRows listings={own} />
              ) : (
                <p data-testid="business-empty" className="text-sm text-muted">
                  No listings yet ·{" "}
                  <Link href={`/partner/listings/new?business=${business.id}`} className="text-link underline">
                    Add listing
                  </Link>
                </p>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

// A business's listings in one card. From `sm` up it is a table, the category under each
// title; on a phone each listing is a row of its own, its status beside the title. Either way
// the title is the link, stretched over the whole row.
function ListingRows({ listings }: { listings: PartnerListing[] }) {
  return (
    <Card>
      <ul className="divide-y divide-line sm:hidden">
        {listings.map((listing) => {
          const status = statusDisplay(listing);
          return (
            <li key={listing.id} data-testid="listing-row" className="relative flex flex-col gap-1.5 px-4 py-3.5 active:bg-surface-2">
              <div className="flex items-start justify-between gap-3">
                <Link
                  href={`/partner/listings/${listing.id}`}
                  data-testid="listing-link"
                  className="font-medium text-link after:absolute after:inset-0"
                >
                  {listing.title}
                </Link>
                <Badge tone={status.tone} className="shrink-0">
                  {status.label}
                </Badge>
              </div>
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
                {listing.booking_mode === "instant" && <InstantBookBadge small />}
                {listing.category.name} · {listing.area.name} · Updated {UPDATED.format(new Date(listing.updated_at))}
              </p>
            </li>
          );
        })}
      </ul>
      <table className="hidden w-full table-fixed text-left text-sm sm:table">
        <colgroup>
          <col />
          <col className="w-36 lg:w-44" />
          <col className="w-48 lg:w-56" />
          <col className="w-32" />
        </colgroup>
        <thead className="border-b border-line bg-surface-2 text-muted">
          <tr>
            <th scope="col" className="px-4 py-2.5 font-semibold">Listing</th>
            <th scope="col" className="px-4 py-2.5 font-semibold">Area</th>
            <th scope="col" className="px-4 py-2.5 font-semibold">Status</th>
            <th scope="col" className="px-4 py-2.5 font-semibold">Updated</th>
          </tr>
        </thead>
        <tbody>
          {listings.map((listing) => {
            const status = statusDisplay(listing);
            return (
              <tr
                key={listing.id}
                data-testid="listing-row"
                className="relative border-b border-line transition-colors duration-300 ease-calm last:border-0 hover:bg-surface-2"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/partner/listings/${listing.id}`}
                    data-testid="listing-link"
                    className="block truncate font-medium text-link after:absolute after:inset-0 hover:underline"
                  >
                    {listing.title}
                  </Link>
                  <span className="flex items-center gap-2 truncate text-xs text-muted">
                    {listing.category.name}
                    {listing.booking_mode === "instant" && <InstantBookBadge small />}
                  </span>
                </td>
                <td className="truncate px-4 py-3 text-muted">{listing.area.name}</td>
                <td className="px-4 py-3">
                  <span className="flex flex-col items-start gap-1">
                    <Badge tone={status.tone}>{status.label}</Badge>
                    {status.note && <span className="text-xs text-muted">{status.note}</span>}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted tabular-nums">{UPDATED.format(new Date(listing.updated_at))}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}
