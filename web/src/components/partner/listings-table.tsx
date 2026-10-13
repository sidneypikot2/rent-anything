import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { PartnerBusiness } from "./use-partner-businesses";
import type { PartnerListing } from "./use-partner-listings";

export const STATUS = {
  draft: { label: "Draft", tone: "mist" },
  pending: { label: "In review", tone: "aqua" },
  active: { label: "Live", tone: "emerald" },
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
                className="flex items-baseline gap-2 font-display text-3xl font-bold italic"
              >
                {business.name}
                <span className="font-sans text-sm font-normal not-italic text-muted">{countLabel(own.length)}</span>
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

// A business's listings, one section and table per category. A row opens the listing:
// its title is the link, stretched over the whole row.
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
          <h3
            id={`${idPrefix}category-${id}`}
            className="flex items-baseline gap-2 font-display text-2xl font-bold italic"
          >
            {group.name}
            <span className="font-sans text-sm font-normal not-italic text-muted">
              {countLabel(group.listings.length)}
            </span>
          </h3>
          <Card className="overflow-x-auto">
            <table className="w-full min-w-lg text-left text-sm">
              <thead className="border-b border-line bg-surface-2 text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th scope="col" className="px-4 py-2 font-semibold">Title</th>
                  <th scope="col" className="px-4 py-2 font-semibold">Area</th>
                  <th scope="col" className="px-4 py-2 font-semibold">Status</th>
                  <th scope="col" className="px-4 py-2 font-semibold">Updated</th>
                </tr>
              </thead>
              <tbody>
                {group.listings.map((listing) => (
                  <tr
                    key={listing.id}
                    data-testid="listing-row"
                    className="relative border-b border-line last:border-0 hover:bg-surface-2"
                  >
                    <td className="px-4 py-3 font-medium">
                      <Link
                        href={`/partner/listings/${listing.id}`}
                        data-testid="listing-link"
                        className="text-link after:absolute after:inset-0 hover:underline"
                      >
                        {listing.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted">{listing.area.name}</td>
                    <td className="px-4 py-3">
                      <Badge tone={STATUS[listing.status].tone}>{STATUS[listing.status].label}</Badge>
                    </td>
                    <td className="px-4 py-3 text-muted">{UPDATED.format(new Date(listing.updated_at))}</td>
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
