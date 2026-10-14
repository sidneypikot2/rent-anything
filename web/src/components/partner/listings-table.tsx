import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { PartnerBusiness } from "./use-partner-businesses";
import type { PartnerListing } from "./use-partner-listings";

// Each status with what it means for guests, said beside the badge so a draft isn't
// mistaken for a listing travellers can see.
export const STATUS = {
  draft: { label: "Draft", tone: "mist", note: "Guests can't see it yet" },
  pending: { label: "In review", tone: "aqua", note: "Guests can't see it yet" },
  active: { label: "Live", tone: "emerald", note: "Guests can book it" },
} as const;

const UPDATED = new Intl.DateTimeFormat("en-PH", { day: "numeric", month: "short", year: "numeric" });

// The API orders listings by category, then title, so grouping keeps that order.
function byCategory(listings: PartnerListing[]) {
  const groups = new Map<number, { name: string; listings: PartnerListing[] }>();
  for (const listing of listings) {
    const group = groups.get(listing.category.id) ?? { name: listing.category.name, listings: [] };
    group.listings.push(listing);
    groups.set(listing.category.id, group);
  }
  return [...groups.entries()];
}

function countLabel(count: number) {
  return `${count} ${count === 1 ? "listing" : "listings"}`;
}

// Every business the partner runs, in the API's order (by name), each with its listings
// (RAA-101): a heading with its name, how many listings it has and Edit, then its listings
// by category. A business with none yet offers to add the first.
export function ListingsByBusiness({
  businesses,
  listings,
}: {
  businesses: PartnerBusiness[];
  listings: PartnerListing[];
}) {
  return (
    <div className="flex flex-col gap-12">
      {businesses.map((business) => {
        const own = listings.filter((listing) => listing.business.id === business.id);
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
                <span className="font-sans text-sm font-normal text-muted">{countLabel(own.length)}</span>
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
              <ListingsByCategory listings={own} idPrefix={`business-${business.id}-`} />
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
  );
}

// A business's listings, one section per category. From `sm` up each is a table with fixed
// column widths, so the columns line up from one category to the next; on a phone each
// listing is a row of its own, its status beside the title. Either way the title is the
// link, stretched over the whole row.
function ListingsByCategory({ listings, idPrefix }: { listings: PartnerListing[]; idPrefix: string }) {
  return (
    <div className="flex flex-col gap-8">
      {byCategory(listings).map(([id, group]) => (
        <section
          key={id}
          data-testid="listing-category"
          aria-labelledby={`${idPrefix}category-${id}`}
          className="flex flex-col gap-3"
        >
          <h3 id={`${idPrefix}category-${id}`} className="flex items-baseline gap-2 text-lg font-semibold">
            {group.name}
            <span className="text-sm font-normal text-muted">{countLabel(group.listings.length)}</span>
          </h3>
          <Card>
            <ul className="divide-y divide-line sm:hidden">
              {group.listings.map((listing) => (
                <li key={listing.id} data-testid="listing-row" className="relative flex flex-col gap-1.5 px-4 py-3.5 active:bg-surface-2">
                  <div className="flex items-start justify-between gap-3">
                    <Link
                      href={`/partner/listings/${listing.id}`}
                      data-testid="listing-link"
                      className="font-medium text-link after:absolute after:inset-0"
                    >
                      {listing.title}
                    </Link>
                    <Badge tone={STATUS[listing.status].tone} className="shrink-0">
                      {STATUS[listing.status].label}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted">
                    {listing.area.name} · Updated {UPDATED.format(new Date(listing.updated_at))}
                  </p>
                </li>
              ))}
            </ul>
            <table className="hidden w-full table-fixed text-left text-sm sm:table">
              <colgroup>
                <col />
                <col className="w-40" />
                <col className="w-56" />
                <col className="w-32" />
              </colgroup>
              <thead className="border-b border-line bg-surface-2 text-muted">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Title</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Area</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Status</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Updated</th>
                </tr>
              </thead>
              <tbody>
                {group.listings.map((listing) => (
                  <tr
                    key={listing.id}
                    data-testid="listing-row"
                    className="relative border-b border-line transition-colors duration-300 ease-calm last:border-0 hover:bg-surface-2"
                  >
                    <td className="truncate px-4 py-3 font-medium">
                      <Link
                        href={`/partner/listings/${listing.id}`}
                        data-testid="listing-link"
                        className="text-link after:absolute after:inset-0 hover:underline"
                      >
                        {listing.title}
                      </Link>
                    </td>
                    <td className="truncate px-4 py-3 text-muted">{listing.area.name}</td>
                    <td className="px-4 py-3">
                      <span className="flex flex-col items-start gap-1">
                        <Badge tone={STATUS[listing.status].tone}>{STATUS[listing.status].label}</Badge>
                        <span className="text-xs text-muted">{STATUS[listing.status].note}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted tabular-nums">{UPDATED.format(new Date(listing.updated_at))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </section>
      ))}
    </div>
  );
}
